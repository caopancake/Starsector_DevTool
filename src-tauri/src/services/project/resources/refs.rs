use super::super::{
    model::{string_field, ProjectSession, WEAPON_SPRITE_FIELDS},
    table_definitions::hull_resource_ref,
};
use super::sprites;
use crate::errors::{AppError, AppResult};
use crate::models::{ResourceOwnerKind, ResourceRef, ResourceSource, SkinFile};
use serde_json::{json, Value};
use std::{collections::BTreeMap, path::PathBuf};

pub(in crate::services::project) fn resource_data_url(
    session: &ProjectSession,
    resource: &ResourceRef,
) -> AppResult<Option<String>> {
    match resource.source {
        ResourceSource::Core => {
            let root = session
                .manifest
                .starsector_root
                .as_ref()
                .map(|root| PathBuf::from(root).join("starsector-core"))
                .ok_or_else(|| AppError::message("core resource requires starsector root"))?;
            sprites::load_sprite_data_url_from_root(&root, &resource.rel_path)
        }
        ResourceSource::Mod => {
            let mod_root = PathBuf::from(&session.manifest.mod_root);
            let core_dir = session
                .manifest
                .starsector_root
                .as_ref()
                .map(|root| PathBuf::from(root).join("starsector-core"));
            sprites::load_sprite_data_url(&mod_root, core_dir.as_deref(), &resource.rel_path)
        }
    }
}

pub(in crate::services::project) fn resource_cache_key(resource: &ResourceRef) -> String {
    json!([
        resource.source.as_str(),
        resource.rel_path,
        resource.owner_kind,
        resource.owner_id,
        resource.key
    ])
    .to_string()
}

pub(in crate::services::project) fn ship_resource_refs(
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    if let Some(sprite) = string_field(data, "spriteName") {
        refs.insert(
            "sprite".to_string(),
            resource_ref(
                ResourceSource::Mod,
                &sprite,
                ResourceOwnerKind::Ship,
                id,
                "sprite",
            ),
        );
    }
    refs
}

pub(in crate::services::project) fn weapon_resource_refs(
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    for field in WEAPON_SPRITE_FIELDS {
        if let Some(sprite) = string_field(data, field) {
            refs.insert(
                field.to_string(),
                resource_ref(
                    ResourceSource::Mod,
                    &sprite,
                    ResourceOwnerKind::Weapon,
                    id,
                    field,
                ),
            );
        }
    }
    refs
}

pub(in crate::services::project) fn projectile_resource_refs(
    _id: &str,
    _data: &Value,
) -> BTreeMap<String, ResourceRef> {
    BTreeMap::new()
}

pub(in crate::services::project) fn system_resource_refs(
    _id: &str,
    _data: &Value,
) -> BTreeMap<String, ResourceRef> {
    BTreeMap::new()
}

pub(in crate::services::project) fn variant_resource_refs(
    session: &ProjectSession,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    if let Some(hull_id) = string_field(data, "hullId") {
        if let Ok(Some(resource)) = hull_resource_ref(session, ResourceSource::Mod, &hull_id) {
            refs.insert("sprite".to_string(), resource);
        }
    }
    refs
}

pub(in crate::services::project) fn skin_entity_resource_refs(
    session: &ProjectSession,
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    if let Some(sprite) = string_field(data, "spriteName") {
        refs.insert(
            "sprite".to_string(),
            resource_ref(
                ResourceSource::Mod,
                &sprite,
                ResourceOwnerKind::Skin,
                id,
                "sprite",
            ),
        );
    } else if let Some(base_hull_id) = string_field(data, "baseHullId") {
        if let Ok(Some(resource)) = hull_resource_ref(session, ResourceSource::Mod, &base_hull_id) {
            refs.insert("sprite".to_string(), resource);
        }
    }
    refs
}

pub(in crate::services::project) fn faction_resource_refs(
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    if let Some(logo) = string_field(data, "logo") {
        refs.insert(
            "logo".to_string(),
            resource_ref(
                ResourceSource::Mod,
                &logo,
                ResourceOwnerKind::Faction,
                id,
                "logo",
            ),
        );
    }
    if let Some(crest) = string_field(data, "crest") {
        refs.insert(
            "crest".to_string(),
            resource_ref(
                ResourceSource::Mod,
                &crest,
                ResourceOwnerKind::Faction,
                id,
                "crest",
            ),
        );
    }
    refs
}

pub(in crate::services::project) fn mission_resource_refs(
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    if let Some(icon) = data
        .get("descriptor")
        .and_then(|descriptor| descriptor.get("icon"))
        .and_then(Value::as_str)
    {
        refs.insert(
            "icon".to_string(),
            resource_ref(
                ResourceSource::Mod,
                &format!("data/missions/{id}/{icon}"),
                ResourceOwnerKind::Mission,
                id,
                "icon",
            ),
        );
    }
    refs
}

pub(in crate::services::project) fn skin_resource_ref(
    source: ResourceSource,
    ship_files: &BTreeMap<String, Value>,
    skin: &SkinFile,
) -> Option<ResourceRef> {
    string_field(&skin.data, "spriteName")
        .map(|sprite| {
            resource_ref(
                source,
                &sprite,
                ResourceOwnerKind::Skin,
                &skin.skin_hull_id,
                "thumbnail",
            )
        })
        .or_else(|| {
            ship_files
                .get(&skin.base_hull_id)
                .and_then(|ship| string_field(ship, "spriteName"))
                .map(|sprite| {
                    resource_ref(
                        source,
                        &sprite,
                        ResourceOwnerKind::Skin,
                        &skin.skin_hull_id,
                        "thumbnail",
                    )
                })
        })
}

pub(in crate::services::project) fn resource_ref(
    source: ResourceSource,
    rel_path: &str,
    owner_kind: ResourceOwnerKind,
    owner_id: &str,
    key: &str,
) -> ResourceRef {
    ResourceRef {
        source,
        rel_path: rel_path.replace('\\', "/"),
        owner_kind,
        owner_id: owner_id.to_string(),
        key: key.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::project::table_definitions;
    use serde_json::Map;

    #[test]
    fn resource_cache_key_uses_complete_resource_identity() {
        let ship = resource_ref(
            ResourceSource::Mod,
            "graphics/shared/icon.png",
            ResourceOwnerKind::Ship,
            "ship",
            "icon",
        );
        let weapon = resource_ref(
            ResourceSource::Mod,
            "graphics/shared/icon.png",
            ResourceOwnerKind::Weapon,
            "weapon",
            "icon",
        );

        assert_ne!(resource_cache_key(&ship), resource_cache_key(&weapon));
    }

    #[test]
    fn resource_cache_key_preserves_structured_field_boundaries() {
        let left = resource_ref(
            ResourceSource::Mod,
            "graphics/shared/icon.png",
            ResourceOwnerKind::Ship,
            "owner:with",
            "separator",
        );
        let right = resource_ref(
            ResourceSource::Mod,
            "graphics/shared/icon.png",
            ResourceOwnerKind::Ship,
            "owner",
            "with:separator",
        );

        assert_ne!(resource_cache_key(&left), resource_cache_key(&right));
    }

    #[test]
    fn row_icon_resource_ref_requires_owner_id() {
        let mut row = Map::new();
        row.insert(
            "icon".to_string(),
            Value::String("graphics/icons/skill.png".to_string()),
        );

        let resource = table_definitions::csv_table_icon_resource_ref(
            ResourceSource::Mod,
            crate::models::CsvTableKey::Skills,
            &row,
        );

        assert!(resource.is_none());
    }
}
