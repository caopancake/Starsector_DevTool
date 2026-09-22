use super::ensure_session_mod_scope;
use crate::{
    errors::AppError,
    models::command_payloads::{LoadEditableFilePayload, SaveTextFilePayload},
    models::{EditableFileData, WriteResult},
    services,
};

#[tauri::command(async)]
pub fn load_editable_file(payload: LoadEditableFilePayload) -> Result<EditableFileData, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::file_editor::load_editable_file(&payload.mod_root, payload.path)
}

#[tauri::command(async)]
pub fn save_text_file(payload: SaveTextFilePayload) -> Result<WriteResult, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::file_editor::save_text_file(&payload.mod_root, &payload.path, payload.text)
}
