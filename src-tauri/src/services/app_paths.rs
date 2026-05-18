use crate::errors::{AppError, AppResult};
use std::path::PathBuf;
use tauri::Manager;

pub fn app_data_dir(app_handle: tauri::AppHandle) -> AppResult<PathBuf> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|error| AppError::message(error.to_string()))
}
