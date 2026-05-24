use crate::{
    models::{UploadSpritePayload, UploadSpriteResult},
    services,
};
use serde_json::Value;
use std::collections::BTreeMap;

#[tauri::command]
pub fn upload_sprite(payload: UploadSpritePayload) -> Result<UploadSpriteResult, String> {
    services::config::upload_sprite(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_fields(starsector_root: String) -> BTreeMap<String, Vec<Value>> {
    services::config::scan_core_fields(&starsector_root)
}

#[tauri::command]
pub fn scan_core_graphics(starsector_root: String) -> Vec<String> {
    services::config::scan_core_graphics(&starsector_root)
}
