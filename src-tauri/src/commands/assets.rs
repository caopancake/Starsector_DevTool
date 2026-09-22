use super::ensure_session_mod_scope;
use crate::{
    errors::AppError,
    models::{
        DiscoveredField,
        command_payloads::{CoreScanPayload, ResolveModRelativePathPayload},
    },
    services,
};
use std::collections::BTreeMap;

#[tauri::command(async)]
pub fn resolve_mod_relative_path(
    payload: ResolveModRelativePathPayload,
) -> Result<String, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::project::resolve_mod_relative_path(&payload.mod_root, &payload.absolute_path)
}

#[tauri::command(async)]
pub fn scan_core_fields(
    payload: CoreScanPayload,
) -> Result<BTreeMap<String, Vec<DiscoveredField>>, AppError> {
    services::schema::scan_core_fields(&payload.starsector_root)
}

#[tauri::command(async)]
pub fn scan_core_graphics(payload: CoreScanPayload) -> Result<Vec<String>, AppError> {
    services::project::scan_core_graphics(&payload.starsector_root)
}
