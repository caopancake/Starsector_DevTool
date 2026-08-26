use crate::{
    models::command_payloads::{LoadEditableFilePayload, SaveTextFilePayload},
    models::{EditableFileData, WriteResult},
    services,
};

#[tauri::command]
pub fn load_editable_file(payload: LoadEditableFilePayload) -> Result<EditableFileData, String> {
    if let Some(session_id) = &payload.session_id {
        services::project::ensure_project_session_mod_root(session_id, &payload.mod_root)
            .map_err(|e| e.to_string())?;
    }
    services::file_editor::load_editable_file(&payload.mod_root, payload.path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_text_file(payload: SaveTextFilePayload) -> Result<WriteResult, String> {
    if let Some(session_id) = &payload.session_id {
        services::project::ensure_project_session_mod_root(session_id, &payload.mod_root)
            .map_err(|e| e.to_string())?;
    }
    services::file_editor::save_text_file(&payload.mod_root, &payload.path, payload.text)
        .map_err(|e| e.to_string())
}
