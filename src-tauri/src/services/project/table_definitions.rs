use super::{
    cache::{load_core_ship_files, load_core_skin_files},
    model::{string_field, string_from_row, weapon_sprite_path, CoreSourceData, ProjectSession},
    resources::{resource_ref, skin_resource_ref},
};
use crate::{
    errors::AppResult,
    models::{CsvTableKey, EntitySummaries, ResourceOwnerKind, ResourceRef, ResourceSource},
};
use serde_json::{Map, Value};

type CsvRowResourceExtractor = fn(
    &ProjectSession,
    ResourceSource,
    CsvTableKey,
    &Map<String, Value>,
) -> AppResult<Option<ResourceRef>>;
type CsvSourceResourceExtractor = fn(
    ResourceSource,
    CsvTableKey,
    &str,
    &Map<String, Value>,
    Option<&CoreSourceData>,
    &ProjectSession,
) -> AppResult<Option<ResourceRef>>;
type CsvSourceDisplayNameExtractor = fn(
    ResourceSource,
    CsvTableKey,
    &str,
    &Map<String, Value>,
    Option<&CoreSourceData>,
    &ProjectSession,
) -> AppResult<Option<String>>;

pub(super) struct ProjectCsvTableDefinition {
    pub key: CsvTableKey,
    pub rel_path: &'static str,
    pub entity_id_field: &'static str,
    pub entity_summary: Option<fn(&EntitySummaries) -> usize>,
    pub supports_faction_filter: bool,
    pub core_source_requirements: CoreSourceRequirements,
    pub resource_owner: Option<ResourceOwnerKind>,
    pub icon_field: Option<&'static str>,
    pub row_resource: CsvRowResourceExtractor,
    pub source_resource: CsvSourceResourceExtractor,
    pub source_display_name: CsvSourceDisplayNameExtractor,
}

#[derive(Clone, Copy)]
pub(super) struct CoreSourceRequirements {
    pub ships: bool,
    pub weapons: bool,
    pub variants: bool,
}

pub(super) fn csv_table_definitions() -> &'static [ProjectCsvTableDefinition] {
    &CSV_TABLE_DEFINITIONS
}

pub(super) fn csv_table_definition(table: CsvTableKey) -> &'static ProjectCsvTableDefinition {
    csv_table_definitions()
        .iter()
        .find(|definition| definition.key == table)
        .expect("registered csv table")
}

pub(super) fn csv_table_definition_by_key(
    table: &str,
) -> Option<&'static ProjectCsvTableDefinition> {
    csv_table_definitions()
        .iter()
        .find(|definition| definition.key.as_str() == table)
}

pub(super) fn csv_table_entity_id_field(table: CsvTableKey) -> &'static str {
    csv_table_definition(table).entity_id_field
}

pub(super) fn csv_table_supports_faction_filter(table: CsvTableKey) -> bool {
    csv_table_definition(table).supports_faction_filter
}

pub(super) fn csv_table_entity_summary(
    table: CsvTableKey,
    summaries: &EntitySummaries,
) -> Option<usize> {
    csv_table_definition(table)
        .entity_summary
        .map(|summary| summary(summaries))
}

pub(super) fn csv_table_row_resource_ref(
    session: &ProjectSession,
    table: CsvTableKey,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    (csv_table_definition(table).row_resource)(session, ResourceSource::Mod, table, row)
        .ok()
        .flatten()
}

pub(super) fn csv_table_source_resource_ref(
    source: ResourceSource,
    table: CsvTableKey,
    value: &str,
    row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    (csv_table_definition(table).source_resource)(source, table, value, row, core_data, session)
}

