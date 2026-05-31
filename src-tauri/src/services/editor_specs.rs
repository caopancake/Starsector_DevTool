use crate::{
    domain::config::validate_config_id,
    errors::{AppError, AppResult},
    io::{
        build_text_change, invalidated_paths_for_changes, read_json_file, strip_internal_fields,
        validate_absolute_path_without_parent,
    },
    models::{EditorSpecKind, FileChangeReplayDirection, WriteResult},
    services::file_changes::apply_file_change_set,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn save_editor_spec(
    mod_root: &str,
    kind: EditorSpecKind,
    id: &str,
    data: Value,
) -> AppResult<WriteResult> {
    let id = validate_config_id(id, kind.invalid_id_message())?;
    let target = find_editor_spec_target(Path::new(mod_root), kind, id)?;
    let clean = strip_internal_fields(&data);
    let text = serde_json::to_string_pretty(&clean)?;
    let change = build_text_change(&target, Some(text))?;
    apply_file_change_set(
        mod_root,
        FileChangeReplayDirection::Redo,
        vec![change.clone()],
    )?;
    let changes = vec![change];
    Ok(WriteResult {
        invalidated_paths: invalidated_paths_for_changes(&changes),
        changes,
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    })
}

pub fn load_imported_editor_spec_file(kind: EditorSpecKind, path: String) -> AppResult<Value> {
    let path = Path::new(&path);
    validate_imported_editor_spec_path(kind, path)?;
    read_json_file(path)
}

impl EditorSpecKind {
    fn invalid_id_message(self) -> &'static str {
        match self {
            Self::Ship => "无效舰船 ID",
            Self::Weapon => "无效武器 ID",
            Self::Projectile => "无效弹体 ID",
            Self::System => "无效战术系统 ID",
        }
    }

    fn extension(self) -> &'static str {
        match self {
            Self::Ship => "ship",
            Self::Weapon => "wpn",
            Self::Projectile => "proj",
            Self::System => "system",
        }
    }
}

fn find_editor_spec_target(mod_root: &Path, kind: EditorSpecKind, id: &str) -> AppResult<PathBuf> {
    let target = match kind {
        EditorSpecKind::Ship => find_json_target(mod_root, "data/hulls", "ship", "hullId", id),
        EditorSpecKind::Weapon => find_json_target(mod_root, "data/weapons", "wpn", "id", id),
        EditorSpecKind::Projectile => {
            find_json_target(mod_root, "data/weapons/proj", "proj", "id", id)
        }
        EditorSpecKind::System => {
            find_json_target(mod_root, "data/shipsystems", "system", "id", id)
        }
    }?;
    Ok(target)
}

fn find_json_target(
    mod_root: &Path,
    rel_dir: &str,
    ext: &str,
    id_key: &str,
    id: &str,
) -> AppResult<PathBuf> {
    let dir = mod_root.join(rel_dir);
    if dir.exists() {
        if !dir.is_dir() {
            return Err(AppError::message(format!(
                "editor spec directory is not a directory: {}",
                dir.display()
            )));
        }
        for entry in WalkDir::new(&dir) {
            let entry = entry.map_err(|error| {
                AppError::message(format!(
                    "walk editor spec directory failed ({}): {error}",
                    dir.display()
                ))
            })?;
            if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
                continue;
            }
            let value = read_json_file(entry.path())?;
            if value.get(id_key).and_then(Value::as_str) == Some(id) {
                return Ok(entry.path().to_path_buf());
            }
        }
    }
    Ok(dir.join(format!("{id}.{ext}")))
}

