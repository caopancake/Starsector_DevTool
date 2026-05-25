use crate::{
    errors::{AppError, AppResult},
    io::{read_utf8_no_bom, write_utf8_no_bom},
    models::AppSettings,
    services::app_paths,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const SETTINGS_FILE: &str = "settings.json";

pub fn load_app_settings(app_handle: tauri::AppHandle) -> AppResult<AppSettings> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    load_settings(&app_data)
}

pub fn save_app_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    save_settings(&app_data, &settings)
}

pub fn load_settings(app_data_dir: &Path) -> AppResult<AppSettings> {
    let path = settings_path(app_data_dir);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let text = read_utf8_no_bom(&path)?;
    serde_json::from_str::<AppSettings>(&text).map_err(|error| {
        AppError::context(
            format!("解析配置文件失败 ({})", path.display()),
            error.into(),
        )
    })
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
    write_utf8_no_bom(&path, &text)?;
    Ok(())
}

pub fn settings_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SETTINGS_FILE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

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
        let settings: AppSettings = serde_json::from_str(
            r##"{
  "theme": "dark",
  "accent": "custom",
  "customAccent": "#16a34a",
  "historyLimit": 42,
  "editMode": "plain",
  "starsectorRoot": null
}"##,
        )
        .unwrap();
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
