use crate::{
    errors::AppResult,
    models::{CsvTableKey, EditorSpecKind, EntityKind},
};

#[derive(Clone, Copy)]
pub struct EntitySpecDefinition {
    pub entity_kind: EntityKind,
    pub editor_kind: Option<EditorSpecKind>,
    pub csv_table: Option<CsvTableKey>,
    pub dir: &'static str,
    pub extension: &'static str,
    pub id_field: &'static str,
    pub invalid_id_message: &'static str,
}

impl EntitySpecDefinition {
    pub fn path_matches(self, path: &str) -> bool {
        path_affects_target(path, self.dir)
            || (path_is_or_in_dir(path, self.dir) && path.ends_with(self.extension))
    }

    pub fn extension_without_dot(self) -> &'static str {
        self.extension.strip_prefix('.').unwrap_or(self.extension)
    }

    pub fn default_rel_path(self, id: &str) -> String {
        format!("{}/{}.{}", self.dir, id, self.extension_without_dot())
    }

    pub fn validate_rel_path(self, rel_path: &str, message: &str) -> AppResult<()> {
        crate::domain::config::validate_config_file_rel_path(
            rel_path,
            self.dir,
            self.extension_without_dot(),
            message,
        )
    }
}

pub const SHIP_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Ship,
    editor_kind: Some(EditorSpecKind::Ship),
    csv_table: Some(CsvTableKey::Ships),
    dir: "data/hulls",
    extension: ".ship",
    id_field: "hullId",
    invalid_id_message: "无效舰船 ID",
};

pub const WEAPON_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Weapon,
    editor_kind: Some(EditorSpecKind::Weapon),
    csv_table: Some(CsvTableKey::Weapons),
    dir: "data/weapons",
    extension: ".wpn",
    id_field: "id",
    invalid_id_message: "无效武器 ID",
};

pub const PROJECTILE_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Projectile,
    editor_kind: Some(EditorSpecKind::Projectile),
    csv_table: None,
    dir: "data/weapons/proj",
    extension: ".proj",
    id_field: "id",
    invalid_id_message: "无效弹体 ID",
};

pub const SYSTEM_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::System,
    editor_kind: Some(EditorSpecKind::System),
    csv_table: Some(CsvTableKey::ShipSystems),
    dir: "data/shipsystems",
    extension: ".system",
    id_field: "id",
    invalid_id_message: "无效战术系统 ID",
};

pub const SKILL_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Skill,
    editor_kind: None,
    csv_table: Some(CsvTableKey::Skills),
    dir: "data/characters/skills",
    extension: ".skill",
    id_field: "id",
    invalid_id_message: "无效技能 ID",
};

pub const FACTION_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Faction,
    editor_kind: None,
    csv_table: None,
    dir: "data/world/factions",
    extension: ".faction",
    id_field: "id",
    invalid_id_message: "无效势力 ID",
};

pub const VARIANT_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Variant,
    editor_kind: None,
    csv_table: None,
    dir: "data/variants",
    extension: ".variant",
    id_field: "variantId",
    invalid_id_message: "无效装配 ID",
};

pub const SKIN_SPEC_DEFINITION: EntitySpecDefinition = EntitySpecDefinition {
    entity_kind: EntityKind::Skin,
    editor_kind: None,
    csv_table: None,
    dir: "data/hulls/skins",
    extension: ".skin",
    id_field: "skinHullId",
    invalid_id_message: "无效舰船皮肤 ID",
};

pub const ENTITY_SPEC_DEFINITIONS: [EntitySpecDefinition; 8] = [
    SHIP_SPEC_DEFINITION,
    WEAPON_SPEC_DEFINITION,
    PROJECTILE_SPEC_DEFINITION,
    SYSTEM_SPEC_DEFINITION,
    SKILL_SPEC_DEFINITION,
    FACTION_SPEC_DEFINITION,
    VARIANT_SPEC_DEFINITION,
    SKIN_SPEC_DEFINITION,
];

pub fn entity_spec_definition(kind: EntityKind) -> Option<&'static EntitySpecDefinition> {
    ENTITY_SPEC_DEFINITIONS
        .iter()
        .find(|definition| definition.entity_kind == kind)
}

pub fn editor_spec_definition(kind: EditorSpecKind) -> &'static EntitySpecDefinition {
    ENTITY_SPEC_DEFINITIONS
        .iter()
        .find(|definition| definition.editor_kind == Some(kind))
        .expect("registered editor spec kind")
}

pub fn associated_spec_definition(table: CsvTableKey) -> Option<&'static EntitySpecDefinition> {
    ENTITY_SPEC_DEFINITIONS
        .iter()
        .find(|definition| definition.csv_table == Some(table))
}

pub fn associated_spec_tables() -> Vec<CsvTableKey> {
    ENTITY_SPEC_DEFINITIONS
        .iter()
        .filter_map(|definition| definition.csv_table)
        .collect()
}

fn path_is_or_in_dir(path: &str, dir: &str) -> bool {
    path == dir || path.starts_with(&format!("{dir}/"))
}

fn path_affects_target(path: &str, target: &str) -> bool {
    path.is_empty() || path == target || target.starts_with(&format!("{path}/"))
}
