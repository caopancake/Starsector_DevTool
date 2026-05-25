pub mod app_config;
pub mod command_payloads;
pub mod project;
pub mod workspace;
pub mod write;

use serde::{Deserialize, Deserializer};

pub use app_config::*;
pub use project::*;
pub use workspace::*;
pub use write::*;

pub fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}

pub fn required_nullable_non_empty_string<'de, D>(
    deserializer: D,
) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(normalize_optional_non_empty_string)
}

pub fn optional_non_empty_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(normalize_optional_non_empty_string)
}

fn normalize_optional_non_empty_string(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}
