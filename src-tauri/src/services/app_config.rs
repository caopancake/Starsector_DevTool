use crate::{
    errors::{AppError, AppResult},
    models::{AppLogEntry, AppLogStatus, AppSettings},
    services::app_paths,
};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const LOG_FILE: &str = "starsector-devtool.log";
const SETTINGS_FILE: &str = "settings.json";

pub fn append_log_for_app(app_handle: tauri::AppHandle, entry: AppLogEntry) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    append_log(&app_data, &entry)
}

pub fn log_status_for_app(app_handle: tauri::AppHandle) -> AppResult<AppLogStatus> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    log_status(&app_data)
}

pub fn open_config_dir_for_app(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    fs::create_dir_all(&app_data).map_err(|error| {
        AppError::context(
            format!("创建配置目录失败 ({})", app_data.display()),
            error.into(),
        )
    })?;
    open_path(&app_data)
}

pub fn open_log_file_for_app(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    ensure_log_file(&app_data)?;
    open_path(&log_path(&app_data))
}

pub fn clear_config_files_for_app(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    clear_config_files(&app_data)
}

pub fn clear_log_file_for_app(app_handle: tauri::AppHandle) -> AppResult<AppLogStatus> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    clear_log_file(&app_data)?;
    log_status(&app_data)
}

pub fn load_settings_for_app(app_handle: tauri::AppHandle) -> AppResult<AppSettings> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    load_settings(&app_data)
}

pub fn save_settings_for_app(app_handle: tauri::AppHandle, settings: AppSettings) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    save_settings(&app_data, &settings)
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

pub fn clear_config_files(app_data_dir: &Path) -> AppResult<()> {
    if !app_data_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(app_data_dir).map_err(|error| {
        AppError::context(
            format!("读取配置目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })? {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("读取配置目录项失败 ({})", app_data_dir.display()),
                error.into(),
            )
        })?;
        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some(LOG_FILE) {
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|error| {
                AppError::context(
                    format!("删除配置目录失败 ({})", path.display()),
                    error.into(),
                )
            })?;
        } else {
            fs::remove_file(&path).map_err(|error| {
                AppError::context(
                    format!("删除配置文件失败 ({})", path.display()),
                    error.into(),
                )
            })?;
        }
    }
    Ok(())
}

pub fn clear_log_file(app_data_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建日志目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = log_path(app_data_dir);
    fs::write(&path, []).map_err(|error| {
        AppError::context(
            format!("清除日志文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    Ok(())
}

pub fn load_settings(app_data_dir: &Path) -> AppResult<AppSettings> {
    let path = settings_path(app_data_dir);
    match fs::read_to_string(&path) {
        Ok(text) => Ok(serde_json::from_str(&text).unwrap_or_default()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(AppSettings::default()),
        Err(error) => Err(AppError::context(
            format!("读取配置文件失败 ({})", path.display()),
            error.into(),
        )),
    }
}

pub fn save_settings(app_data_dir: &Path, settings: &AppSettings) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建配置目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = settings_path(app_data_dir);
    let text = serde_json::to_string_pretty(settings)
        .map_err(|error| AppError::context("序列化配置文件失败".to_string(), error.into()))?;
    fs::write(&path, text).map_err(|error| {
        AppError::context(
            format!("写入配置文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    Ok(())
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
    fs::write(&path, []).map_err(|error| {
        AppError::context(
            format!("创建日志文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    Ok(())
}

fn log_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(LOG_FILE)
}

fn settings_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SETTINGS_FILE)
}

fn render_log_entry(entry: &AppLogEntry) -> String {
    let mut line = format!(
        "[{}] [{}] {}",
        timestamp_seconds(),
        entry.level,
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

fn open_path(path: &Path) -> AppResult<()> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn append_log_and_status_roundtrip() {
        let dir = temp_dir("log_roundtrip");
        append_log(
            &dir,
            &AppLogEntry {
                level: "warning".to_string(),
                message: "测试 warning".to_string(),
                path: Some("D:/test/file.csv".to_string()),
                line: Some(3),
            },
        )
        .unwrap();
        let status = log_status(&dir).unwrap();
        let text = fs::read_to_string(dir.join(LOG_FILE)).unwrap();
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
                level: "info".to_string(),
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

    #[test]
    fn clear_config_files_keeps_log() {
        let dir = temp_dir("config_clear");
        fs::write(dir.join("workspace.json"), b"{}").unwrap();
        save_settings(&dir, &AppSettings::default()).unwrap();
        fs::create_dir_all(dir.join("nested")).unwrap();
        fs::write(dir.join("nested/file.json"), b"{}").unwrap();
        append_log(
            &dir,
            &AppLogEntry {
                level: "info".to_string(),
                message: "keep".to_string(),
                path: None,
                line: None,
            },
        )
        .unwrap();
        clear_config_files(&dir).unwrap();
        let log_exists = dir.join(LOG_FILE).exists();
        let workspace_exists = dir.join("workspace.json").exists();
        let settings_exists = dir.join(SETTINGS_FILE).exists();
        let nested_exists = dir.join("nested").exists();
        let _ = fs::remove_dir_all(dir);
        assert!(log_exists);
        assert!(!workspace_exists);
        assert!(!settings_exists);
        assert!(!nested_exists);
    }

    #[test]
    fn load_settings_returns_default_when_missing() {
        let dir = temp_dir("settings_missing");
        let settings = load_settings(&dir).unwrap();
        let _ = fs::remove_dir_all(dir);
        assert_eq!(settings, AppSettings::default());
    }

    #[test]
    fn save_and_load_settings_roundtrip() {
        let dir = temp_dir("settings_roundtrip");
        let settings = AppSettings {
            theme: "dark".to_string(),
            accent: "custom".to_string(),
            custom_accent: "#16a34a".to_string(),
            history_limit: 42,
            edit_mode: "plain".to_string(),
            starsector_root: "D:/Starsector".to_string(),
        };
        save_settings(&dir, &settings).unwrap();
        let loaded = load_settings(&dir).unwrap();
        let _ = fs::remove_dir_all(dir);
        assert_eq!(loaded, settings);
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
