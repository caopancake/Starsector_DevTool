use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpenDirectoryResult {
    pub kind: OpenDirectoryKind,
    pub selected_path: String,
    pub starsector_root: Option<String>,
    pub mod_root: Option<String>,
    pub overview: Option<GameOverviewData>,
    pub warnings: Vec<GameScanWarning>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum OpenDirectoryKind {
    GameRoot,
    ModInGame,
    ExternalMod,
    Unknown,
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
    #[serde(default)]
    pub edit_target: Option<GameWarningEditTarget>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameWarningEditTarget {
    pub mod_root: String,
    pub path: String,
}
