use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use super::directory_opening::{GameModSummary, GameScanWarning};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceView {
    Overview,
    Table,
    Settings,
    Config,
    About,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWorkspace {
    #[serde(default)]
    pub mods: Vec<PersistedMod>,
    pub active_mod_root: Option<String>,
    pub current_view: Option<WorkspaceView>,
    #[serde(default)]
    pub expanded_mods: Vec<String>,
    pub starsector_root: Option<String>,
    #[serde(default)]
    pub game_mods: Vec<GameModSummary>,
    #[serde(default)]
    pub game_warnings: Vec<GameScanWarning>,
    #[serde(default)]
    pub column_widths: BTreeMap<String, BTreeMap<String, BTreeMap<String, f64>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedMod {
    pub mod_root: String,
    pub display_name: String,
    #[serde(default)]
    pub version: String,
}
