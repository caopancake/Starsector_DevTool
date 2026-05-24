use super::super::{
    cache::{load_core_ship_files, load_core_skin_files},
    model::{string_field, string_from_row, weapon_sprite_path, CoreSourceData, ProjectSession},
    sprites,
};
use crate::models::{ResourceRef, SkinFile};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::PathBuf};

pub(super) fn resource_data_url(
    session: &ProjectSession,
    resource: &ResourceRef,
) -> Option<String> {
    let root = if resource.source == "core" {
        session
            .manifest
            .starsector_root
            .as_ref()
            .map(|root| PathBuf::from(root).join("starsector-core"))
    } else {
        Some(PathBuf::from(&session.manifest.mod_root))
    }?;
    sprites::load_sprite_data_url_from_root(&root, &resource.rel_path)
        .ok()
        .flatten()
}

pub(super) fn resource_cache_key(resource: &ResourceRef) -> String {
    format!("{}:{}:{}", resource.source, resource.rel_path, resource.key)
}

pub(super) fn entity_resource_refs(
    session: &ProjectSession,
    kind: &str,
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    match kind {
        "ship" => {
            if let Some(sprite) = string_field(data, "spriteName") {
                refs.insert(
                    "sprite".to_string(),
                    resource_ref("mod", &sprite, kind, id, "sprite"),
                );
            }
        }
        "weapon" => {
            if let Some(sprite) = weapon_sprite_path(data) {
                refs.insert(
                    "sprite".to_string(),
                    resource_ref("mod", &sprite, kind, id, "sprite"),
                );
            }
        }
        "variant" => {
            if let Some(hull_id) = string_field(data, "hullId") {
                if let Some(resource) = hull_resource_ref(session, "mod", &hull_id) {
                    refs.insert("sprite".to_string(), resource);
                }
            }
        }
        "skin" => {
            if let Some(sprite) = string_field(data, "spriteName") {
                refs.insert(
                    "sprite".to_string(),
                    resource_ref("mod", &sprite, kind, id, "sprite"),
                );
            } else if let Some(base_hull_id) = string_field(data, "baseHullId") {
                if let Some(resource) = hull_resource_ref(session, "mod", &base_hull_id) {
                    refs.insert("sprite".to_string(), resource);
                }
            }
        }
        "faction" => {
            if let Some(logo) = string_field(data, "logo") {
                refs.insert(
                    "logo".to_string(),
                    resource_ref("mod", &logo, kind, id, "logo"),
                );
            }
            if let Some(crest) = string_field(data, "crest") {
                refs.insert(
                    "crest".to_string(),
                    resource_ref("mod", &crest, kind, id, "crest"),
                );
            }
        }
        "mission" => {
            if let Some(icon) = data
                .get("descriptor")
                .and_then(|descriptor| descriptor.get("icon"))
                .and_then(Value::as_str)
            {
                refs.insert(
                    "icon".to_string(),
                    resource_ref(
                        "mod",
                        &format!("data/missions/{id}/{icon}"),
                        "mission",
                        id,
                        "icon",
                    ),
                );
            }
        }
        _ => {}
    }
    refs
}

pub(super) fn table_row_resource_ref(
    session: &ProjectSession,
    table: &str,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    let id = string_from_row(row, "id")
        .or_else(|| string_from_row(row, "mission"))
        .unwrap_or_default();
    match table {
        "ships" => {
            if id.is_empty() {
                None
            } else {
                hull_resource_ref(session, "mod", &id)
            }
        }
        "weapons" => session
            .wpn_files
            .get(&id)
            .and_then(weapon_sprite_path)
            .map(|path| resource_ref("mod", &path, "weapon", &id, "sprite")),
        "wings" => string_from_row(row, "variant")
            .and_then(|variant_id| {
                session
                    .variant_files
                    .iter()
                    .find(|variant| variant.variant_id == variant_id)
            })
            .and_then(|variant| hull_resource_ref(session, "mod", &variant.hull_id)),
        "hullmods" | "shipSystems" | "industries" | "skills" | "abilities" | "commodities"
        | "specialItems" | "submarkets" | "marketConditions" => {
            row_icon_resource_ref("mod", table, row)
        }
        _ => None,
    }
}

