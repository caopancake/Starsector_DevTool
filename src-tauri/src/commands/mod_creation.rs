use crate::{
    models::{CreateModPayload, CreatedMod},
    services,
};

#[tauri::command]
pub fn create_mod(payload: CreateModPayload) -> Result<CreatedMod, String> {
    services::mod_creation::create_mod(payload.destination, payload.template)
        .map_err(|error| error.to_string())
}
