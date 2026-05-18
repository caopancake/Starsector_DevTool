use crate::{
    errors::{AppError, AppResult},
    io::read_json_file,
    models::{UploadSpritePayload, UploadSpriteResult},
    services::file_changes::FileChangeSetBuilder,
};
use base64::{engine::general_purpose, Engine as _};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::{collections::BTreeMap, fs, path::Path};
use walkdir::WalkDir;

static SAFE_FILENAME_RE: OnceLock<Regex> = OnceLock::new();

pub fn upload_sprite(payload: UploadSpritePayload) -> AppResult<UploadSpriteResult> {
    let sub = match payload.subfolder.as_deref() {
        Some("weapons") => "graphics/weapons",
        Some("missiles") | Some("proj") => "graphics/missiles",
        Some("fx") => "graphics/fx",
        _ => "graphics/ships",
    };
    let safe_re = SAFE_FILENAME_RE
        .get_or_init(|| Regex::new(r"[^\w\-.]").expect("valid safe filename regex"));
    let mut safe_name = safe_re.replace_all(&payload.filename, "_").to_string();
    if !safe_name.to_ascii_lowercase().ends_with(".png") {
        safe_name.push_str(".png");
    }
    let mod_root = Path::new(&payload.mod_root);
    let target_dir = mod_root.join(sub);
    fs::create_dir_all(&target_dir)?;
    let target = target_dir.join(&safe_name);
    let rel = format!("{}/{}", sub, safe_name).replace('\\', "/");
    let exists = target.exists();
    if exists && !payload.overwrite {
        return Ok(UploadSpriteResult {
            ok: false,
            exists: true,
            path: rel,
            overwritten: false,
            message: Some(format!("{safe_name} already exists. Overwrite?")),
            changes: vec![],
        });
    }
    let mut builder = FileChangeSetBuilder::new(mod_root);
    builder.binary_file(&rel, Some(payload.data))?;
    let changes = builder.apply()?;
    Ok(UploadSpriteResult {
        ok: true,
        exists,
        path: rel,
        overwritten: exists,
        message: None,
        changes,
    })
}

pub fn load_image_as_data_url(
    mod_root: &str,
    rel_path: &str,
    starsector_root: Option<&str>,
) -> AppResult<Option<String>> {
    let clean_path = rel_path.replace('\\', "/");

    // Try mod directory first
    let mod_path = Path::new(mod_root).join(&clean_path);
    if mod_path.exists() {
        return read_image_to_data_url(&mod_path);
    }

    // Fallback: try starsector-core directory
    if let Some(root) = starsector_root {
        let core_path = Path::new(root).join("starsector-core").join(&clean_path);
        if core_path.exists() {
            return read_image_to_data_url(&core_path);
        }
    }

    // Also try inferring starsector root from mod_root (parent of parent)
    if let Some(inferred_root) = Path::new(mod_root).parent().and_then(|p| p.parent()) {
        let core_path = inferred_root.join("starsector-core").join(&clean_path);
        if core_path.exists() {
            return read_image_to_data_url(&core_path);
        }
    }

    Ok(None)
}

