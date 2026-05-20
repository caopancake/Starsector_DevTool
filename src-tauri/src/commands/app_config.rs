use crate::{
    models::{AppLogEntry, AppLogStatus, AppSettings},
    services,
};

#[tauri::command]
pub fn append_app_log(app_handle: tauri::AppHandle, entry: AppLogEntry) -> Result<(), String> {
    services::app_log::append_log_for_app(app_handle, entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_log_status(app_handle: tauri::AppHandle) -> Result<AppLogStatus, String> {
    services::app_log::log_status_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_config_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_config::open_config_dir_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_app_log_file(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_log::open_log_file_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_config_files(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_config::clear_config_files_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_app_log_file(app_handle: tauri::AppHandle) -> Result<AppLogStatus, String> {
    services::app_log::clear_log_file_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    services::app_settings::load_settings_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_app_settings(
    app_handle: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    services::app_settings::save_settings_for_app(app_handle, settings).map_err(|e| e.to_string())
}
