mod assets;
mod factions;
mod missions;

pub use assets::*;
pub use factions::*;
pub use missions::*;

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
