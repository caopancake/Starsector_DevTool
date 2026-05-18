use crate::{
    models::{
        ApplyFileChangeSetPayload, EditableFileData, FileChangeRecord, SaveJsonWithHistoryPayload,
        SaveModFilesWithHistoryPayload, SaveTextFileWithHistoryPayload,
    },
    services,
};

#[tauri::command]
pub fn load_editable_file(path: String) -> Result<EditableFileData, String> {
    services::file_changes::load_editable_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_text_file_with_history(
    payload: SaveTextFileWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::file_changes::save_text_file_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_json_with_history(
    payload: SaveJsonWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::editor_specs::save_json_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mod_files_with_history(
    payload: SaveModFilesWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::file_changes::save_mod_files_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> Result<(), String> {
    services::file_changes::apply_file_change_set(payload).map_err(|e| e.to_string())
}
