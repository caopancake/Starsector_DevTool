use crate::{
    models::{
        DeleteIndexedConfigEntityPayload, DeleteSkinEntityPayload, DeleteVariantEntityPayload,
        FileChangeRecord, IndexedConfigEntityPayload, IndexedConfigEntityResult, SkinEntityPayload,
        SkinEntityResult, VariantEntityPayload, VariantEntityResult,
    },
    services,
};

#[tauri::command]
pub fn save_indexed_config_entity_with_history(
    payload: IndexedConfigEntityPayload,
) -> Result<IndexedConfigEntityResult, String> {
    services::config::save_indexed_config_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_indexed_config_entity_with_history(
    payload: IndexedConfigEntityPayload,
) -> Result<IndexedConfigEntityResult, String> {
    services::config::create_indexed_config_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_indexed_config_entity_with_history(
    payload: DeleteIndexedConfigEntityPayload,
) -> Result<IndexedConfigEntityResult, String> {
    services::config::delete_indexed_config_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_variant_entity_with_history(
    payload: VariantEntityPayload,
) -> Result<VariantEntityResult, String> {
    services::config::save_variant_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_variant_entity_with_history(
    payload: VariantEntityPayload,
) -> Result<VariantEntityResult, String> {
    services::config::create_variant_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_variant_entity_with_history(
    payload: DeleteVariantEntityPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::config::delete_variant_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_skin_entity_with_history(
    payload: SkinEntityPayload,
) -> Result<SkinEntityResult, String> {
    services::config::save_skin_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_skin_entity_with_history(
    payload: SkinEntityPayload,
) -> Result<SkinEntityResult, String> {
    services::config::create_skin_entity(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_skin_entity_with_history(
    payload: DeleteSkinEntityPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::config::delete_skin_entity(payload).map_err(|e| e.to_string())
}