fn validate_imported_editor_spec_path(kind: EditorSpecKind, path: &Path) -> AppResult<()> {
    validate_absolute_path_without_parent(path, "imported editor spec")?;
    if path.extension().and_then(|value| value.to_str()) != Some(kind.extension()) {
        return Err(AppError::message(format!(
            "imported editor spec extension must be .{}: {}",
            kind.extension(),
            path.display()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::{read_utf8_no_bom, write_utf8_no_bom};
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_editor_spec_uses_fixed_weapon_target_boundary() {
        let root = temp_dir("save_editor_weapon_spec");
        fs::create_dir_all(root.join("data/weapons/nested")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/nested/demo.wpn"),
            r#"{"id":"demo","weaponType":"BALLISTIC"}"#,
        )
        .unwrap();

        let result = save_editor_spec(
            &root.to_string_lossy(),
            EditorSpecKind::Weapon,
            "demo",
            serde_json::json!({"id": "demo", "weaponType": "ENERGY"}),
        )
        .unwrap();

        let text = read_utf8_no_bom(&root.join("data/weapons/nested/demo.wpn")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(result.invalidated_paths.len(), 1);
        assert!(text.contains("\"weaponType\": \"ENERGY\""));
    }

    #[test]
    fn save_editor_spec_uses_fixed_ship_target_boundary() {
        let root = temp_dir("save_editor_unknown_spec");
        fs::create_dir_all(root.join("data/hulls")).unwrap();

        let result = save_editor_spec(
            &root.to_string_lossy(),
            EditorSpecKind::Ship,
            "demo",
            serde_json::json!({"hullId": "demo"}),
        )
        .unwrap();

        let text = read_utf8_no_bom(&root.join("data/hulls/demo.ship")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(result.invalidated_paths.len(), 1);
        assert!(text.contains("\"hullId\": \"demo\""));
    }

    #[test]
    fn save_editor_spec_does_not_skip_broken_target_candidates() {
        let root = temp_dir("save_editor_broken_candidate");
        fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(&root.join("data/weapons/broken.wpn"), "{").unwrap();

        let error = save_editor_spec(
            &root.to_string_lossy(),
            EditorSpecKind::Weapon,
            "demo",
            serde_json::json!({"id": "demo", "weaponType": "ENERGY"}),
        )
        .unwrap_err()
        .to_string();
        let default_target_exists = root.join("data/weapons/demo.wpn").exists();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("broken.wpn"));
        assert!(!default_target_exists);
    }

    #[test]
    fn save_editor_spec_rejects_non_directory_candidate_root() {
        let root = temp_dir("save_editor_non_directory_root");
        fs::create_dir_all(root.join("data")).unwrap();
        write_utf8_no_bom(&root.join("data/weapons"), "not a directory").unwrap();

        let error = save_editor_spec(
            &root.to_string_lossy(),
            EditorSpecKind::Weapon,
            "demo",
            serde_json::json!({"id": "demo", "weaponType": "ENERGY"}),
        )
        .unwrap_err()
        .to_string();
        let default_target_exists = root.join("data/weapons/demo.wpn").exists();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("editor spec directory is not a directory"));
        assert!(!default_target_exists);
    }

    #[test]
    fn save_editor_spec_rejects_invalid_id_before_candidate_scan() {
        let root = temp_dir("save_editor_invalid_id_before_scan");
        fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(&root.join("data/weapons/broken.wpn"), "{").unwrap();

        let error = save_editor_spec(
            &root.to_string_lossy(),
            EditorSpecKind::Weapon,
            "../outside",
            serde_json::json!({"id": "../outside", "weaponType": "ENERGY"}),
        )
        .unwrap_err()
        .to_string();
        let outside_target_exists = root.join("data/outside.wpn").exists();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("无效武器 ID"));
        assert!(!outside_target_exists);
    }

    #[test]
    fn load_imported_editor_spec_file_requires_matching_extension() {
        let root = temp_dir("load_imported_spec_extension");
        let path = root.join("demo.ship");
        write_utf8_no_bom(&path, r#"{"hullId":"demo"}"#).unwrap();

        let error = load_imported_editor_spec_file(
            EditorSpecKind::Weapon,
            path.to_string_lossy().to_string(),
        )
        .unwrap_err()
        .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("imported editor spec extension must be .wpn"));
    }

    #[test]
    fn load_imported_editor_spec_file_rejects_parent_dir_path() {
        let root = temp_dir("load_imported_spec_parent_dir");
        let path = root.join("..").join("demo.wpn");

        let error = load_imported_editor_spec_file(
            EditorSpecKind::Weapon,
            path.to_string_lossy().to_string(),
        )
        .unwrap_err()
        .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("invalid imported editor spec path"));
    }

    #[test]
    fn load_imported_editor_spec_file_reads_matching_spec() {
        let root = temp_dir("load_imported_spec_reads");
        let path = root.join("demo.wpn");
        write_utf8_no_bom(&path, r#"{"id":"demo","weaponType":"ENERGY"}"#).unwrap();

        let value = load_imported_editor_spec_file(
            EditorSpecKind::Weapon,
            path.to_string_lossy().to_string(),
        )
        .unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(value.get("id").and_then(Value::as_str), Some("demo"));
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
