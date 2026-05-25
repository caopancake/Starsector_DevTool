use crate::{
    models::{
        command_payloads::{AppendAppLogPayload, SaveAppSettingsPayload},
        AppLogStatus, AppSettings,
    },
    services,
};

#[tauri::command]
pub fn append_app_log(
    app_handle: tauri::AppHandle,
    payload: AppendAppLogPayload,
) -> Result<(), String> {
    services::app_log::append_app_log(app_handle, payload.entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_log_status(app_handle: tauri::AppHandle) -> Result<AppLogStatus, String> {
    services::app_log::app_log_status(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_config_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_config::open_config_dir(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_app_log_file(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_log::open_app_log_file(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_config_files(app_handle: tauri::AppHandle) -> Result<(), String> {
    services::app_config::clear_app_config_files(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_app_log_file(app_handle: tauri::AppHandle) -> Result<AppLogStatus, String> {
    services::app_log::clear_app_log_file(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    services::app_settings::load_app_settings(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_app_settings(
    app_handle: tauri::AppHandle,
    payload: SaveAppSettingsPayload,
) -> Result<(), String> {
    services::app_settings::save_app_settings(app_handle, payload.settings)
        .map_err(|e| e.to_string())
}
