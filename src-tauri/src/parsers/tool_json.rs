use crate::errors::AppResult;
use serde::de::DeserializeOwned;

pub fn parse_persisted_json<T: DeserializeOwned>(text: &str) -> AppResult<T> {
    Ok(serde_json::from_str(text)?)
}
