mod assets;
mod indexed_entities;
mod missions;
mod variants;

pub use assets::*;
pub use indexed_entities::*;
pub use missions::*;
pub use variants::*;

use crate::errors::{AppError, AppResult};

pub(super) fn validate_config_id<'a>(id: &'a str, message: &str) -> AppResult<&'a str> {
    let clean = id.trim();
    if clean.is_empty()
        || clean.contains('/')
        || clean.contains('\\')
        || clean == "."
        || clean == ".."
        || clean.contains("..")
    {
        return Err(AppError::message(message));
    }
    Ok(clean)
}
