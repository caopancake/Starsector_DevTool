use super::ensure_session_mod_scope;
use crate::{
    errors::AppError,
    models::command_payloads::{
        DeleteIndexedConfigEntityPayload, DeleteSkinEntityPayload, DeleteVariantEntityPayload,
        IndexedConfigEntityPayload, LoadImportedEditorSpecPayload, SaveEditorSpecPayload,
        SkinEntityPayload, VariantEntityPayload,
    },
    models::{EntityKind, WriteResult},
    services,
};
use serde_json::Value;

#[tauri::command(async)]
pub fn load_imported_editor_spec_file(
    payload: LoadImportedEditorSpecPayload,
) -> Result<Value, AppError> {
    services::editor_config::load_imported_editor_spec_file(payload.kind, payload.path)
}

#[tauri::command(async)]
pub fn save_editor_spec(payload: SaveEditorSpecPayload) -> Result<WriteResult, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::save_editor_spec(
        &payload.mod_root,
        payload.kind,
        &payload.id,
        payload.data,
    )
}

#[tauri::command(async)]
pub fn save_indexed_config_entity(
    payload: IndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::save_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        payload.previous_id.as_deref(),
        &payload.next_id,
        payload.index_row,
        payload.entity_data,
        payload.delete_previous_target,
    )
}

#[tauri::command(async)]
pub fn create_indexed_config_entity(
    payload: IndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::create_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        &payload.next_id,
        payload.index_row,
        payload.entity_data,
    )
}

#[tauri::command(async)]
pub fn delete_indexed_config_entity(
    payload: DeleteIndexedConfigEntityPayload,
) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::delete_indexed_config_entity(
        &payload.mod_root,
        payload.kind,
        &payload.id,
        payload.delete_target,
    )
}

#[tauri::command(async)]
pub fn save_variant_entity(payload: VariantEntityPayload) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::save_spec_entity(
        &payload.mod_root,
        EntityKind::Variant,
        payload.previous_id.as_deref(),
        &payload.next_id,
        payload.data,
    )
}

#[tauri::command(async)]
pub fn create_variant_entity(
    payload: VariantEntityPayload,
) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::create_spec_entity(
        &payload.mod_root,
        EntityKind::Variant,
        &payload.next_id,
        payload.data,
    )
}

#[tauri::command(async)]
pub fn delete_variant_entity(payload: DeleteVariantEntityPayload) -> Result<WriteResult, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::delete_spec_entity(
        &payload.mod_root,
        EntityKind::Variant,
        &payload.entity_id,
        &payload.rel_path,
    )
}

#[tauri::command(async)]
pub fn save_skin_entity(payload: SkinEntityPayload) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::save_spec_entity(
        &payload.mod_root,
        EntityKind::Skin,
        payload.previous_id.as_deref(),
        &payload.next_id,
        payload.data,
    )
}

#[tauri::command(async)]
pub fn create_skin_entity(payload: SkinEntityPayload) -> Result<WriteResult<Value>, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::create_spec_entity(
        &payload.mod_root,
        EntityKind::Skin,
        &payload.next_id,
        payload.data,
    )
}

#[tauri::command(async)]
pub fn delete_skin_entity(payload: DeleteSkinEntityPayload) -> Result<WriteResult, AppError> {
    ensure_session_mod_scope(&payload)?;
    services::editor_config::delete_spec_entity(
        &payload.mod_root,
        EntityKind::Skin,
        &payload.entity_id,
        &payload.rel_path,
    )
}