fn read_image_to_data_url(path: &Path) -> AppResult<Option<String>> {
    let bytes = fs::read(path).map_err(|error| {
        AppError::context(
            format!("读取图片文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let mime = match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    Ok(Some(format!(
        "data:{};base64,{}",
        mime,
        general_purpose::STANDARD.encode(bytes)
    )))
}

/// Scan starsector-core/graphics/ and return all image file paths (relative to starsector-core).
pub fn scan_core_graphics(starsector_root: &str) -> Vec<String> {
    let dir = Path::new(starsector_root)
        .join("starsector-core")
        .join("graphics");
    if !dir.exists() {
        return vec![];
    }
    let core_dir = Path::new(starsector_root).join("starsector-core");
    WalkDir::new(&dir)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let ext = e.path().extension().and_then(|s| s.to_str()).unwrap_or("");
            matches!(ext, "png" | "jpg" | "jpeg" | "gif")
        })
        .filter_map(|e| {
            e.path()
                .strip_prefix(&core_dir)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .collect()
}

/// Scan starsector-core files and discover field names + inferred types.
/// Returns a map: fileType → Vec<DiscoveredField>
pub fn scan_core_fields(starsector_root: &str) -> BTreeMap<String, Vec<Value>> {
    let mut result = BTreeMap::new();
    let core_dir = Path::new(starsector_root).join("starsector-core");
    if !core_dir.exists() {
        return result;
    }

    // Scan faction files
    let faction_fields = scan_json_fields(&core_dir.join("data/world/factions"), "faction");
    if !faction_fields.is_empty() {
        result.insert("faction".to_string(), faction_fields);
    }

    // Scan ship files
    let ship_fields = scan_json_fields(&core_dir.join("data/hulls"), "ship");
    if !ship_fields.is_empty() {
        result.insert("ship".to_string(), ship_fields);
    }

    // Scan weapon files
    let wpn_fields = scan_json_fields(&core_dir.join("data/weapons"), "wpn");
    if !wpn_fields.is_empty() {
        result.insert("weapon".to_string(), wpn_fields);
    }

    result
}

/// Scan all JSON files in a directory with given extension,
/// collect all unique top-level field names and infer types from values.
fn scan_json_fields(dir: &Path, ext: &str) -> Vec<Value> {
    if !dir.exists() {
        return vec![];
    }

    let mut field_map: BTreeMap<String, String> = BTreeMap::new();

    for entry in WalkDir::new(dir).max_depth(2).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
            continue;
        }
        if let Ok(Value::Object(obj)) = read_json_file(entry.path()) {
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
    }

    field_map
        .into_iter()
        .map(|(key, field_type)| {
            json!({
                "key": key,
                "type": field_type,
                "origin": "core"
            })
        })
        .collect()
}

/// Infer a schema field type from a JSON value
fn infer_type(value: &Value) -> String {
    match value {
        Value::Bool(_) => "boolean".to_string(),
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                "integer".to_string()
            } else {
                "float".to_string()
            }
        }
        Value::String(s) => {
            if s.starts_with("graphics/") {
                "path-image".to_string()
            } else {
                "string".to_string()
            }
        }
        Value::Array(arr) => {
            if arr.is_empty() {
                return "string-array".to_string();
            }
            // Check if it looks like a color [R, G, B] or [R, G, B, A]
            if (arr.len() == 3 || arr.len() == 4) && arr.iter().all(|v| v.is_i64() || v.is_u64()) {
                let all_in_range = arr
                    .iter()
                    .all(|v| v.as_i64().map(|n| (0..=255).contains(&n)).unwrap_or(false));
                if all_in_range {
                    return "color-rgba".to_string();
                }
            }
            if arr.iter().all(Value::is_string) {
                "string-array".to_string()
            } else if arr.iter().all(Value::is_object) {
                "array-of-object".to_string()
            } else {
                "string-array".to_string()
            }
        }
        Value::Object(obj) => {
            // If it has a "tags" field that's an array, it's a tag-select
            if let Some(Value::Array(_)) = obj.get("tags") {
                "tag-select".to_string()
            } else {
                "object".to_string()
            }
        }
        Value::Null => "string".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::ApplyFileChangeSetPayload, services::file_changes::apply_file_change_set};
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn upload_sprite_create_returns_replayable_history() {
        let root = temp_dir("upload_sprite_create_history");
        let result = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: false,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();
        let path = root.join("graphics/ships/demo.png");

        assert!(result.ok);
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert!(!path.exists());
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
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

        let exists = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: false,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();
        assert!(!exists.ok);
        assert!(exists.changes.is_empty());

        let result = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: true,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();

        assert!(result.ok);
        assert!(result.overwritten);
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
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
}
