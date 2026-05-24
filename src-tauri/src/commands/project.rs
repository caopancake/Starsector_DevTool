use crate::{
    models::{
        CsvSourceOptionsPayload, CsvTableWindow, CsvTableWindowPayload, EntityData,
        GameOverviewData, HullReferencesPayload, HullReferencesResult, InvalidateCoreCachePayload,
        InvalidateProjectSessionPayload, OpenDirectoryResult, ProjectManifest,
        QueryEntityListPayload, QueryEntityPayload, ResourceDataUrlBatchPayload,
        ResourceDataUrlBatchResult, SourceOptionGroup,
    },
    services,
};

#[tauri::command]
pub fn open_project_session(
    app_handle: tauri::AppHandle,
    mod_root: String,
    starsector_root: Option<String>,
) -> Result<ProjectManifest, String> {
    services::project::open_project_session_with_root_for_command(
        app_handle,
        mod_root,
        starsector_root,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_project_session(session_id: String) -> Result<(), String> {
    services::project::close_project_session_for_command(session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_csv_table_window(payload: CsvTableWindowPayload) -> Result<CsvTableWindow, String> {
    services::project::query_csv_table_window_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_csv_source_options(
    payload: CsvSourceOptionsPayload,
) -> Result<Vec<SourceOptionGroup>, String> {
    services::project::query_csv_source_options_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_hull_references(
    payload: HullReferencesPayload,
) -> Result<HullReferencesResult, String> {
    services::project::query_hull_references_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_entity(payload: QueryEntityPayload) -> Result<Option<EntityData>, String> {
    services::project::query_entity_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_entity_list(payload: QueryEntityListPayload) -> Result<Vec<EntityData>, String> {
    services::project::query_entity_list_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn query_resource_data_urls(
    payload: ResourceDataUrlBatchPayload,
) -> Result<ResourceDataUrlBatchResult, String> {
    services::project::query_resource_data_urls_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn invalidate_project_session(payload: InvalidateProjectSessionPayload) -> Result<(), String> {
    services::project::invalidate_project_session_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn invalidate_core_cache(payload: InvalidateCoreCachePayload) -> Result<(), String> {
    services::project::invalidate_core_cache_for_command(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_directory(
    path: String,
    fallback_starsector_root: Option<String>,
) -> OpenDirectoryResult {
    services::project::detect_directory_for_command(path, fallback_starsector_root)
}

#[tauri::command]
pub fn scan_game_overview(starsector_root: String) -> GameOverviewData {
    services::project::scan_game_overview_for_command(starsector_root)
}
