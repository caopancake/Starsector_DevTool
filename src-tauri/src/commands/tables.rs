use crate::{
    models::{SaveCsvPatchResult, SaveCsvPatchWithHistoryPayload},
    services,
};

#[tauri::command]
pub fn save_csv_patch_with_history(
    payload: SaveCsvPatchWithHistoryPayload,
) -> Result<SaveCsvPatchResult, String> {
    services::project::save_csv_patch_for_command(payload).map_err(|e| e.to_string())
}
