use crate::{
    errors::{AppError, AppResult},
    filesystem::strip_internal_fields,
    models::{DeleteSkinEntityPayload, SkinEntityPayload, SkinEntityResult, SkinFile},
    services::file_changes::FileChangeSetBuilder,
};
use serde_json::Value;
use std::path::Path;

use super::validate_config_id;

pub fn save_skin_entity_with_history(input: SkinEntityPayload) -> AppResult<SkinEntityResult> {
    let next_id = validate_config_id(&input.next_id, "无效舰船皮肤 ID")?.to_string();
    let mod_root = Path::new(&input.mod_root);
    let previous_id = input
        .previous_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效舰船皮肤 ID").map(str::to_string))
        .transpose()?;
    let previous_rel_path = input
        .previous_rel_path
        .as_deref()
        .filter(|value| !value.trim().is_empty());
    let next_rel_path = skin_rel_path(&next_id);
    let renamed = previous_id.as_deref().is_some_and(|id| id != next_id);
    let target = mod_root.join(&next_rel_path);
    if renamed && target.exists() {
        return Err(AppError::message(format!(
            "舰船皮肤目标已存在: {next_rel_path}"
        )));
    }

    let clean = strip_internal_fields(&input.data);
    let skin_file = build_skin_file(mod_root, &next_rel_path, &clean)?;

    let mut builder = FileChangeSetBuilder::new(mod_root);
    if renamed {
        let previous = previous_rel_path.ok_or_else(|| AppError::message("缺少旧舰船皮肤路径"))?;
        builder.text_file(previous, None)?;
    }
    builder.text_file(&next_rel_path, Some(serde_json::to_string_pretty(&clean)?))?;
    let changes = builder.apply()?;

    Ok(SkinEntityResult { changes, skin_file })
}

pub fn create_skin_entity_with_history(input: SkinEntityPayload) -> AppResult<SkinEntityResult> {
    save_skin_entity_with_history(SkinEntityPayload {
        previous_id: None,
        previous_rel_path: None,
        ..input
    })
}

pub fn delete_skin_entity_with_history(
    input: DeleteSkinEntityPayload,
) -> AppResult<Vec<crate::models::FileChangeRecord>> {
    validate_config_id(&input.skin_hull_id, "无效舰船皮肤 ID")?;
    let mut builder = FileChangeSetBuilder::new(Path::new(&input.mod_root));
    builder.text_file(input.rel_path, None)?;
    builder.apply()
}

fn build_skin_file(mod_root: &Path, rel_path: &str, data: &Value) -> AppResult<SkinFile> {
    let skin_hull_id = required_string(data, "skinHullId")?;
    let base_hull_id = required_string(data, "baseHullId")?;
    Ok(SkinFile {
        skin_hull_id,
        base_hull_id,
        path: mod_root.join(rel_path).to_string_lossy().to_string(),
        rel_path: rel_path.to_string(),
        built_in_mod_count: array_len(data.get("builtInMods")),
        built_in_weapon_count: object_len(data.get("builtInWeapons")),
        built_in_wing_count: array_len(data.get("builtInWings")),
        weapon_slot_change_count: object_len(data.get("weaponSlotChanges")),
        engine_slot_change_count: object_len(data.get("engineSlotChanges")),
        data: data.clone(),
    })
}

fn skin_rel_path(skin_hull_id: &str) -> String {
    format!("data/hulls/skins/{skin_hull_id}.skin")
}

fn required_string(value: &Value, key: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| AppError::message(format!("舰船皮肤缺少 {key}")))
}

fn array_len(value: Option<&Value>) -> usize {
    value.and_then(Value::as_array).map_or(0, Vec::len)
}

fn object_len(value: Option<&Value>) -> usize {
    value
        .and_then(Value::as_object)
        .map_or(0, |object| object.len())
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
    fn skin_save_can_rename_file_with_undo_redo() {
        let root = temp_dir("skin_entity_rename");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/old.skin"),
            r#"{"skinHullId":"old","baseHullId":"base"}"#,
        )
        .unwrap();

        let result = save_skin_entity_with_history(SkinEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            previous_id: Some("old".to_string()),
            previous_rel_path: Some("data/hulls/skins/old.skin".to_string()),
            next_id: "new".to_string(),
            data: serde_json::json!({
                "skinHullId": "new",
                "baseHullId": "base",
                "builtInWeapons": {"WS 001": "demo_weapon"}
            }),
        })
        .unwrap();

        assert!(!root.join("data/hulls/skins/old.skin").exists());
        assert!(root.join("data/hulls/skins/new.skin").exists());
        assert_eq!(result.skin_file.skin_hull_id, "new");
        assert_eq!(result.skin_file.built_in_weapon_count, 1);

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert!(root.join("data/hulls/skins/old.skin").exists());
        assert!(!root.join("data/hulls/skins/new.skin").exists());

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
        .unwrap();
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

        let changes = delete_skin_entity_with_history(DeleteSkinEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            skin_hull_id: "demo".to_string(),
            rel_path: "data/hulls/skins/demo.skin".to_string(),
        })
        .unwrap();

        assert!(!root.join("data/hulls/skins/demo.skin").exists());
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes,
        })
        .unwrap();
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