pub(super) fn csv_table_source_display_name(
    source: ResourceSource,
    table: CsvTableKey,
    value: &str,
    row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<String>> {
    (csv_table_definition(table).source_display_name)(source, table, value, row, core_data, session)
}

pub(super) fn csv_table_icon_resource_ref(
    source: ResourceSource,
    table: CsvTableKey,
    row: &Map<String, Value>,
) -> Option<ResourceRef> {
    let definition = csv_table_definition(table);
    let owner = definition.resource_owner?;
    let id = string_from_row(row, definition.entity_id_field)?;
    let rel_path = string_from_row(row, definition.icon_field?)?;
    Some(resource_ref(source, &rel_path, owner, &id, "icon"))
}

const CSV_TABLE_DEFINITIONS: [ProjectCsvTableDefinition; 14] = [
    ProjectCsvTableDefinition {
        key: CsvTableKey::Ships,
        rel_path: "data/hulls/ship_data.csv",
        entity_id_field: "id",
        entity_summary: Some(|summaries| summaries.ships),
        supports_faction_filter: true,
        core_source_requirements: CoreSourceRequirements {
            ships: true,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Ship),
        icon_field: None,
        row_resource: ship_row_resource,
        source_resource: ship_source_resource,
        source_display_name: ship_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Weapons,
        rel_path: "data/weapons/weapon_data.csv",
        entity_id_field: "id",
        entity_summary: Some(|summaries| summaries.weapons),
        supports_faction_filter: true,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: true,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Weapon),
        icon_field: None,
        row_resource: weapon_row_resource,
        source_resource: weapon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Wings,
        rel_path: "data/hulls/wing_data.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: true,
            weapons: false,
            variants: true,
        },
        resource_owner: Some(ResourceOwnerKind::Variant),
        icon_field: None,
        row_resource: wing_row_resource,
        source_resource: wing_source_resource,
        source_display_name: wing_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Hullmods,
        rel_path: "data/hullmods/hull_mods.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Hullmods),
        icon_field: Some("sprite"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::ShipSystems,
        rel_path: "data/shipsystems/ship_systems.csv",
        entity_id_field: "id",
        entity_summary: Some(|summaries| summaries.systems),
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::ShipSystems),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Industries,
        rel_path: "data/campaign/industries.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Industries),
        icon_field: Some("image"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Skills,
        rel_path: "data/characters/skills/skill_data.csv",
        entity_id_field: "id",
        entity_summary: Some(|summaries| summaries.skills),
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Skills),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Abilities,
        rel_path: "data/campaign/abilities.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Abilities),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Commodities,
        rel_path: "data/campaign/commodities.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Commodities),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::SpecialItems,
        rel_path: "data/campaign/special_items.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::SpecialItems),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Submarkets,
        rel_path: "data/campaign/submarkets.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::Submarkets),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::MarketConditions,
        rel_path: "data/campaign/market_conditions.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: Some(ResourceOwnerKind::MarketConditions),
        icon_field: Some("icon"),
        row_resource: icon_row_resource,
        source_resource: icon_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::SimOpponents,
        rel_path: "data/campaign/sim_opponents.csv",
        entity_id_field: "variant id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: None,
        icon_field: None,
        row_resource: no_row_resource,
        source_resource: no_source_resource,
        source_display_name: no_source_display_name,
    },
    ProjectCsvTableDefinition {
        key: CsvTableKey::Descriptions,
        rel_path: "data/strings/descriptions.csv",
        entity_id_field: "id",
        entity_summary: None,
        supports_faction_filter: false,
        core_source_requirements: CoreSourceRequirements {
            ships: false,
            weapons: false,
            variants: false,
        },
        resource_owner: None,
        icon_field: None,
        row_resource: no_row_resource,
        source_resource: no_source_resource,
        source_display_name: no_source_display_name,
    },
];

fn ship_row_resource(
    session: &ProjectSession,
    source: ResourceSource,
    _table: CsvTableKey,
    row: &Map<String, Value>,
) -> AppResult<Option<ResourceRef>> {
    let Some(id) = string_from_row(row, "id") else {
        return Ok(None);
    };
    hull_resource_ref(session, source, &id)
}

fn weapon_row_resource(
    session: &ProjectSession,
    source: ResourceSource,
    _table: CsvTableKey,
    row: &Map<String, Value>,
) -> AppResult<Option<ResourceRef>> {
    let Some(id) = string_from_row(row, "id") else {
        return Ok(None);
    };
    Ok(session
        .weapon_specs
        .get(&id)
        .and_then(weapon_sprite_path)
        .map(|path| resource_ref(source, &path, ResourceOwnerKind::Weapon, &id, "sprite")))
}

fn wing_row_resource(
    session: &ProjectSession,
    source: ResourceSource,
    _table: CsvTableKey,
    row: &Map<String, Value>,
) -> AppResult<Option<ResourceRef>> {
    let Some(variant_id) = string_from_row(row, "variant") else {
        return Ok(None);
    };
    let Some(variant) = session
        .variant_files
        .iter()
        .find(|variant| variant.variant_id == variant_id)
    else {
        return Ok(None);
    };
    hull_resource_ref(session, source, &variant.hull_id)
}

fn icon_row_resource(
    _session: &ProjectSession,
    source: ResourceSource,
    table: CsvTableKey,
    row: &Map<String, Value>,
) -> AppResult<Option<ResourceRef>> {
    Ok(csv_table_icon_resource_ref(source, table, row))
}

