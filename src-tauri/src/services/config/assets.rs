use crate::{
    errors::{AppError, AppResult},
    io::{read_json_file, validate_walk_entry, FileChangeSetBuilder, FsRootBoundary},
    models::{DiscoveredField, DiscoveredFieldType, ResourceSource, SpriteSubfolder, WriteResult},
};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::{collections::BTreeMap, path::Path};
use walkdir::WalkDir;

static SPRITE_FILENAME_RE: OnceLock<Regex> = OnceLock::new();

pub fn upload_sprite(
    mod_root: &str,
    filename: &str,
    data: String,
    subfolder: SpriteSubfolder,
    overwrite: bool,
) -> AppResult<WriteResult<Value>> {
    let sub = subfolder.graphics_rel_dir();
    let sprite_filename = validate_sprite_filename(filename)?;
    let mod_root = Path::new(mod_root);
    let target = mod_root.join(sub).join(sprite_filename);
    let rel = format!("{}/{}", sub, sprite_filename).replace('\\', "/");
    let exists = target.exists();
    if exists && !overwrite {
        return Ok(WriteResult::from_refreshed_entity(
            Vec::new(),
            json!({
                "ok": false,
                "exists": true,
                "path": rel,
                "overwritten": false,
                "message": format!("{sprite_filename} already exists. Overwrite?")
            }),
        ));
    }
    let mut builder = FileChangeSetBuilder::new(mod_root)?;
    builder.binary_file(&rel, Some(data))?;
    let changes = builder.apply()?;
    Ok(WriteResult::from_refreshed_entity(
        changes,
        json!({
            "ok": true,
            "exists": exists,
            "path": rel,
            "overwritten": exists,
            "message": Value::Null
        }),
    ))
}

fn validate_sprite_filename(filename: &str) -> AppResult<&str> {
    let trimmed = filename.trim();
    let filename_re = SPRITE_FILENAME_RE.get_or_init(|| {
        Regex::new(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.png$").expect("valid sprite filename regex")
    });
    if filename_re.is_match(trimmed) {
        Ok(trimmed)
    } else {
        Err(AppError::message(format!(
            "invalid sprite filename: {filename}"
        )))
    }
}

/// Scan starsector-core/graphics/ and return all image file paths (relative to starsector-core).
pub fn scan_core_graphics(starsector_root: &str) -> AppResult<Vec<String>> {
    let starsector_root = FsRootBoundary::new(Path::new(starsector_root), "starsector root")?;
    let dir = starsector_root
        .root()
        .join("starsector-core")
        .join("graphics");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let core_dir = starsector_root.root().join("starsector-core");
    let mut paths = Vec::new();
    for entry in WalkDir::new(&dir) {
        let entry =
            entry.map_err(|error| AppError::message(format!("遍历原版图片目录失败: {error}")))?;
        validate_walk_entry(entry.path(), "core graphics")?;
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if !matches!(ext, "png" | "jpg" | "jpeg" | "gif") {
            continue;
        }
        let rel = entry.path().strip_prefix(&core_dir).map_err(|error| {
            AppError::message(format!(
                "原版图片路径不在 starsector-core 内 ({}): {error}",
                entry.path().display()
            ))
        })?;
        paths.push(rel.to_string_lossy().replace('\\', "/"));
    }
    Ok(paths)
}

/// Scan starsector-core files and discover field names + inferred types.
/// Returns a map: fileType -> Vec<DiscoveredField>
pub fn scan_core_fields(
    starsector_root: &str,
) -> AppResult<BTreeMap<String, Vec<DiscoveredField>>> {
    let mut result = BTreeMap::new();
    let starsector_root = FsRootBoundary::new(Path::new(starsector_root), "starsector root")?;
    let core_dir = starsector_root.root().join("starsector-core");
    if !core_dir.exists() {
        return Ok(result);
    }

    // Scan faction files
    let faction_fields = scan_json_fields(&core_dir.join("data/world/factions"), "faction")?;
    if !faction_fields.is_empty() {
        result.insert("faction".to_string(), faction_fields);
    }

    // Scan ship files
    let ship_fields = scan_json_fields(&core_dir.join("data/hulls"), "ship")?;
    if !ship_fields.is_empty() {
        result.insert("ship".to_string(), ship_fields);
    }

    // Scan weapon files
    let wpn_fields = scan_json_fields(&core_dir.join("data/weapons"), "wpn")?;
    if !wpn_fields.is_empty() {
        result.insert("weapon".to_string(), wpn_fields);
    }

    Ok(result)
}

/// Scan all JSON files in a directory with given extension,
/// collect all unique top-level field names and infer types from values.
fn scan_json_fields(dir: &Path, ext: &str) -> AppResult<Vec<DiscoveredField>> {
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut field_map: BTreeMap<String, DiscoveredFieldType> = BTreeMap::new();

    for entry in WalkDir::new(dir).max_depth(2) {
        let entry =
            entry.map_err(|error| AppError::message(format!("遍历原版字段目录失败: {error}")))?;
        validate_walk_entry(entry.path(), "core fields")?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
            continue;
        }
        let value = read_json_file(entry.path())?;
        let Value::Object(obj) = value else {
            return Err(AppError::message(format!(
                "core field source must be a JSON object: {}",
                entry.path().display()
            )));
        };
        for (key, value) in &obj {
            if key.starts_with('_') {
                continue;
            }
            // Only set type if not already discovered (first occurrence wins)
            field_map
                .entry(key.clone())
                .or_insert_with(|| infer_type(value));
        }
    }

    Ok(field_map
        .into_iter()
        .map(|(key, field_type)| DiscoveredField {
            key,
            field_type,
            origin: ResourceSource::Core,
        })
        .collect())
}

