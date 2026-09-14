use crate::{
    errors::AppError,
    models::command_payloads::{LoadEditableFilePayload, SaveTextFilePayload},
    models::{EditableFileData, WriteResult},
    services,
};

#[tauri::command(async)]
pub fn load_editable_file(payload: LoadEditableFilePayload) -> Result<EditableFileData, AppError> {
    if let Some(session_id) = &payload.session_id {
        services::project::ensure_project_session_mod_root(session_id, &payload.mod_root)?;
    }
    services::file_editor::load_editable_file(&payload.mod_root, payload.path)
}

#[tauri::command(async)]
pub fn save_text_file(payload: SaveTextFilePayload) -> Result<WriteResult, AppError> {
    if let Some(session_id) = &payload.session_id {
        services::project::ensure_project_session_mod_root(session_id, &payload.mod_root)?;
    }
    services::file_editor::save_text_file(&payload.mod_root, &payload.path, payload.text)
}
