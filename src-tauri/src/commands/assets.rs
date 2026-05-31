use crate::{
    models::{
        command_payloads::{CoreScanPayload, UploadSpritePayload},
        DiscoveredField, WriteResult,
    },
    services,
};
use serde_json::Value;
use std::collections::BTreeMap;

#[tauri::command]
pub fn upload_sprite(payload: UploadSpritePayload) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::upload_sprite(
        &payload.mod_root,
        &payload.filename,
        payload.data,
        payload.subfolder,
        payload.overwrite,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_fields(
    payload: CoreScanPayload,
) -> Result<BTreeMap<String, Vec<DiscoveredField>>, String> {
    services::config::scan_core_fields(&payload.starsector_root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_graphics(payload: CoreScanPayload) -> Result<Vec<String>, String> {
    services::config::scan_core_graphics(&payload.starsector_root).map_err(|e| e.to_string())
}
