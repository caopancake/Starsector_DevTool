use crate::{
    models::{command_payloads::SaveCsvPatchPayload, WriteResult},
    services,
};

#[tauri::command]
pub fn save_csv_patch(payload: SaveCsvPatchPayload) -> Result<WriteResult, String> {
    services::project::save_csv_patch(
        &payload.session_id,
        payload.table,
        payload.patches,
        payload.associated_files,
    )
    .map_err(|e| e.to_string())
}
