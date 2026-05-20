use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogEntry {
    pub level: String,
    pub message: String,
    pub path: Option<String>,
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogStatus {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default = "default_custom_accent")]
    pub custom_accent: String,
    #[serde(default = "default_history_limit")]
    pub history_limit: u32,
    #[serde(default = "default_edit_mode")]
    pub edit_mode: String,
    #[serde(default)]
    pub starsector_root: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent: default_accent(),
            custom_accent: default_custom_accent(),
            history_limit: default_history_limit(),
            edit_mode: default_edit_mode(),
            starsector_root: String::new(),
        }
    }
}

fn default_theme() -> String {
    "light".to_string()
}

fn default_accent() -> String {
    "blue".to_string()
}

fn default_custom_accent() -> String {
    "#2563eb".to_string()
}

fn default_history_limit() -> u32 {
    20
}

fn default_edit_mode() -> String {
    "smart".to_string()
}
