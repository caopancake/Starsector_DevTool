use crate::{
    models::command_payloads::{
        ApplyFileChangeSetPayload, LoadEditableFilePayload, LoadImportedEditorSpecPayload,
        SaveEditorSpecPayload, SaveModFilesPayload, SaveTextFilePayload,
    },
    models::{EditableFileData, WriteResult},
    services,
};
use serde_json::Value;

#[tauri::command]
pub fn load_editable_file(payload: LoadEditableFilePayload) -> Result<EditableFileData, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::file_changes::load_editable_file(&payload.mod_root, payload.path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_imported_editor_spec_file(
    payload: LoadImportedEditorSpecPayload,
) -> Result<Value, String> {
    services::editor_specs::load_imported_editor_spec_file(payload.kind, payload.path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_text_file(payload: SaveTextFilePayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::file_changes::save_text_file(&payload.mod_root, &payload.path, payload.text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_editor_spec(payload: SaveEditorSpecPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::editor_specs::save_editor_spec(
        &payload.mod_root,
        payload.kind,
        &payload.id,
        payload.data,
    )
    .map_err(|e| e.to_string())
}

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
