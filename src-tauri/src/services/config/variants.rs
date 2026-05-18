use crate::{
    errors::{AppError, AppResult},
    filesystem::strip_internal_fields,
    models::{DeleteVariantEntityPayload, VariantEntityPayload, VariantEntityResult, VariantFile},
    services::file_changes::FileChangeSetBuilder,
};
use serde_json::Value;
use std::path::Path;

use super::validate_config_id;

pub fn save_variant_entity_with_history(
    input: VariantEntityPayload,
) -> AppResult<VariantEntityResult> {
    let next_id = validate_config_id(&input.next_id, "无效装配 ID")?.to_string();
    let mod_root = Path::new(&input.mod_root);
    let previous_id = input
        .previous_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效装配 ID").map(str::to_string))
        .transpose()?;
    let previous_rel_path = input
        .previous_rel_path
        .as_deref()
        .filter(|value| !value.trim().is_empty());
    let next_rel_path = variant_rel_path(&next_id);
    let renamed = previous_id.as_deref().is_some_and(|id| id != next_id);
    let target = mod_root.join(&next_rel_path);
    if renamed && target.exists() {
        return Err(AppError::message(format!(
            "装配目标已存在: {next_rel_path}"
        )));
    }

    let clean = strip_internal_fields(&input.data);
    let variant_file = build_variant_file(mod_root, &next_rel_path, &clean)?;

    let mut builder = FileChangeSetBuilder::new(mod_root);
    if renamed {
        let previous = previous_rel_path.ok_or_else(|| AppError::message("缺少旧装配路径"))?;
        builder.text_file(previous, None)?;
    }
    builder.text_file(&next_rel_path, Some(serde_json::to_string_pretty(&clean)?))?;
    let changes = builder.apply()?;

    Ok(VariantEntityResult {
        changes,
        variant_file,
    })
}

pub fn create_variant_entity_with_history(
    input: VariantEntityPayload,
) -> AppResult<VariantEntityResult> {
    save_variant_entity_with_history(VariantEntityPayload {
        previous_id: None,
        previous_rel_path: None,
        ..input
    })
}

pub fn delete_variant_entity_with_history(
    input: DeleteVariantEntityPayload,
) -> AppResult<Vec<crate::models::FileChangeRecord>> {
    validate_config_id(&input.variant_id, "无效装配 ID")?;
    let mut builder = FileChangeSetBuilder::new(Path::new(&input.mod_root));
    builder.text_file(input.rel_path, None)?;
    builder.apply()
}

fn build_variant_file(mod_root: &Path, rel_path: &str, data: &Value) -> AppResult<VariantFile> {
    let variant_id = required_string(data, "variantId")?;
    let hull_id = required_string(data, "hullId")?;
    Ok(VariantFile {
        variant_id,
        hull_id,
        path: mod_root.join(rel_path).to_string_lossy().to_string(),
        rel_path: rel_path.to_string(),
        weapon_group_count: array_len(data.get("weaponGroups")),
        hull_mod_count: array_len(data.get("hullMods")),
        perma_mod_count: array_len(data.get("permaMods")),
        wing_count: array_len(data.get("wings")),
        data: data.clone(),
    })
}

fn variant_rel_path(variant_id: &str) -> String {
    format!("data/variants/{variant_id}.variant")
}

fn required_string(value: &Value, key: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| AppError::message(format!("装配缺少 {key}")))
}

fn array_len(value: Option<&Value>) -> usize {
    value.and_then(Value::as_array).map_or(0, Vec::len)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        filesystem::{read_utf8_no_bom, write_utf8_no_bom},
        models::ApplyFileChangeSetPayload,
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

        let result = save_variant_entity_with_history(VariantEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            previous_id: Some("old".to_string()),
            previous_rel_path: Some("data/variants/old.variant".to_string()),
            next_id: "new".to_string(),
            data: serde_json::json!({"variantId": "new", "hullId": "hull", "weaponGroups": [{}]}),
        })
        .unwrap();

        assert!(!root.join("data/variants/old.variant").exists());
        assert!(root.join("data/variants/new.variant").exists());
        assert_eq!(result.variant_file.variant_id, "new");
        assert_eq!(result.variant_file.weapon_group_count, 1);

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert!(root.join("data/variants/old.variant").exists());
        assert!(!root.join("data/variants/new.variant").exists());

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
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

        let changes = delete_variant_entity_with_history(DeleteVariantEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            variant_id: "demo".to_string(),
            rel_path: "data/variants/demo.variant".to_string(),
        })
        .unwrap();

        assert!(!root.join("data/variants/demo.variant").exists());
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes,
        })
        .unwrap();
        let text = read_utf8_no_bom(&root.join("data/variants/demo.variant")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(text.contains("\"variantId\":\"demo\""));
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
