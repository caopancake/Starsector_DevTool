use crate::{
    domain::config::{
        build_variant_file, validate_config_file_rel_path, validate_config_id, variant_rel_path,
    },
    errors::{AppError, AppResult},
    io::{
        invalidated_paths_for_changes, read_json_file, strip_internal_fields, FileChangeSetBuilder,
    },
    models::WriteResult,
};
use serde_json::Value;
use std::path::Path;

pub fn save_variant_entity(
    mod_root: &str,
    previous_id: Option<&str>,
    previous_rel_path: Option<&str>,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    let next_id = validate_config_id(next_id, "无效装配 ID")?.to_string();
    let mod_root = Path::new(mod_root);
    let previous_id = previous_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效装配 ID").map(str::to_string))
        .transpose()?;
    let previous_rel_path = previous_rel_path.filter(|value| !value.trim().is_empty());
    let next_rel_path = variant_rel_path(&next_id);
    let renamed = previous_id.as_deref().is_some_and(|id| id != next_id);
    let target = mod_root.join(&next_rel_path);
    if renamed && target.exists() {
        return Err(AppError::message(format!(
            "装配目标已存在: {next_rel_path}"
        )));
    }

    let clean = strip_internal_fields(&data);
    let variant_file = build_variant_file(mod_root, &next_rel_path, &clean)?;
    if variant_file.variant_id != next_id {
        return Err(AppError::message(format!(
            "装配数据 variantId 与保存目标不一致: {}",
            variant_file.variant_id
        )));
    }

    let mut builder = FileChangeSetBuilder::new(mod_root);
    if renamed {
        let previous = previous_rel_path.ok_or_else(|| AppError::message("缺少旧装配路径"))?;
        require_variant_file_target(mod_root, previous, previous_id.as_deref().unwrap())?;
        builder.text_file(previous, None)?;
    }
    builder.text_file(&next_rel_path, Some(serde_json::to_string_pretty(&clean)?))?;
    let changes = builder.apply()?;

    Ok(WriteResult {
        invalidated_paths: invalidated_paths_for_changes(&changes),
        changes,
        key_map: Vec::new(),
        refreshed_entity: Some(serde_json::to_value(variant_file)?),
        warnings: Vec::new(),
    })
}

pub fn create_variant_entity(
    mod_root: &str,
    next_id: &str,
    data: Value,
) -> AppResult<WriteResult<Value>> {
    save_variant_entity(mod_root, None, None, next_id, data)
}

pub fn delete_variant_entity(
    mod_root: &str,
    variant_id: &str,
    rel_path: &str,
) -> AppResult<WriteResult> {
    validate_config_id(variant_id, "无效装配 ID")?;
    require_variant_file_target(Path::new(mod_root), rel_path, variant_id)?;
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    builder.text_file(rel_path, None)?;
    let changes = builder.apply()?;
    Ok(WriteResult {
        invalidated_paths: invalidated_paths_for_changes(&changes),
        changes,
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    })
}

fn require_variant_file_target(mod_root: &Path, rel_path: &str, variant_id: &str) -> AppResult<()> {
    validate_config_file_rel_path(rel_path, "data/variants", "variant", "装配路径无效")?;
    let data = read_json_file(&mod_root.join(rel_path))?;
    let file = build_variant_file(mod_root, rel_path, &data)?;
    if file.variant_id != variant_id {
        return Err(AppError::message(format!(
            "装配路径与实体 ID 不匹配: {rel_path}"
        )));
    }
    Ok(())
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
    fn variant_save_can_rename_file_with_undo_redo() {
        let root = temp_dir("variant_entity_rename");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/old.variant"),
            r#"{"variantId":"old","hullId":"hull"}"#,
        )
        .unwrap();

        let result = save_variant_entity(
            &root.to_string_lossy(),
            Some("old"),
            Some("data/variants/old.variant"),
            "new",
            serde_json::json!({"variantId": "new", "hullId": "hull", "weaponGroups": [{}]}),
        )
        .unwrap();

        let variant_file: crate::models::VariantFile =
            serde_json::from_value(result.refreshed_entity.clone().unwrap()).unwrap();
        assert!(!root.join("data/variants/old.variant").exists());
        assert!(root.join("data/variants/new.variant").exists());
        assert_eq!(variant_file.variant_id, "new");
        assert_eq!(variant_file.weapon_group_count, 1);

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert!(root.join("data/variants/old.variant").exists());
        assert!(!root.join("data/variants/new.variant").exists());

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
        .unwrap();
        let text = read_utf8_no_bom(&root.join("data/variants/new.variant")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"variantId\": \"new\""));
    }

    #[test]
    fn variant_delete_uses_file_history() {
        let root = temp_dir("variant_entity_delete");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/demo.variant"),
            r#"{"variantId":"demo","hullId":"hull"}"#,
        )
        .unwrap();

        let result = delete_variant_entity(
            &root.to_string_lossy(),
            "demo",
            "data/variants/demo.variant",
        )
        .unwrap();

        assert!(!root.join("data/variants/demo.variant").exists());
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes,
        )
        .unwrap();
        let text = read_utf8_no_bom(&root.join("data/variants/demo.variant")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"variantId\":\"demo\""));
    }

    #[test]
    fn variant_delete_rejects_rel_path_outside_variant_directory() {
        let root = temp_dir("variant_delete_rejects_external_rel_path");
        write_utf8_no_bom(&root.join("mod_info.json"), "{}").unwrap();

        let result = delete_variant_entity(&root.to_string_lossy(), "demo", "mod_info.json");

        let text = read_utf8_no_bom(&root.join("mod_info.json")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert_eq!(text, "{}");
    }

    #[test]
    fn variant_delete_requires_rel_path_entity_match() {
        let root = temp_dir("variant_delete_requires_matching_id");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/other.variant"),
            r#"{"variantId":"other","hullId":"hull"}"#,
        )
        .unwrap();

        let result = delete_variant_entity(
            &root.to_string_lossy(),
            "demo",
            "data/variants/other.variant",
        );

        let text = read_utf8_no_bom(&root.join("data/variants/other.variant")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(text.contains("\"variantId\":\"other\""));
    }

    #[test]
    fn variant_save_requires_data_id_to_match_target_id() {
        let root = temp_dir("variant_save_rejects_mismatched_data_id");

        let result = save_variant_entity(
            &root.to_string_lossy(),
            None,
            None,
            "new",
            serde_json::json!({"variantId": "other", "hullId": "hull"}),
        );

        let target_exists = root.join("data/variants/new.variant").exists();
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
