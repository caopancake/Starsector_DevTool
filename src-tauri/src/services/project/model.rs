use crate::models::{CsvTableKey, GameScanWarning, ProjectManifest, SkinFile, VariantFile};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};

pub(super) const MISSION_LIST_TABLE_KEY: &str = "missions";
pub(super) const MISSION_LIST_REL_PATH: &str = "data/missions/mission_list.csv";
pub(super) const WEAPON_SPRITE_FIELDS: [&str; 8] = [
    "turretSprite",
    "hardpointSprite",
    "turretUnderSprite",
    "hardpointUnderSprite",
    "turretGunSprite",
    "hardpointGunSprite",
    "turretGlowSprite",
    "hardpointGlowSprite",
];

pub(super) struct SpecBundle {
    pub ship_files: BTreeMap<String, Value>,
    pub variant_files: Vec<VariantFile>,
    pub skin_files: Vec<SkinFile>,
    pub weapon_specs: BTreeMap<String, Value>,
    pub projectile_specs: BTreeMap<String, Value>,
    pub system_files: BTreeMap<String, Value>,
    pub skill_files: BTreeMap<String, Value>,
    pub warnings: Vec<GameScanWarning>,
}

#[derive(Clone)]
pub(super) struct SessionCsvTable {
    pub header: Vec<String>,
    pub path: String,
    pub rows: Option<Vec<SessionCsvRow>>,
}

#[derive(Clone)]
pub(super) struct SessionCsvRow {
    pub row_key: String,
    pub row: Map<String, Value>,
}

pub(super) struct ProjectSession {
    pub manifest: ProjectManifest,
    pub faction_files: BTreeMap<String, Value>,
    pub tag_map: HashMap<String, String>,
    pub csv_tables: BTreeMap<String, SessionCsvTable>,
    pub ship_files: BTreeMap<String, Value>,
    pub variant_files: Vec<VariantFile>,
    pub skin_files: Vec<SkinFile>,
    pub weapon_specs: BTreeMap<String, Value>,
    pub projectile_specs: BTreeMap<String, Value>,
    pub system_files: BTreeMap<String, Value>,
    pub skill_files: BTreeMap<String, Value>,
}

#[derive(Clone)]
pub(super) struct CoreCache {
    pub csv_tables: BTreeMap<String, SessionCsvTable>,
    pub ship_files: Option<BTreeMap<String, Value>>,
    pub variant_files: Option<Vec<VariantFile>>,
    pub skin_files: Option<Vec<SkinFile>>,
    pub weapon_specs: Option<BTreeMap<String, Value>>,
}

pub(super) struct SourceOptionsContext<'a> {
    pub core: Option<CoreSourceData>,
    pub limit: usize,
    pub search: &'a str,
    pub seen: &'a mut std::collections::BTreeSet<String>,
    pub session: Option<&'a ProjectSession>,
    pub table: CsvTableKey,
}

#[derive(Clone, Default)]
pub(super) struct CoreSourceData {
    pub ship_files: BTreeMap<String, Value>,
    pub variant_files: Vec<VariantFile>,
    pub weapon_specs: BTreeMap<String, Value>,
}

pub(super) fn string_from_row(row: &Map<String, Value>, key: &str) -> Option<String> {
    row.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub(super) fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub(super) fn weapon_sprite_path(weapon: &Value) -> Option<String> {
    WEAPON_SPRITE_FIELDS
        .iter()
        .find_map(|key| string_field(weapon, key))
}

pub(super) fn is_comment_row(row: &Map<String, Value>) -> bool {
    row.values()
        .filter_map(Value::as_str)
        .find(|value| !value.trim().is_empty())
        .is_some_and(|value| value.trim_start().starts_with('#'))
}

pub(super) fn normalize_rel_path(root: &std::path::Path, path: &std::path::Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
