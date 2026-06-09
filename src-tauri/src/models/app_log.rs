use crate::models::required_nullable;
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

#[cfg(test)]
mod tests {
    use super::AppLogEntry;
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
}
