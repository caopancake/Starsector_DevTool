use crate::{
    models::command_payloads::{ApplyFileChangeSetPayload, SaveModFilesPayload},
    models::WriteResult,
    services,
};

#[tauri::command]
pub fn save_mod_files(payload: SaveModFilesPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::file_changes::save_mod_files(&payload.mod_root, payload.files)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::file_changes::apply_file_change_set(
        &payload.mod_root,
        payload.direction,
        payload.changes,
    )
    .map_err(|e| e.to_string())
}
