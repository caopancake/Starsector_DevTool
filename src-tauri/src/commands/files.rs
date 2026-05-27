use crate::{
    models::command_payloads::{
        ApplyFileChangeSetPayload, LoadEditableFilePayload, SaveEditorSpecPayload,
        SaveModFilesPayload, SaveTextFilePayload,
    },
    models::{EditableFileData, WriteResult},
    services,
};
use serde_json::Value;

#[tauri::command]
pub fn load_editable_file(payload: LoadEditableFilePayload) -> Result<EditableFileData, String> {
    services::file_changes::load_editable_file(payload.path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_json_spec_file(path: String) -> Result<Value, String> {
    services::file_changes::load_json_spec_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_text_file(payload: SaveTextFilePayload) -> Result<WriteResult, String> {
    services::file_changes::save_text_file(&payload.path, payload.text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_editor_spec(payload: SaveEditorSpecPayload) -> Result<WriteResult, String> {
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
    services::file_changes::save_mod_files(&payload.mod_root, payload.files)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> Result<WriteResult, String> {
    services::file_changes::apply_file_change_set(payload.direction, payload.changes)
        .map_err(|e| e.to_string())
}
