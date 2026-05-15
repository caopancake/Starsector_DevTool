use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWorkspace {
    #[serde(default)]
    pub mods: Vec<PersistedMod>,
    pub active_mod_root: Option<String>,
    pub current_view: Option<String>,
    #[serde(default)]
    pub expanded_mods: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedMod {
    pub mod_root: String,
    pub display_name: String,
    #[serde(default)]
    pub version: String,
}
