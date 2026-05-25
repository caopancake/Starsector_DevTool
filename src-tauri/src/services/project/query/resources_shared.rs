use super::super::{
    cache::{load_core_ship_files, load_core_skin_files},
    model::{
        string_field, string_from_row, weapon_sprite_path, CoreSourceData, ProjectSession,
        WEAPON_SPRITE_FIELDS,
    },
    sprites,
};
use crate::errors::{AppError, AppResult};
use crate::models::{
    CsvTableKey, EntityKind, ResourceOwnerKind, ResourceRef, ResourceSource, SkinFile,
};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::PathBuf};

pub(super) fn resource_data_url(
    session: &ProjectSession,
    resource: &ResourceRef,
) -> AppResult<Option<String>> {
    let root = match resource.source {
        ResourceSource::Core => session
            .manifest
            .starsector_root
            .as_ref()
            .map(|root| PathBuf::from(root).join("starsector-core"))
            .ok_or_else(|| AppError::message("core resource requires starsector root"))?,
        ResourceSource::Mod => PathBuf::from(&session.manifest.mod_root),
    };
    sprites::load_sprite_data_url_from_root(&root, &resource.rel_path)
}

pub(super) fn resource_cache_key(resource: &ResourceRef) -> String {
    format!(
        "{}:{}:{:?}:{}:{}",
        resource.source.as_str(),
        resource.rel_path,
        resource.owner_kind,
        resource.owner_id,
        resource.key
    )
}

pub(super) fn entity_resource_refs(
    session: &ProjectSession,
    kind: EntityKind,
    id: &str,
    data: &Value,
) -> BTreeMap<String, ResourceRef> {
    let mut refs = BTreeMap::new();
    match kind {
        EntityKind::Ship => {
            if let Some(sprite) = string_field(data, "spriteName") {
                refs.insert(
                    "sprite".to_string(),
                    resource_ref(ResourceSource::Mod, &sprite, kind.into(), id, "sprite"),
                );
            }
        }
        EntityKind::Weapon => {
            for field in WEAPON_SPRITE_FIELDS {
                if let Some(sprite) = string_field(data, field) {
                    refs.insert(
                        field.to_string(),
                        resource_ref(ResourceSource::Mod, &sprite, kind.into(), id, field),
                    );
                }
            }
        }
        EntityKind::Variant => {
            if let Some(hull_id) = string_field(data, "hullId") {
                if let Some(resource) = mod_hull_resource_ref(session, &hull_id) {
                    refs.insert("sprite".to_string(), resource);
                }
            }
        }
        EntityKind::Skin => {
            if let Some(sprite) = string_field(data, "spriteName") {
                refs.insert(
                    "sprite".to_string(),
                    resource_ref(ResourceSource::Mod, &sprite, kind.into(), id, "sprite"),
                );
            } else if let Some(base_hull_id) = string_field(data, "baseHullId") {
                if let Some(resource) = mod_hull_resource_ref(session, &base_hull_id) {
                    refs.insert("sprite".to_string(), resource);
                }
            }
        }
        EntityKind::Faction => {
            if let Some(logo) = string_field(data, "logo") {
                refs.insert(
                    "logo".to_string(),
                    resource_ref(ResourceSource::Mod, &logo, kind.into(), id, "logo"),
                );
            }
            if let Some(crest) = string_field(data, "crest") {
                refs.insert(
                    "crest".to_string(),
                    resource_ref(ResourceSource::Mod, &crest, kind.into(), id, "crest"),
                );
            }
        }
        EntityKind::Mission => {
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
        }
        _ => {}
    }
    refs
}

pub(super) fn table_row_resource_ref(
    session: &ProjectSession,
    table: CsvTableKey,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    let id = string_from_row(row, "id")
        .or_else(|| string_from_row(row, "mission"))
        .unwrap_or_default();
    match table {
        CsvTableKey::Ships => {
            if id.is_empty() {
                None
            } else {
                mod_hull_resource_ref(session, &id)
            }
        }
        CsvTableKey::Weapons => session
            .weapon_specs
            .get(&id)
            .and_then(weapon_sprite_path)
            .map(|path| {
                resource_ref(
                    ResourceSource::Mod,
                    &path,
                    ResourceOwnerKind::Weapon,
                    &id,
                    "sprite",
                )
            }),
        CsvTableKey::Wings => string_from_row(row, "variant")
            .and_then(|variant_id| {
                session
                    .variant_files
                    .iter()
                    .find(|variant| variant.variant_id == variant_id)
            })
            .and_then(|variant| mod_hull_resource_ref(session, &variant.hull_id)),
        CsvTableKey::Hullmods
        | CsvTableKey::ShipSystems
        | CsvTableKey::Industries
        | CsvTableKey::Skills
        | CsvTableKey::Abilities
        | CsvTableKey::Commodities
        | CsvTableKey::SpecialItems
        | CsvTableKey::Submarkets
        | CsvTableKey::MarketConditions => row_icon_resource_ref(ResourceSource::Mod, table, row),
        _ => None,
    }
}

pub(super) fn row_icon_resource_ref(
    source: ResourceSource,
    table: CsvTableKey,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    let id = string_from_row(row, "id")?;
    let rel_path = string_from_row(row, table_icon_field(table)?)?;
    Some(resource_ref(
        source,
        &rel_path,
        table_resource_owner_kind(table)?,
        &id,
        "icon",
    ))
}

