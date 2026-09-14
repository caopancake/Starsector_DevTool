use crate::{
    errors::AppError,
    models::{AppSettings, command_payloads::SaveAppSettingsPayload},
    services,
};

#[tauri::command]
pub fn load_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, AppError> {
    services::app_settings::load_app_settings(app_handle)
}

#[tauri::command]
pub fn save_app_settings(
    app_handle: tauri::AppHandle,
    payload: SaveAppSettingsPayload,
) -> Result<AppSettings, AppError> {
    services::app_settings::save_app_settings(app_handle, payload.settings)
}
