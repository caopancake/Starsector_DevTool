use crate::{
    errors::{AppError, AppResult},
    models::{SkinFile, VariantFile},
};
use serde_json::Value;
use std::path::{Component, Path};

pub fn validate_config_id<'a>(id: &'a str, message: &str) -> AppResult<&'a str> {
    let clean = id.trim();
    if !is_config_entity_id(clean) {
        return Err(AppError::message(message));
    }
    Ok(clean)
}

pub fn validate_config_file_rel_path(
    rel_path: &str,
    root_dir: &str,
    extension: &str,
    message: &str,
) -> AppResult<()> {
    let path = Path::new(rel_path);
    if path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        || path.extension().and_then(|value| value.to_str()) != Some(extension)
        || !path_starts_with_dir(path, root_dir)
    {
        return Err(AppError::message(format!("{message}: {rel_path}")));
    }
    Ok(())
}

fn path_starts_with_dir(path: &Path, root_dir: &str) -> bool {
    let mut path_components = path.components();
    for root_component in Path::new(root_dir).components() {
        if path_components.next() != Some(root_component) {
            return false;
        }
    }
    true
}

fn is_config_entity_id(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_alphanumeric()
        && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' || ch == '-')
}

pub fn build_variant_file(mod_root: &Path, rel_path: &str, data: &Value) -> AppResult<VariantFile> {
    let variant_id = required_string(data, "variantId", "装配")?;
    let hull_id = required_string(data, "hullId", "装配")?;
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

pub fn build_skin_file(mod_root: &Path, rel_path: &str, data: &Value) -> AppResult<SkinFile> {
    let skin_hull_id = required_string(data, "skinHullId", "舰船皮肤")?;
    let base_hull_id = required_string(data, "baseHullId", "舰船皮肤")?;
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

pub fn variant_rel_path(variant_id: &str) -> String {
    format!("data/variants/{variant_id}.variant")
}

pub fn skin_rel_path(skin_hull_id: &str) -> String {
    format!("data/hulls/skins/{skin_hull_id}.skin")
}

fn required_string(value: &Value, key: &str, display_name: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| AppError::message(format!("{display_name}缺少 {key}")))
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

    #[test]
    fn config_id_accepts_portable_ascii_identifier_segments() {
        assert_eq!(
            validate_config_id(" demo_id-01.alpha ", "invalid").unwrap(),
            "demo_id-01.alpha"
        );
    }

    #[test]
    fn config_id_rejects_non_identifier_path_segments() {
        for id in [
            "", ".", "..", "a/b", "a\\b", "a b", "-demo", "_demo", "demo:bad",
        ] {
            assert!(validate_config_id(id, "invalid").is_err(), "{id}");
        }
    }

    #[test]
    fn config_file_rel_path_requires_declared_root_and_extension() {
        validate_config_file_rel_path(
            "data/variants/nested/demo.variant",
            "data/variants",
            "variant",
            "invalid",
        )
        .unwrap();

        for path in [
            "mod_info.json",
            "data/variants/../demo.variant",
            "data/variants/demo.skin",
            "/data/variants/demo.variant",
        ] {
            assert!(
                validate_config_file_rel_path(path, "data/variants", "variant", "invalid").is_err(),
                "{path}"
            );
        }
    }
}