pub(super) fn row_icon_resource_ref(
    source: &str,
    table: &str,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    let id = string_from_row(row, "id").unwrap_or_default();
    let rel_path = match table {
        "hullmods" => string_from_row(row, "sprite"),
        "shipSystems" => string_from_row(row, "icon"),
        "industries" => string_from_row(row, "image"),
        "skills" | "abilities" | "commodities" | "specialItems" | "submarkets"
        | "marketConditions" => string_from_row(row, "icon"),
        _ => None,
    }?;
    Some(resource_ref(source, &rel_path, table, &id, "icon"))
}

pub(super) fn hull_resource_ref(
    session: &ProjectSession,
    source: &str,
    hull_id: &str,
) -> Option<ResourceRef> {
    if source == "core" {
        let root = session.manifest.starsector_root.as_ref()?;
        let ships = load_core_ship_files(root).ok()?;
        if let Some(ship) = ships.get(hull_id) {
            return string_field(ship, "spriteName")
                .map(|path| resource_ref("core", &path, "ship", hull_id, "sprite"));
        }
        let skins = load_core_skin_files(root).ok()?;
        skins
            .iter()
            .find(|skin| skin.skin_hull_id == hull_id)
            .and_then(|skin| skin_resource_ref(source, &ships, skin))
    } else if let Some(ship) = session.ship_files.get(hull_id) {
        string_field(ship, "spriteName")
            .map(|path| resource_ref("mod", &path, "ship", hull_id, "sprite"))
    } else {
        session
            .skin_files
            .iter()
            .find(|skin| skin.skin_hull_id == hull_id)
            .and_then(|skin| skin_resource_ref(source, &session.ship_files, skin))
    }
}

pub(super) fn skin_resource_ref(
    source: &str,
    ship_files: &BTreeMap<String, Value>,
    skin: &SkinFile,
) -> Option<ResourceRef> {
    string_field(&skin.data, "spriteName")
        .map(|sprite| resource_ref(source, &sprite, "skin", &skin.skin_hull_id, "thumbnail"))
        .or_else(|| {
            ship_files
                .get(&skin.base_hull_id)
                .and_then(|ship| string_field(ship, "spriteName"))
                .map(|sprite| {
                    resource_ref(source, &sprite, "skin", &skin.skin_hull_id, "thumbnail")
                })
        })
}

pub(super) fn resource_ref(
    source: &str,
    rel_path: &str,
    owner_kind: &str,
    owner_id: &str,
    key: &str,
) -> ResourceRef {
    ResourceRef {
        source: source.to_string(),
        rel_path: rel_path.replace('\\', "/"),
        owner_kind: owner_kind.to_string(),
        owner_id: owner_id.to_string(),
        key: key.to_string(),
    }
}

pub(super) fn source_option_resource_ref(
    source: &str,
    table: &str,
    value: &str,
    row: &Map<String, Value>,
    context: Option<&CoreSourceData>,
    session: Option<&ProjectSession>,
) -> Option<ResourceRef> {
    match table {
        "ships" => session
            .and_then(|session| hull_resource_ref(session, source, value))
            .or_else(|| {
                context?
                    .ship_files
                    .get(value)
                    .and_then(|ship| string_field(ship, "spriteName"))
                    .map(|path| resource_ref(source, &path, "ship", value, "sprite"))
            }),
        "weapons" => context?
            .wpn_files
            .get(value)
            .and_then(weapon_sprite_path)
            .or_else(|| {
                session
                    .and_then(|session| session.wpn_files.get(value))
                    .and_then(weapon_sprite_path)
            })
            .map(|path| resource_ref(source, &path, "weapon", value, "sprite")),
        "wings" => string_from_row(row, "variant").and_then(|variant_id| {
            let hull_id = context?
                .variant_files
                .iter()
                .find(|variant| variant.variant_id == variant_id)
                .map(|variant| variant.hull_id.as_str())
                .or_else(|| {
                    session.and_then(|session| {
                        session
                            .variant_files
                            .iter()
                            .find(|variant| variant.variant_id == variant_id)
                            .map(|variant| variant.hull_id.as_str())
                    })
                })?;
            session.and_then(|session| hull_resource_ref(session, source, hull_id))
        }),
        _ => row_icon_resource_ref(source, table, row),
    }
}
