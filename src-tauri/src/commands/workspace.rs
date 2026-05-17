use crate::{models::PersistedWorkspace, services};
use tauri::Manager;

#[tauri::command]
pub fn load_workspace(app_handle: tauri::AppHandle) -> Result<PersistedWorkspace, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(services::workspace::load_workspace(&app_data))
}

#[tauri::command]
pub fn save_workspace(
    app_handle: tauri::AppHandle,
    state: PersistedWorkspace,
) -> Result<(), String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    services::workspace::save_workspace(&app_data, &state).map_err(|e| e.to_string())
}
