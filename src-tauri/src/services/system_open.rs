use crate::errors::{AppError, AppResult};
use std::{path::Path, process::Command};

pub fn open_path(path: &Path) -> AppResult<()> {
    let status = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .status()
    } else if cfg!(target_os = "macos") {
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
        Err(AppError::message(format!(
            "打开路径失败 ({})",
            path.display()
        )))
    }
}
