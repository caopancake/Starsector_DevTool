use crate::{models::PersistedWorkspace, services};

#[tauri::command]
pub fn load_workspace(app_handle: tauri::AppHandle) -> Result<PersistedWorkspace, String> {
    services::workspace::load_workspace_for_app(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_workspace(
    app_handle: tauri::AppHandle,
    state: PersistedWorkspace,
) -> Result<(), String> {
    services::workspace::save_workspace_for_app(app_handle, state).map_err(|e| e.to_string())
}
