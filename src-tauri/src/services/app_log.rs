use crate::{
    errors::{AppError, AppResult},
    io::write_utf8_no_bom,
    models::{AppLogEntry, AppLogStatus},
    services::{app_paths, system_open},
};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub const LOG_FILE: &str = "starsector-devtool.log";

pub fn append_app_log(app_handle: tauri::AppHandle, entry: AppLogEntry) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    append_log(&app_data, &entry)
}

pub fn app_log_status(app_handle: tauri::AppHandle) -> AppResult<AppLogStatus> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    log_status(&app_data)
}

pub fn open_app_log_file(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    ensure_log_file(&app_data)?;
    system_open::open_path(&log_path(&app_data))
}

pub fn clear_app_log_file(app_handle: tauri::AppHandle) -> AppResult<AppLogStatus> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    clear_log_file(&app_data)?;
    log_status(&app_data)
}

pub fn append_log(app_data_dir: &Path, entry: &AppLogEntry) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建日志目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = log_path(app_data_dir);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| {
            AppError::context(
                format!("打开日志文件失败 ({})", path.display()),
                error.into(),
            )
        })?;
    file.write_all(render_log_entry(entry).as_bytes())
        .map_err(|error| {
            AppError::context(
                format!("写入日志文件失败 ({})", path.display()),
                error.into(),
            )
        })?;
    Ok(())
}

pub fn log_status(app_data_dir: &Path) -> AppResult<AppLogStatus> {
    let path = log_path(app_data_dir);
    let size_bytes = match fs::metadata(&path) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
        Err(error) => {
            return Err(AppError::context(
                format!("读取日志文件状态失败 ({})", path.display()),
                error.into(),
            ));
        }
    };
    Ok(AppLogStatus {
        path: path.to_string_lossy().to_string(),
        size_bytes,
    })
}

pub fn clear_log_file(app_data_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建日志目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = log_path(app_data_dir);
    write_utf8_no_bom(&path, "").map_err(|error| {
        AppError::context(format!("清除日志文件失败 ({})", path.display()), error)
    })?;
    Ok(())
}

pub fn log_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(LOG_FILE)
}

fn ensure_log_file(app_data_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建日志目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = log_path(app_data_dir);
    if path.exists() {
        return Ok(());
    }
    write_utf8_no_bom(&path, "").map_err(|error| {
        AppError::context(format!("创建日志文件失败 ({})", path.display()), error)
    })?;
    Ok(())
}

fn render_log_entry(entry: &AppLogEntry) -> String {
    let mut line = format!(
        "[{}] [{}] {}",
        timestamp_seconds(),
        entry.level.as_str(),
        entry.message
    );
    if let Some(path) = &entry.path {
        line.push_str(" | path=");
        line.push_str(path);
    }
    if let Some(line_number) = entry.line {
        line.push_str(" | line=");
        line.push_str(&line_number.to_string());
    }
    line.push_str("\r\n");
    line
}

fn timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::read_utf8_no_bom;

    #[test]
    fn append_log_and_status_roundtrip() {
        let dir = temp_dir("log_roundtrip");
        append_log(
            &dir,
            &AppLogEntry {
                level: crate::models::AppLogLevel::Warning,
                message: "测试 warning".to_string(),
                path: Some("D:/test/file.csv".to_string()),
                line: Some(3),
            },
        )
        .unwrap();
        let status = log_status(&dir).unwrap();
        let text = read_utf8_no_bom(&dir.join(LOG_FILE)).unwrap();
        let _ = fs::remove_dir_all(dir);
        assert!(status.size_bytes > 0);
        assert!(text.contains("[warning] 测试 warning"));
        assert!(text.contains("path=D:/test/file.csv"));
        assert!(text.contains("line=3"));
    }

    #[test]
    fn clear_log_file_keeps_empty_file() {
        let dir = temp_dir("log_clear");
        append_log(
            &dir,
            &AppLogEntry {
                level: crate::models::AppLogLevel::Info,
                message: "hello".to_string(),
                path: None,
                line: None,
            },
        )
        .unwrap();
        clear_log_file(&dir).unwrap();
        let status = log_status(&dir).unwrap();
        let _ = fs::remove_dir_all(dir);
        assert_eq!(status.size_bytes, 0);
    }

    fn temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
