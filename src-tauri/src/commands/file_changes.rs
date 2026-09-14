use crate::{
    errors::AppError,
    models::WriteResult,
    models::command_payloads::{ApplyFileChangeSetPayload, SaveModFilesPayload},
    services,
};

#[tauri::command(async)]
pub fn save_mod_files(payload: SaveModFilesPayload) -> Result<WriteResult, AppError> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)?;
    services::file_changes::save_mod_files(&payload.mod_root, payload.files)
}

#[tauri::command(async)]
pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> Result<WriteResult, AppError> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)?;
    services::file_changes::apply_file_change_set(
        &payload.mod_root,
        payload.direction,
        payload.changes,
    )
}
