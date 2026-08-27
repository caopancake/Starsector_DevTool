use crate::{
    models::{
        command_payloads::{CoreScanPayload, ResolveModRelativePathPayload},
        DiscoveredField,
    },
    services,
};
use std::collections::BTreeMap;

#[tauri::command]
pub fn resolve_mod_relative_path(payload: ResolveModRelativePathPayload) -> Result<String, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::project::resolve_mod_relative_path(&payload.mod_root, &payload.absolute_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_fields(
    payload: CoreScanPayload,
) -> Result<BTreeMap<String, Vec<DiscoveredField>>, String> {
    services::schema::scan_core_fields(&payload.starsector_root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_graphics(payload: CoreScanPayload) -> Result<Vec<String>, String> {
    services::project::scan_core_graphics(&payload.starsector_root).map_err(|e| e.to_string())
}
