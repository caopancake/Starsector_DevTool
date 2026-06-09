use crate::{
    models::{
        command_payloads::{
            DetectDirectoryPayload, OpenProjectSessionPayload, ScanGameOverviewPayload,
        },
        GameOverviewData, OpenDirectoryResult, ProjectManifest,
    },
    services,
};

#[tauri::command]
pub fn open_project_session(
    app_handle: tauri::AppHandle,
    payload: OpenProjectSessionPayload,
) -> Result<ProjectManifest, String> {
    services::directory_opening::open_project_session_with_root(
        app_handle,
        payload.mod_root,
        payload.starsector_root,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_directory(payload: DetectDirectoryPayload) -> OpenDirectoryResult {
    services::directory_opening::detect_directory(
        std::path::Path::new(&payload.path),
        payload.known_starsector_root.as_deref(),
    )
}

#[tauri::command]
pub fn scan_game_overview(payload: ScanGameOverviewPayload) -> GameOverviewData {
    services::directory_opening::scan_game_overview(std::path::Path::new(&payload.starsector_root))
}
