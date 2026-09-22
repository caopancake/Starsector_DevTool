use super::model::{ProjectSession, WEAPON_SPRITE_FIELDS, string_field};
use super::resources::resource_ref;
use super::table_definitions::hull_resource_ref;
use crate::models::{ResourceOwnerKind, ResourceRef, ResourceSource};
use serde_json::Value;
use std::collections::BTreeMap;

pub(super) fn ship_resource_refs(id: &str, data: &Value) -> BTreeMap<String, ResourceRef> {
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

pub(super) fn weapon_resource_refs(id: &str, data: &Value) -> BTreeMap<String, ResourceRef> {
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

pub(super) fn projectile_resource_refs(_id: &str, _data: &Value) -> BTreeMap<String, ResourceRef> {
    BTreeMap::new()
}

pub(super) fn system_resource_refs(_id: &str, _data: &Value) -> BTreeMap<String, ResourceRef> {
    BTreeMap::new()
}

pub(super) fn variant_resource_refs(
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

pub(super) fn skin_entity_resource_refs(
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

pub(super) fn faction_resource_refs(id: &str, data: &Value) -> BTreeMap<String, ResourceRef> {
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

pub(super) fn mission_resource_refs(id: &str, data: &Value) -> BTreeMap<String, ResourceRef> {
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
