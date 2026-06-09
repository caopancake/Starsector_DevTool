use crate::{
    domain::config::{build_skin_file, validate_config_id},
    domain::editor_config_definitions::entity_spec_definition,
    errors::{AppError, AppResult},
    io::{read_json_file, strip_internal_fields, FileChangeSetBuilder},
    models::{EntityKind, WriteResult},
};
use serde_json::Value;
use std::path::Path;

pub fn save_skin_entity(
    mod_root: &str,
    previous_id: Option<&str>,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    let next_id = validate_config_id(next_id, "无效舰船皮肤 ID")?.to_string();
    let mod_root = Path::new(mod_root);
    let previous_id = previous_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效舰船皮肤 ID").map(str::to_string))
        .transpose()?;
    let definition = skin_spec_definition()?;
    let next_rel_path = definition.default_rel_path(&next_id);
    let renamed = previous_id.as_deref().is_some_and(|id| id != next_id);
    let target = mod_root.join(&next_rel_path);
    if renamed && target.exists() {
        return Err(AppError::message(format!(
            "舰船皮肤目标已存在: {next_rel_path}"
        )));
    }

    let clean = strip_internal_fields(&data);
    let skin_file = build_skin_file(mod_root, &next_rel_path, &clean)?;
    if skin_file.skin_hull_id != next_id {
        return Err(AppError::message(format!(
            "舰船皮肤数据 skinHullId 与保存目标不一致: {}",
            skin_file.skin_hull_id
        )));
    }

    let mut builder = FileChangeSetBuilder::new(mod_root)?;
    if renamed {
        let previous = definition.default_rel_path(previous_id.as_deref().unwrap());
        require_skin_file_target(mod_root, &previous, previous_id.as_deref().unwrap())?;
        builder.text_file(previous, None)?;
    }
    builder.text_file(&next_rel_path, Some(serde_json::to_string_pretty(&clean)?))?;
    let changes = builder.apply()?;

    Ok(WriteResult::from_refreshed_entity(
        changes,
        serde_json::to_value(skin_file)?,
    ))
}

pub fn create_skin_entity(
    mod_root: &str,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    save_skin_entity(mod_root, None, next_id, data)
}

pub fn delete_skin_entity(
    mod_root: &str,
    skin_hull_id: &str,
    rel_path: &str,
) -> AppResult<WriteResult> {
    validate_config_id(skin_hull_id, "无效舰船皮肤 ID")?;
    require_skin_file_target(Path::new(mod_root), rel_path, skin_hull_id)?;
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root))?;
    builder.text_file(rel_path, None)?;
    let changes = builder.apply()?;
    Ok(WriteResult::from_changes(changes))
}

fn require_skin_file_target(mod_root: &Path, rel_path: &str, skin_hull_id: &str) -> AppResult<()> {
    skin_spec_definition()?.validate_rel_path(rel_path, "舰船皮肤路径无效")?;
    let data = read_json_file(&mod_root.join(rel_path))?;
    let file = build_skin_file(mod_root, rel_path, &data)?;
    if file.skin_hull_id != skin_hull_id {
        return Err(AppError::message(format!(
            "舰船皮肤路径与实体 ID 不匹配: {rel_path}"
        )));
    }
    Ok(())
}

fn skin_spec_definition(
) -> crate::errors::AppResult<&'static crate::domain::editor_config_definitions::EntitySpecDefinition>
{
    entity_spec_definition(EntityKind::Skin)
        .ok_or_else(|| AppError::message("舰船皮肤 spec 定义不存在"))
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

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert!(root.join("data/hulls/skins/old.skin").exists());
        assert!(!root.join("data/hulls/skins/new.skin").exists());

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
        .unwrap();
        let text = read_utf8_no_bom(&root.join("data/hulls/skins/new.skin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"skinHullId\": \"new\""));
    }

    #[test]
    fn skin_delete_returns_replayable_changeset() {
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
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes,
        )
        .unwrap();
        let text = read_utf8_no_bom(&root.join("data/hulls/skins/demo.skin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"skinHullId\":\"demo\""));
    }

    #[test]
    fn skin_delete_rejects_rel_path_outside_skin_directory() {
        let root = temp_dir("skin_delete_rejects_external_rel_path");
        write_utf8_no_bom(&root.join("mod_info.json"), "{}").unwrap();

        let result = delete_skin_entity(&root.to_string_lossy(), "demo", "mod_info.json");

        let text = read_utf8_no_bom(&root.join("mod_info.json")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert_eq!(text, "{}");
    }

    #[test]
    fn skin_delete_requires_rel_path_entity_match() {
        let root = temp_dir("skin_delete_requires_matching_id");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/other.skin"),
            r#"{"skinHullId":"other","baseHullId":"base"}"#,
        )
        .unwrap();

        let result = delete_skin_entity(
            &root.to_string_lossy(),
            "demo",
            "data/hulls/skins/other.skin",
        );

        let text = read_utf8_no_bom(&root.join("data/hulls/skins/other.skin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(text.contains("\"skinHullId\":\"other\""));
    }

    #[test]
    fn skin_save_requires_data_id_to_match_target_id() {
        let root = temp_dir("skin_save_rejects_mismatched_data_id");

        let result = save_skin_entity(
            &root.to_string_lossy(),
            None,
            "new",
            serde_json::json!({"skinHullId": "other", "baseHullId": "base"}),
        );

        let target_exists = root.join("data/hulls/skins/new.skin").exists();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(!target_exists);
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
