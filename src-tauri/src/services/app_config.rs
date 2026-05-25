use crate::{
    errors::{AppError, AppResult},
    services::{app_log, app_paths, system_open},
};
use std::{fs, path::Path};

pub fn open_config_dir(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    fs::create_dir_all(&app_data).map_err(|error| {
        AppError::context(
            format!("创建配置目录失败 ({})", app_data.display()),
            error.into(),
        )
    })?;
    system_open::open_path(&app_data)
}

pub fn clear_app_config_files(app_handle: tauri::AppHandle) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    clear_config_files(&app_data)
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
        if path.file_name().and_then(|name| name.to_str()) == Some(app_log::LOG_FILE) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom,
        models::{AppLogEntry, AppLogLevel},
        services::app_settings,
    };
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn clear_config_files_keeps_log() {
        let dir = temp_dir("config_clear");
        write_utf8_no_bom(&dir.join("workspace.json"), "{}").unwrap();
        app_settings::save_settings(&dir, &crate::models::AppSettings::default()).unwrap();
        fs::create_dir_all(dir.join("nested")).unwrap();
        write_utf8_no_bom(&dir.join("nested/file.json"), "{}").unwrap();
        app_log::append_log(
            &dir,
            &AppLogEntry {
                level: AppLogLevel::Info,
                message: "keep".to_string(),
                path: None,
                line: None,
            },
        )
        .unwrap();
        clear_config_files(&dir).unwrap();
        let log_exists = dir.join(app_log::LOG_FILE).exists();
        let workspace_exists = dir.join("workspace.json").exists();
        let settings_exists = app_settings::settings_path(&dir).exists();
        let nested_exists = dir.join("nested").exists();
        let _ = fs::remove_dir_all(dir);
        assert!(log_exists);
        assert!(!workspace_exists);
        assert!(!settings_exists);
        assert!(!nested_exists);
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
