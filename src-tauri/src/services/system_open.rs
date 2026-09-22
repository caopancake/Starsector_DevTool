use crate::errors::{AppError, AppResult};
use std::{path::Path, process::Command};

pub fn open_path(path: &Path) -> AppResult<()> {
    if cfg!(target_os = "windows") {
        // explorer.exe is not trusted to report a meaningful exit code (it
        // often exits non-zero on success), so only spawn failures are errors.
        // Directories open in place; files are located in the containing
        // folder instead of launching an external handler.
        let launch = if path.is_dir() {
            Command::new("explorer").arg(path).status()
        } else {
            Command::new("explorer")
                .arg(format!("/select,{}", path.display()))
                .status()
        };
        launch.map_err(|error| {
            AppError::context(format!("打开路径失败 ({})", path.display()), error.into())
        })?;
        return Ok(());
    }
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(path).status()
    } else {
        Command::new("xdg-open").arg(path).status()
    }
    .map_err(|error| {
        AppError::context(format!("打开路径失败 ({})", path.display()), error.into())
    })?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::message(
            "system_open.failed",
            format!("打开路径失败 ({})", path.display()),
        ))
    }
}
