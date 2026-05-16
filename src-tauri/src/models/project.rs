use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub const CSV_TABLES: [(&str, &str); 5] = [
    ("ships", "data/hulls/ship_data.csv"),
    ("weapons", "data/weapons/weapon_data.csv"),
    ("wings", "data/hulls/wing_data.csv"),
    ("hullmods", "data/hullmods/hull_mods.csv"),
    ("industries", "data/campaign/industries.csv"),
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
    pub csv_headers: BTreeMap<String, Vec<String>>,
    pub csv_paths: BTreeMap<String, String>,
    pub ships: Vec<Map<String, Value>>,
    pub weapons: Vec<Map<String, Value>>,
    pub wings: Vec<Map<String, Value>>,
    pub hullmods: Vec<Map<String, Value>>,
    pub industries: Vec<Map<String, Value>>,
    pub ship_files: BTreeMap<String, Value>,
    pub variants: BTreeMap<String, Vec<Value>>,
    pub ship_sprites: BTreeMap<String, String>,
    pub available_sprites: Vec<String>,
    pub wpn_files: BTreeMap<String, Value>,
    pub proj_files: BTreeMap<String, Value>,
    pub weapon_sprites: Vec<String>,
    pub weapon_sprites_data: BTreeMap<String, BTreeMap<String, String>>,
    pub hullmod_sprites: BTreeMap<String, String>,
    pub industry_sprites: BTreeMap<String, String>,
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
