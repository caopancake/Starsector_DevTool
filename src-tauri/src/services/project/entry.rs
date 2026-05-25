use super::{performance::PerformanceTrace, session};
use crate::{
    errors::AppResult,
    models::{AppLogEntry, AppLogLevel, ProjectManifest},
    services::app_log,
};
use std::path::Path;

pub fn open_project_session_with_root(
    app_handle: tauri::AppHandle,
    mod_root: String,
    starsector_root: Option<String>,
) -> AppResult<ProjectManifest> {
    let mut trace = PerformanceTrace::new("project.openSession");
    let result = session::open_project_session_traced(
        Path::new(&mod_root),
        starsector_root.as_deref().map(Path::new),
        &mut trace,
    );
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
