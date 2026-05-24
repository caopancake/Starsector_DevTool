use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub const CSV_TABLES: [(&str, &str); 14] = [
    ("ships", "data/hulls/ship_data.csv"),
    ("weapons", "data/weapons/weapon_data.csv"),
    ("wings", "data/hulls/wing_data.csv"),
    ("hullmods", "data/hullmods/hull_mods.csv"),
    ("shipSystems", "data/shipsystems/ship_systems.csv"),
    ("industries", "data/campaign/industries.csv"),
    ("skills", "data/characters/skills/skill_data.csv"),
    ("abilities", "data/campaign/abilities.csv"),
    ("commodities", "data/campaign/commodities.csv"),
    ("specialItems", "data/campaign/special_items.csv"),
    ("submarkets", "data/campaign/submarkets.csv"),
    ("marketConditions", "data/campaign/market_conditions.csv"),
    ("simOpponents", "data/campaign/sim_opponents.csv"),
    ("descriptions", "data/strings/descriptions.csv"),
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsvTable {
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub path: String,
}

pub type ProjectSessionId = String;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub starsector_root: Option<String>,
    pub core_available: bool,
    pub mod_info: Value,
    pub table_summaries: BTreeMap<String, TableSummary>,
    pub entity_summaries: EntitySummaries,
    pub warnings: Vec<GameScanWarning>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TableSummary {
    pub path: String,
    pub header: Vec<String>,
    pub available: bool,
    pub total_rows: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct EntitySummaries {
    pub factions: usize,
    pub missions: usize,
    pub ships: usize,
    pub weapons: usize,
    pub projectiles: usize,
    pub variants: usize,
    pub skins: usize,
    pub systems: usize,
    pub skills: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvTableWindow {
    pub table: String,
    pub header: Vec<String>,
    pub total_rows: usize,
    pub filtered_rows: usize,
    pub start: usize,
    pub rows: Vec<CsvWindowRow>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvWindowRow {
    pub row_key: String,
    pub row_index: usize,
    pub row: Map<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvTableWindowPayload {
    pub session_id: ProjectSessionId,
    pub table: String,
    pub start: usize,
    pub count: usize,
    pub search: Option<String>,
    pub faction: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvSourceOptionsPayload {
    pub session_id: ProjectSessionId,
    pub source: String,
    pub search: Option<String>,
    pub limit: Option<usize>,
    pub current_values: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceOptionGroup {
    pub label: String,
    pub options: Vec<SourceOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceOption {
    pub label: String,
    pub value: String,
    pub sprite: Option<String>,
    pub resource_ref: Option<ResourceRef>,
    pub origin: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryEntityPayload {
    pub session_id: ProjectSessionId,
    pub kind: String,
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryEntityListPayload {
    pub session_id: ProjectSessionId,
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntityData {
    pub kind: String,
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceRef {
    pub source: String,
    pub rel_path: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDataUrlBatchPayload {
    pub session_id: ProjectSessionId,
    pub resources: Vec<ResourceRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HullReferencesPayload {
    pub session_id: ProjectSessionId,
    pub hull_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDataUrlBatchEntry {
    pub key: String,
    pub source: String,
    pub rel_path: String,
    pub data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDataUrlBatchResult {
    pub entries: Vec<ResourceDataUrlBatchEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HullReferenceOption {
    pub label: String,
    pub value: String,
    pub origin: String,
    pub kind: String,
    pub resource_ref: Option<ResourceRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HullReferenceGroup {
    pub label: String,
    pub options: Vec<HullReferenceOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HullReferencesResult {
    pub groups: Vec<HullReferenceGroup>,
    pub sprites: BTreeMap<String, ResourceRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateProjectSessionPayload {
    pub session_id: ProjectSessionId,
    pub changed_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateCoreCachePayload {
    pub starsector_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VariantFile {
    pub variant_id: String,
    pub hull_id: String,
    pub path: String,
    pub rel_path: String,
    pub data: Value,
    pub weapon_group_count: usize,
    pub hull_mod_count: usize,
    pub perma_mod_count: usize,
    pub wing_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkinFile {
    pub skin_hull_id: String,
    pub base_hull_id: String,
    pub path: String,
    pub rel_path: String,
    pub data: Value,
    pub built_in_mod_count: usize,
    pub built_in_weapon_count: usize,
    pub built_in_wing_count: usize,
    pub weapon_slot_change_count: usize,
    pub engine_slot_change_count: usize,
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
