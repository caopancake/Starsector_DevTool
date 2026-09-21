use crate::{
    errors::AppError,
    models::{AppSettings, command_payloads::SaveAppSettingsPayload},
    services,
};

#[tauri::command(async)]
pub fn load_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, AppError> {
    services::app_settings::load_app_settings(app_handle)
}

#[tauri::command(async)]
pub fn save_app_settings(
    app_handle: tauri::AppHandle,
    payload: SaveAppSettingsPayload,
) -> Result<AppSettings, AppError> {
    services::app_settings::save_app_settings(app_handle, payload.settings)
}
