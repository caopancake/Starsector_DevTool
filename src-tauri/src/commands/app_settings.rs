use crate::{
    models::{command_payloads::SaveAppSettingsPayload, AppSettings},
    services,
};

#[tauri::command]
pub fn load_app_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    services::app_settings::load_app_settings(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_app_settings(
    app_handle: tauri::AppHandle,
    payload: SaveAppSettingsPayload,
) -> Result<AppSettings, String> {
    services::app_settings::save_app_settings(app_handle, payload.settings)
        .map_err(|e| e.to_string())
}
