use crate::{
    models::{command_payloads::SaveWorkspacePayload, PersistedWorkspace},
    services,
};

#[tauri::command]
pub fn load_workspace(app_handle: tauri::AppHandle) -> Result<PersistedWorkspace, String> {
    services::workspace_persistence::load_app_workspace(app_handle).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_workspace(
    app_handle: tauri::AppHandle,
    payload: SaveWorkspacePayload,
) -> Result<(), String> {
    services::workspace_persistence::save_app_workspace(app_handle, payload.state)
        .map_err(|e| e.to_string())
}
