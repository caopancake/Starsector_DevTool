use crate::{
    models::command_payloads::{
        DeleteIndexedConfigEntityPayload, DeleteSkinEntityPayload, DeleteVariantEntityPayload,
        IndexedConfigEntityPayload, SkinEntityPayload, VariantEntityPayload,
    },
    models::WriteResult,
    services,
};
use serde_json::Value;

#[tauri::command]
pub fn save_indexed_config_entity(
    payload: IndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::save_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        payload.previous_id.as_deref(),
        &payload.next_id,
        payload.index_row,
        payload.entity_data,
        payload.delete_previous_target,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_indexed_config_entity(
    payload: IndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::create_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        &payload.next_id,
        payload.index_row,
        payload.entity_data,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_indexed_config_entity(
    payload: DeleteIndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::delete_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        &payload.id,
        payload.delete_target,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_variant_entity(payload: VariantEntityPayload) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::save_variant_entity(
        &payload.mod_root,
        payload.previous_id.as_deref(),
        payload.previous_rel_path.as_deref(),
        &payload.next_id,
        payload.data,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_variant_entity(payload: VariantEntityPayload) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::create_variant_entity(&payload.mod_root, &payload.next_id, payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_variant_entity(payload: DeleteVariantEntityPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::delete_variant_entity(
        &payload.mod_root,
        &payload.variant_id,
        &payload.rel_path,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_skin_entity(payload: SkinEntityPayload) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::save_skin_entity(
        &payload.mod_root,
        payload.previous_id.as_deref(),
        payload.previous_rel_path.as_deref(),
        &payload.next_id,
        payload.data,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_skin_entity(payload: SkinEntityPayload) -> Result<WriteResult<Value>, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::create_skin_entity(&payload.mod_root, &payload.next_id, payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_skin_entity(payload: DeleteSkinEntityPayload) -> Result<WriteResult, String> {
    services::project::ensure_project_session_mod_root(&payload.session_id, &payload.mod_root)
        .map_err(|e| e.to_string())?;
    services::config::delete_skin_entity(
        &payload.mod_root,
        &payload.skin_hull_id,
        &payload.rel_path,
    )
    .map_err(|e| e.to_string())
}