pub(super) fn hull_resource_ref(
    session: &ProjectSession,
    source: ResourceSource,
    hull_id: &str,
) -> AppResult<Option<ResourceRef>> {
    if source == ResourceSource::Core {
        let root =
            session.manifest.starsector_root.as_ref().ok_or_else(|| {
                AppError::message("core resource reference requires starsector root")
            })?;
        let ships = load_core_ship_files(root)?;
        if let Some(ship) = ships.get(hull_id) {
            return Ok(string_field(ship, "spriteName").map(|path| {
                resource_ref(
                    ResourceSource::Core,
                    &path,
                    ResourceOwnerKind::Ship,
                    hull_id,
                    "sprite",
                )
            }));
        }
        let skins = load_core_skin_files(root)?;
        Ok(skins
            .iter()
            .find(|skin| skin.skin_hull_id == hull_id)
            .and_then(|skin| skin_resource_ref(source, &ships, skin)))
    } else {
        Ok(mod_hull_resource_ref(session, hull_id))
    }
}

fn mod_hull_resource_ref(session: &ProjectSession, hull_id: &str) -> Option<ResourceRef> {
    if let Some(ship) = session.ship_files.get(hull_id) {
        string_field(ship, "spriteName").map(|path| {
            resource_ref(
                ResourceSource::Mod,
                &path,
                ResourceOwnerKind::Ship,
                hull_id,
                "sprite",
            )
        })
    } else {
        session
            .skin_files
            .iter()
            .find(|skin| skin.skin_hull_id == hull_id)
            .and_then(|skin| skin_resource_ref(ResourceSource::Mod, &session.ship_files, skin))
    }
}

pub(super) fn skin_resource_ref(
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

pub(super) fn resource_ref(
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

fn table_icon_field(table: CsvTableKey) -> Option<&'static str> {
    match table {
        CsvTableKey::Hullmods => Some("sprite"),
        CsvTableKey::Industries => Some("image"),
        CsvTableKey::ShipSystems
        | CsvTableKey::Skills
        | CsvTableKey::Abilities
        | CsvTableKey::Commodities
        | CsvTableKey::SpecialItems
        | CsvTableKey::Submarkets
        | CsvTableKey::MarketConditions => Some("icon"),
        _ => None,
    }
}

fn table_resource_owner_kind(table: CsvTableKey) -> Option<ResourceOwnerKind> {
    match table {
        CsvTableKey::Hullmods => Some(ResourceOwnerKind::Hullmods),
        CsvTableKey::ShipSystems => Some(ResourceOwnerKind::ShipSystems),
        CsvTableKey::Industries => Some(ResourceOwnerKind::Industries),
        CsvTableKey::Skills => Some(ResourceOwnerKind::Skills),
        CsvTableKey::Abilities => Some(ResourceOwnerKind::Abilities),
        CsvTableKey::Commodities => Some(ResourceOwnerKind::Commodities),
        CsvTableKey::SpecialItems => Some(ResourceOwnerKind::SpecialItems),
        CsvTableKey::Submarkets => Some(ResourceOwnerKind::Submarkets),
        CsvTableKey::MarketConditions => Some(ResourceOwnerKind::MarketConditions),
        _ => None,
    }
}

pub(super) fn source_option_resource_ref(
    source: ResourceSource,
    table: CsvTableKey,
    value: &str,
    row: &Map<String, Value>,
    context: Option<&CoreSourceData>,
    session: Option<&ProjectSession>,
) -> AppResult<Option<ResourceRef>> {
    match table {
        CsvTableKey::Ships => {
            if let Some(session) = session {
                if let Some(resource) = hull_resource_ref(session, source, value)? {
                    return Ok(Some(resource));
                }
            }
            Ok(context
                .and_then(|context| {
                    context
                        .ship_files
                        .get(value)
                        .and_then(|ship| string_field(ship, "spriteName"))
                })
                .map(|path| resource_ref(source, &path, ResourceOwnerKind::Ship, value, "sprite")))
        }
        CsvTableKey::Weapons => Ok(context
            .and_then(|context| context.weapon_specs.get(value).and_then(weapon_sprite_path))
            .or_else(|| {
                session
                    .and_then(|session| session.weapon_specs.get(value))
                    .and_then(weapon_sprite_path)
            })
            .map(|path| resource_ref(source, &path, ResourceOwnerKind::Weapon, value, "sprite"))),
        CsvTableKey::Wings => {
            let Some(variant_id) = string_from_row(row, "variant") else {
                return Ok(None);
            };
            let hull_id = context
                .and_then(|context| {
                    context
                        .variant_files
                        .iter()
                        .find(|variant| variant.variant_id == variant_id)
                        .map(|variant| variant.hull_id.as_str())
                })
                .or_else(|| {
                    session.and_then(|session| {
                        session
                            .variant_files
                            .iter()
                            .find(|variant| variant.variant_id == variant_id)
                            .map(|variant| variant.hull_id.as_str())
                    })
                });
            match (session, hull_id) {
                (Some(session), Some(hull_id)) => hull_resource_ref(session, source, hull_id),
                _ => Ok(None),
            }
        }
        _ => Ok(row_icon_resource_ref(source, table, row)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn row_icon_resource_ref_requires_owner_id() {
        let mut row = Map::new();
        row.insert(
            "icon".to_string(),
            Value::String("graphics/icons/skill.png".to_string()),
        );

        let resource = row_icon_resource_ref(ResourceSource::Mod, CsvTableKey::Skills, &row);

        assert!(resource.is_none());
    }
}
