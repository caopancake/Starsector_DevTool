use crate::{
    errors::{AppError, AppResult},
    io::{build_text_change, read_json_file, strip_internal_fields},
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
    let target = find_editor_spec_target(Path::new(mod_root), kind, id)?;
    let clean = strip_internal_fields(&data);
    let text = serde_json::to_string_pretty(&clean)?;
    let change = build_text_change(&target, Some(text))?;
    apply_file_change_set(FileChangeReplayDirection::Redo, vec![change.clone()])?;
    Ok(WriteResult {
        invalidated_paths: vec![change.path.clone()],
        changes: vec![change],
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    })
}

fn find_editor_spec_target(mod_root: &Path, kind: EditorSpecKind, id: &str) -> AppResult<PathBuf> {
    let target = match kind {
        EditorSpecKind::Ship => find_json_target(mod_root, "data/hulls", "ship", "hullId", id),
        EditorSpecKind::Weapon => find_json_target(mod_root, "data/weapons", "wpn", "id", id),
        EditorSpecKind::Projectile => {
            find_json_target(mod_root, "data/weapons/proj", "proj", "id", id)
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
