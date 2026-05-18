use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub const CSV_TABLES: [(&str, &str); 7] = [
    ("ships", "data/hulls/ship_data.csv"),
    ("weapons", "data/weapons/weapon_data.csv"),
    ("wings", "data/hulls/wing_data.csv"),
    ("hullmods", "data/hullmods/hull_mods.csv"),
    ("shipSystems", "data/shipsystems/ship_systems.csv"),
    ("industries", "data/campaign/industries.csv"),
    ("skills", "data/characters/skills/skill_data.csv"),
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsvTable {
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub mod_root: String,
    pub starsector_root: Option<String>,
    pub core_available: bool,
    pub mod_info: Value,
    pub faction_meta: BTreeMap<String, FactionMeta>,
    pub faction_files: BTreeMap<String, Value>,
    pub mission_count: usize,
    pub csv_headers: BTreeMap<String, Vec<String>>,
    pub csv_paths: BTreeMap<String, String>,
    pub ships: Vec<Map<String, Value>>,
    pub weapons: Vec<Map<String, Value>>,
    pub wings: Vec<Map<String, Value>>,
    pub hullmods: Vec<Map<String, Value>>,
    pub ship_systems: Vec<Map<String, Value>>,
    pub industries: Vec<Map<String, Value>>,
    pub skills: Vec<Map<String, Value>>,
    pub ship_files: BTreeMap<String, Value>,
    pub variants: BTreeMap<String, Vec<Value>>,
    pub ship_sprites: BTreeMap<String, String>,
    pub available_sprites: Vec<String>,
    pub wpn_files: BTreeMap<String, Value>,
    pub proj_files: BTreeMap<String, Value>,
    pub system_files: BTreeMap<String, Value>,
    pub skill_files: BTreeMap<String, Value>,
    pub weapon_sprites: Vec<String>,
    pub weapon_sprites_data: BTreeMap<String, BTreeMap<String, String>>,
    pub hullmod_sprites: BTreeMap<String, String>,
    pub ship_system_sprites: BTreeMap<String, String>,
    pub industry_sprites: BTreeMap<String, String>,
    pub skill_sprites: BTreeMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenDirectoryResult {
    pub kind: String,
    pub selected_path: String,
    pub starsector_root: Option<String>,
    pub mod_root: Option<String>,
    pub overview: Option<GameOverviewData>,
    pub warnings: Vec<GameScanWarning>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameOverviewData {
    pub starsector_root: String,
    pub core_available: bool,
    pub mods_dir: String,
    pub mods: Vec<GameModSummary>,
    pub warnings: Vec<GameScanWarning>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameModSummary {
    pub mod_root: String,
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub has_mod_info: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameScanWarning {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FactionMeta {
    pub name: String,
    pub color: String,
}

pub fn csv_path_for(table: &str) -> Option<&'static str> {
    CSV_TABLES
        .iter()
        .find_map(|(key, path)| (*key == table).then_some(*path))
}