/// Infer a schema field type from a JSON value
fn infer_type(value: &Value) -> DiscoveredFieldType {
    match value {
        Value::Bool(_) => DiscoveredFieldType::Boolean,
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                DiscoveredFieldType::Integer
            } else {
                DiscoveredFieldType::Float
            }
        }
        Value::String(s) => {
            if s.starts_with("graphics/") {
                DiscoveredFieldType::PathImage
            } else {
                DiscoveredFieldType::String
            }
        }
        Value::Array(arr) => {
            if arr.is_empty() {
                return DiscoveredFieldType::StringArray;
            }
            // Check if it looks like a color [R, G, B] or [R, G, B, A]
            if (arr.len() == 3 || arr.len() == 4) && arr.iter().all(|v| v.is_i64() || v.is_u64()) {
                let all_in_range = arr
                    .iter()
                    .all(|v| v.as_i64().map(|n| (0..=255).contains(&n)).unwrap_or(false));
                if all_in_range {
                    return DiscoveredFieldType::ColorRgba;
                }
            }
            if arr.iter().all(Value::is_string) {
                DiscoveredFieldType::StringArray
            } else if arr.iter().all(Value::is_object) {
                DiscoveredFieldType::ArrayOfObject
            } else {
                DiscoveredFieldType::StringArray
            }
        }
        Value::Object(obj) => {
            // If it has a "tags" field that's an array, it's a tag-select
            if let Some(Value::Array(_)) = obj.get("tags") {
                DiscoveredFieldType::TagSelect
            } else {
                DiscoveredFieldType::Object
            }
        }
        Value::Null => DiscoveredFieldType::String,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FileChangeReplayDirection;
    use crate::services::file_changes::apply_file_change_set;
    use base64::{engine::general_purpose, Engine as _};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn upload_sprite_create_returns_replayable_history() {
        let root = temp_dir("upload_sprite_create_history");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        )
        .unwrap();
        let path = root.join("graphics/ships/demo.png");

        assert!(result
            .refreshed_entity
            .as_ref()
            .and_then(|entity| entity.get("ok"))
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert!(!path.exists());
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn upload_sprite_overwrite_returns_replayable_history() {
        let root = temp_dir("upload_sprite_overwrite_history");
        let path = root.join("graphics/ships/demo.png");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, [9, 8, 7]).unwrap();

        let exists = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        )
        .unwrap();
        assert!(!exists
            .refreshed_entity
            .as_ref()
            .and_then(|entity| entity.get("ok"))
            .and_then(Value::as_bool)
            .unwrap_or(true));
        assert!(exists.changes.is_empty());

        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            true,
        )
        .unwrap();

        let refreshed = result.refreshed_entity.as_ref().unwrap();
        assert!(refreshed
            .get("ok")
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert!(refreshed
            .get("overwritten")
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn upload_sprite_invalid_data_does_not_create_target_directory() {
        let root = temp_dir("upload_sprite_invalid_data");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            "not base64".to_string(),
            SpriteSubfolder::Ships,
            false,
        );

        let target_dir_exists = root.join("graphics/ships").exists();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(!target_dir_exists);
    }

    #[test]
    fn upload_sprite_rejects_invalid_filename_without_rewriting() {
        let root = temp_dir("upload_sprite_invalid_filename");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "../bad name.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        );

        let target_dir_exists = root.join("graphics/ships").exists();
        let _ = fs::remove_dir_all(root);
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("invalid sprite filename"));
        assert!(!target_dir_exists);
    }

    #[test]
    fn core_field_scan_reports_broken_json() {
        let root = temp_dir("core_field_scan_broken_json");
        fs::create_dir_all(root.join("starsector-core/data/weapons")).unwrap();
        crate::io::write_utf8_no_bom(&root.join("starsector-core/data/weapons/bad.wpn"), "{")
            .unwrap();

        let error = scan_core_fields(&root.to_string_lossy())
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("bad.wpn"));
    }

    #[test]
    fn core_field_scan_rejects_non_object_json_sources() {
        let root = temp_dir("core_field_scan_non_object");
        fs::create_dir_all(root.join("starsector-core/data/weapons")).unwrap();
        crate::io::write_utf8_no_bom(&root.join("starsector-core/data/weapons/list.wpn"), "[]")
            .unwrap();

        let error = scan_core_fields(&root.to_string_lossy())
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("core field source must be a JSON object"));
        assert!(error.contains("list.wpn"));
    }

    #[test]
    fn core_field_scan_rejects_parent_dir_root() {
        let root = temp_dir("core_field_scan_parent_dir_root");
        let escaped = root.join("..");

        let error = scan_core_fields(&escaped.to_string_lossy())
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("invalid starsector root path"));
    }

    #[test]
    fn core_graphics_scan_returns_relative_paths() {
        let root = temp_dir("core_graphics_scan_paths");
        fs::create_dir_all(root.join("starsector-core/graphics/ships")).unwrap();
        fs::write(
            root.join("starsector-core/graphics/ships/demo.png"),
            [1, 2, 3],
        )
        .unwrap();

        let paths = scan_core_graphics(&root.to_string_lossy()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(paths, vec!["graphics/ships/demo.png".to_string()]);
    }

    #[test]
    fn core_graphics_scan_rejects_link_entry() {
        let Some((root, outside, _linked)) = temp_core_linked_dir(
            "core_graphics_link_entry",
            "starsector-core/graphics/linked",
        ) else {
            return;
        };
        fs::write(outside.join("outside.png"), [1, 2, 3]).unwrap();

        let result = scan_core_graphics(&root.to_string_lossy());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn core_field_scan_rejects_link_entry() {
        let Some((root, outside, _linked)) = temp_core_linked_dir(
            "core_fields_link_entry",
            "starsector-core/data/weapons/linked",
        ) else {
            return;
        };
        crate::io::write_utf8_no_bom(&outside.join("outside.wpn"), r#"{"id":"outside"}"#).unwrap();

        let result = scan_core_fields(&root.to_string_lossy());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    fn temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn temp_core_linked_dir(name: &str, rel_link: &str) -> Option<(PathBuf, PathBuf, PathBuf)> {
        let root = temp_dir(&format!("{name}_root"));
        let outside = temp_dir(&format!("{name}_outside"));
        let link = root.join(rel_link);
        fs::create_dir_all(link.parent().unwrap()).unwrap();
        if create_dir_link(&outside, &link).is_err() {
            let _ = fs::remove_dir_all(root);
            let _ = fs::remove_dir_all(outside);
            return None;
        }
        Some((root, outside, link))
    }

    #[cfg(windows)]
    fn create_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }

    #[cfg(unix)]
    fn create_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(not(any(windows, unix)))]
    fn create_dir_link(_target: &Path, _link: &Path) -> std::io::Result<()> {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "directory links are unsupported on this platform",
        ))
    }
}
