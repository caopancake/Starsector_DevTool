use crate::{
    errors::{AppError, AppResult},
    models::{
        GameOverviewData, OpenDirectoryResult, ProjectManifest,
        command_payloads::{
            DetectDirectoryPayload, OpenProjectSessionPayload, ScanGameOverviewPayload,
        },
    },
    services,
};

#[tauri::command(async)]
pub fn open_project_session(
    app_handle: tauri::AppHandle,
    payload: OpenProjectSessionPayload,
) -> Result<ProjectManifest, AppError> {
    services::directory_opening::open_project_session_with_root(
        app_handle,
        payload.mod_root,
        payload.starsector_root,
    )
}

#[tauri::command(async)]
pub fn detect_directory(payload: DetectDirectoryPayload) -> AppResult<OpenDirectoryResult> {
    services::directory_opening::detect_directory(
        std::path::Path::new(&payload.path),
        payload.known_starsector_root.as_deref(),
    )
}

#[tauri::command(async)]
pub fn scan_game_overview(payload: ScanGameOverviewPayload) -> AppResult<GameOverviewData> {
    services::directory_opening::scan_game_overview(std::path::Path::new(&payload.starsector_root))
}
