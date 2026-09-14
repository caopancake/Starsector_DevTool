use crate::{
    errors::AppError,
    models::{WriteResult, command_payloads::SaveCsvPatchPayload},
    services,
};

#[tauri::command(async)]
pub fn save_csv_patch(payload: SaveCsvPatchPayload) -> Result<WriteResult, AppError> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)?;
    services::project::save_csv_patch(
        &payload.session_id,
        payload.table,
        payload.patches,
        payload.associated_specs,
    )
}