fn no_row_resource(
    _session: &ProjectSession,
    _source: ResourceSource,
    _table: CsvTableKey,
    _row: &Map<String, Value>,
) -> AppResult<Option<ResourceRef>> {
    Ok(None)
}

fn ship_source_resource(
    source: ResourceSource,
    _table: CsvTableKey,
    value: &str,
    _row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    if let Some(resource) = hull_resource_ref(session, source, value)? {
        return Ok(Some(resource));
    }
    Ok(core_data
        .and_then(|core_data| {
            core_data
                .ship_files
                .get(value)
                .and_then(|ship| string_field(ship, "spriteName"))
        })
        .map(|path| resource_ref(source, &path, ResourceOwnerKind::Ship, value, "sprite")))
}

fn ship_source_display_name(
    source: ResourceSource,
    _table: CsvTableKey,
    value: &str,
    row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<String>> {
    if let Some(name) = string_from_row(row, "name") {
        return Ok(Some(name));
    }
    let ship = match source {
        ResourceSource::Core => core_data.and_then(|data| data.ship_files.get(value)),
        ResourceSource::Mod => session.ship_files.get(value),
    };
    Ok(ship.and_then(|ship| string_field(ship, "hullName")))
}

fn weapon_source_resource(
    source: ResourceSource,
    _table: CsvTableKey,
    value: &str,
    _row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    let sprite_path = match source {
        ResourceSource::Core => core_data.and_then(|core_data| {
            core_data
                .weapon_specs
                .get(value)
                .and_then(weapon_sprite_path)
        }),
        ResourceSource::Mod => session.weapon_specs.get(value).and_then(weapon_sprite_path),
    };
    Ok(sprite_path
        .map(|path| resource_ref(source, &path, ResourceOwnerKind::Weapon, value, "sprite")))
}

fn wing_source_resource(
    source: ResourceSource,
    _table: CsvTableKey,
    _value: &str,
    row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    let Some(variant_id) = string_from_row(row, "variant") else {
        return Ok(None);
    };
    let hull_id = match source {
        ResourceSource::Core => core_data.and_then(|core_data| {
            core_data
                .variant_files
                .iter()
                .find(|variant| variant.variant_id == variant_id)
                .map(|variant| variant.hull_id.as_str())
        }),
        ResourceSource::Mod => session
            .variant_files
            .iter()
            .find(|variant| variant.variant_id == variant_id)
            .map(|variant| variant.hull_id.as_str()),
    };
    match hull_id {
        Some(hull_id) => hull_resource_ref(session, source, hull_id),
        None => Ok(None),
    }
}

fn wing_source_display_name(
    source: ResourceSource,
    _table: CsvTableKey,
    _value: &str,
    row: &Map<String, Value>,
    core_data: Option<&CoreSourceData>,
    session: &ProjectSession,
) -> AppResult<Option<String>> {
    let Some(variant_id) = string_from_row(row, "variant") else {
        return Ok(None);
    };
    let variant = match source {
        ResourceSource::Core => core_data.and_then(|data| {
            data.variant_files
                .iter()
                .find(|variant| variant.variant_id == variant_id)
        }),
        ResourceSource::Mod => session
            .variant_files
            .iter()
            .find(|variant| variant.variant_id == variant_id),
    };
    Ok(variant.and_then(|variant| string_field(&variant.data, "displayName")))
}

fn icon_source_resource(
    source: ResourceSource,
    table: CsvTableKey,
    _value: &str,
    row: &Map<String, Value>,
    _core_data: Option<&CoreSourceData>,
    _session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    Ok(csv_table_icon_resource_ref(source, table, row))
}

fn no_source_resource(
    _source: ResourceSource,
    _table: CsvTableKey,
    _value: &str,
    _row: &Map<String, Value>,
    _core_data: Option<&CoreSourceData>,
    _session: &ProjectSession,
) -> AppResult<Option<ResourceRef>> {
    Ok(None)
}

fn no_source_display_name(
    _source: ResourceSource,
    _table: CsvTableKey,
    _value: &str,
    _row: &Map<String, Value>,
    _core_data: Option<&CoreSourceData>,
    _session: &ProjectSession,
) -> AppResult<Option<String>> {
    Ok(None)
}

pub(super) fn hull_resource_ref(
    session: &ProjectSession,
    source: ResourceSource,
    hull_id: &str,
) -> AppResult<Option<ResourceRef>> {
    if source == ResourceSource::Core {
        let root = session.manifest.starsector_root.as_ref().ok_or_else(|| {
            crate::errors::AppError::message("core resource reference requires starsector root")
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
