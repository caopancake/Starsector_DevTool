use crate::{
    errors::AppResult,
    io::FsRootBoundary,
    models::{AppLogEntry, AppLogLevel, ProjectManifest},
    services::{
        app_log, app_paths,
        project::{
            configure_persistent_index_cache, open_project_session_traced, PerformanceTrace,
        },
    },
};
use std::path::Path;

pub fn open_project_session_with_root(
    app_handle: tauri::AppHandle,
    mod_root: String,
    starsector_root: Option<String>,
) -> AppResult<ProjectManifest> {
    if let Ok(app_data_dir) = app_paths::app_data_dir(app_handle.clone()) {
        let _ = configure_persistent_index_cache(&app_data_dir);
    }
    let mut trace = PerformanceTrace::new("project.openSession");
    let mod_root_boundary = FsRootBoundary::new(Path::new(&mod_root), "mod root")?;
    let mod_root_path = mod_root_boundary.root();
    let starsector_root = match starsector_root.as_deref() {
        Some(root) => Some(
            FsRootBoundary::new(Path::new(root), "starsector root")?
                .root()
                .to_path_buf(),
        ),
        None => super::overview::infer_starsector_root(mod_root_path),
    };
    let result = open_project_session_traced(mod_root_path, starsector_root.as_deref(), &mut trace);
    if result.is_ok() {
        write_performance_trace(app_handle, &trace, &[("modRoot", mod_root)]);
    }
    result
}

fn write_performance_trace(
    app_handle: tauri::AppHandle,
    trace: &PerformanceTrace,
    root_fields: &[(&str, String)],
) {
    for message in trace.log_messages(root_fields) {
        let _ = app_log::append_app_log(
            app_handle.clone(),
            AppLogEntry {
                level: AppLogLevel::Info,
                message,
                path: None,
                line: None,
            },
        );
    }
}
