use crate::{
    domain::config::{build_skin_file, skin_rel_path, validate_config_id},
    errors::{AppError, AppResult},
    io::{strip_internal_fields, FileChangeSetBuilder},
    models::WriteResult,
};
use serde_json::Value;
use std::path::Path;

pub fn save_skin_entity(
    mod_root: &str,
    previous_id: Option<&str>,
    previous_rel_path: Option<&str>,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    let next_id = validate_config_id(next_id, "无效舰船皮肤 ID")?.to_string();
    let mod_root = Path::new(mod_root);
    let previous_id = previous_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效舰船皮肤 ID").map(str::to_string))
        .transpose()?;
    let previous_rel_path = previous_rel_path.filter(|value| !value.trim().is_empty());
    let next_rel_path = skin_rel_path(&next_id);
    let renamed = previous_id.as_deref().is_some_and(|id| id != next_id);
    let target = mod_root.join(&next_rel_path);
    if renamed && target.exists() {
        return Err(AppError::message(format!(
            "舰船皮肤目标已存在: {next_rel_path}"
        )));
    }

    let clean = strip_internal_fields(&data);
    let skin_file = build_skin_file(mod_root, &next_rel_path, &clean)?;

    let mut builder = FileChangeSetBuilder::new(mod_root);
    if renamed {
        let previous = previous_rel_path.ok_or_else(|| AppError::message("缺少旧舰船皮肤路径"))?;
        builder.text_file(previous, None)?;
    }
    builder.text_file(&next_rel_path, Some(serde_json::to_string_pretty(&clean)?))?;
    let changes = builder.apply()?;

    Ok(WriteResult {
        invalidated_paths: changes.iter().map(|change| change.path.clone()).collect(),
        changes,
        key_map: Vec::new(),
        refreshed_entity: Some(serde_json::to_value(skin_file)?),
        warnings: Vec::new(),
    })
}

pub fn create_skin_entity(
    mod_root: &str,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    save_skin_entity(mod_root, None, None, next_id, data)
}

pub fn delete_skin_entity(
    mod_root: &str,
    skin_hull_id: &str,
    rel_path: &str,
) -> AppResult<WriteResult> {
    validate_config_id(skin_hull_id, "无效舰船皮肤 ID")?;
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    builder.text_file(rel_path, None)?;
    let changes = builder.apply()?;
    Ok(WriteResult {
        invalidated_paths: changes.iter().map(|change| change.path.clone()).collect(),
        changes,
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{read_utf8_no_bom, write_utf8_no_bom},
        models::FileChangeReplayDirection,
        services::file_changes::apply_file_change_set,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn skin_save_can_rename_file_with_undo_redo() {
        let root = temp_dir("skin_entity_rename");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/old.skin"),
            r#"{"skinHullId":"old","baseHullId":"base"}"#,
        )
        .unwrap();

        let result = save_skin_entity(
            &root.to_string_lossy(),
            Some("old"),
            Some("data/hulls/skins/old.skin"),
            "new",
            serde_json::json!({
                "skinHullId": "new",
                "baseHullId": "base",
                "builtInWeapons": {"WS 001": "demo_weapon"}
            }),
        )
        .unwrap();

        let skin_file: crate::models::SkinFile =
            serde_json::from_value(result.refreshed_entity.clone().unwrap()).unwrap();
        assert!(!root.join("data/hulls/skins/old.skin").exists());
        assert!(root.join("data/hulls/skins/new.skin").exists());
        assert_eq!(skin_file.skin_hull_id, "new");
        assert_eq!(skin_file.built_in_weapon_count, 1);

        apply_file_change_set(FileChangeReplayDirection::Undo, result.changes.clone()).unwrap();
        assert!(root.join("data/hulls/skins/old.skin").exists());
        assert!(!root.join("data/hulls/skins/new.skin").exists());

        apply_file_change_set(FileChangeReplayDirection::Redo, result.changes).unwrap();
        let text = read_utf8_no_bom(&root.join("data/hulls/skins/new.skin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"skinHullId\": \"new\""));
    }

    #[test]
    fn skin_delete_uses_file_history() {
        let root = temp_dir("skin_entity_delete");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/demo.skin"),
            r#"{"skinHullId":"demo","baseHullId":"base"}"#,
        )
        .unwrap();

        let result = delete_skin_entity(
            &root.to_string_lossy(),
            "demo",
            "data/hulls/skins/demo.skin",
        )
        .unwrap();

        assert!(!root.join("data/hulls/skins/demo.skin").exists());
        apply_file_change_set(FileChangeReplayDirection::Undo, result.changes).unwrap();
        let text = read_utf8_no_bom(&root.join("data/hulls/skins/demo.skin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"skinHullId\":\"demo\""));
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
