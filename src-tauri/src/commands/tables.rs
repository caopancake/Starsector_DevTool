use crate::{
    models::{command_payloads::SaveCsvPatchPayload, WriteResult},
    services,
};

#[tauri::command]
pub fn save_csv_patch(payload: SaveCsvPatchPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::project::save_csv_patch(
        &payload.session_id,
        payload.table,
        payload.patches,
        payload.associated_specs,
    )
    .map_err(|e| e.to_string())
}
