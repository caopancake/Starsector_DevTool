use crate::models::{optional_non_empty_string, required_nullable};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppLogLevel {
    Info,
    Warning,
    Error,
}

impl AppLogLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogEntry {
    pub level: AppLogLevel,
    pub message: String,
    #[serde(deserialize_with = "required_nullable")]
    pub path: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogStatus {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AppTheme {
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AccentPreset {
    Blue,
    Orange,
    Green,
    Cyan,
    Pink,
    Purple,
    Gray,
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EditMode {
    Plain,
    Smart,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: AppTheme,
    #[serde(default = "default_accent")]
    pub accent: AccentPreset,
    #[serde(default = "default_custom_accent")]
    pub custom_accent: String,
    #[serde(default = "default_history_limit")]
    pub history_limit: u32,
    #[serde(default = "default_edit_mode")]
    pub edit_mode: EditMode,
    #[serde(default, deserialize_with = "optional_non_empty_string")]
    pub starsector_root: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent: default_accent(),
            custom_accent: default_custom_accent(),
            history_limit: default_history_limit(),
            edit_mode: default_edit_mode(),
            starsector_root: None,
        }
    }
}

fn default_theme() -> AppTheme {
    AppTheme::Light
}

fn default_accent() -> AccentPreset {
    AccentPreset::Blue
}

fn default_custom_accent() -> String {
    "#2563eb".to_string()
}

fn default_history_limit() -> u32 {
    20
}

fn default_edit_mode() -> EditMode {
    EditMode::Smart
}

#[cfg(test)]
mod tests {
    use super::{AppLogEntry, AppSettings};
    use serde_json::json;

    #[test]
    fn app_log_entry_requires_explicit_nullable_context_fields() {
        let result = serde_json::from_value::<AppLogEntry>(json!({
            "level": "info",
            "message": "demo",
            "path": null
        }));

        assert!(result.is_err());
    }

    #[test]
    fn app_settings_uses_nullable_starsector_root() {
        let settings = serde_json::from_value::<AppSettings>(json!({
            "theme": "light",
            "accent": "blue",
            "customAccent": "#2563eb",
            "historyLimit": 20,
            "editMode": "smart",
            "starsectorRoot": null
        }))
        .unwrap();

        assert_eq!(settings.starsector_root, None);
    }

    #[test]
    fn app_settings_treats_blank_starsector_root_as_missing() {
        let settings = serde_json::from_value::<AppSettings>(json!({
            "theme": "light",
            "accent": "blue",
            "customAccent": "#2563eb",
            "historyLimit": 20,
            "editMode": "smart",
            "starsectorRoot": ""
        }))
        .unwrap();

        assert_eq!(settings.starsector_root, None);
    }
}
