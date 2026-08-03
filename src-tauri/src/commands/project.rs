use crate::{
    models::command_payloads::{
        CloseProjectSessionPayload, CsvRowPreviewPayload, CsvSourceOptionsPayload,
        CsvTableWindowPayload, HullReferencesPayload, InvalidateCoreCachePayload,
        InvalidateProjectSessionPayload, QueryEntityListPayload, QueryEntityPayload,
        ResourceDataUrlBatchPayload,
    },
    models::{
        CsvRowPreview, CsvTableWindow, EntityData, HullReferencesResult,
        ProjectSessionInvalidationResult, ResourceDataUrlBatchResult, SourceOptionGroup,
    },
    services,
};

#[tauri::command]
pub fn close_project_session(payload: CloseProjectSessionPayload) -> Result<(), String> {
    services::project::close_project_session(payload.session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_csv_table_window(payload: CsvTableWindowPayload) -> Result<CsvTableWindow, String> {
    services::project::query_csv_table_window(
        &payload.session_id,
        payload.table,
        payload.start,
        payload.count,
        payload.search,
        payload.faction,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_csv_source_options(
    payload: CsvSourceOptionsPayload,
) -> Result<Vec<SourceOptionGroup>, String> {
    services::project::query_csv_source_options(
        &payload.session_id,
        &payload.source,
        &payload.current_values,
        payload.search,
        payload.limit,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_csv_row_preview(payload: CsvRowPreviewPayload) -> Result<CsvRowPreview, String> {
    services::project::query_csv_row_preview(&payload.session_id, payload.table, &payload.row_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_hull_references(
    payload: HullReferencesPayload,
) -> Result<HullReferencesResult, String> {
    services::project::query_hull_references(&payload.session_id, &payload.reference_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_entity(payload: QueryEntityPayload) -> Result<Option<EntityData>, String> {
    services::project::query_entity(&payload.session_id, payload.kind, &payload.id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_entity_list(payload: QueryEntityListPayload) -> Result<Vec<EntityData>, String> {
    services::project::query_entity_list(&payload.session_id, payload.kind)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_resource_data_urls(
    payload: ResourceDataUrlBatchPayload,
) -> Result<ResourceDataUrlBatchResult, String> {
    services::project::query_resource_data_urls(&payload.session_id, payload.resources)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn invalidate_project_session(
    payload: InvalidateProjectSessionPayload,
) -> Result<ProjectSessionInvalidationResult, String> {
    services::project::invalidate_project_session(&payload.session_id, payload.changes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn invalidate_core_cache(payload: InvalidateCoreCachePayload) -> Result<(), String> {
    services::project::invalidate_core_cache(&payload.starsector_root).map_err(|e| e.to_string())
}
