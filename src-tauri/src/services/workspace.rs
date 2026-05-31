use crate::{
    errors::{AppError, AppResult},
    io::{read_utf8_no_bom, write_utf8_no_bom},
    models::PersistedWorkspace,
    services::app_paths,
};
use std::{fs, path::Path};

const WORKSPACE_FILE: &str = "workspace.json";

pub fn load_app_workspace(app_handle: tauri::AppHandle) -> AppResult<PersistedWorkspace> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    load_workspace(&app_data)
}

pub fn save_app_workspace(
    app_handle: tauri::AppHandle,
    state: PersistedWorkspace,
) -> AppResult<()> {
    let app_data = app_paths::app_data_dir(app_handle)?;
    save_workspace(&app_data, &state)
}

pub fn load_workspace(app_data_dir: &Path) -> AppResult<PersistedWorkspace> {
    let path = app_data_dir.join(WORKSPACE_FILE);
    if !path.exists() {
        return Ok(PersistedWorkspace::default());
    }
    let text = read_utf8_no_bom(&path)?;
    serde_json::from_str::<PersistedWorkspace>(&text).map_err(|error| {
        AppError::context(
            format!("解析工作区状态文件失败 ({})", path.display()),
            error.into(),
        )
    })
}

pub fn save_workspace(app_data_dir: &Path, state: &PersistedWorkspace) -> AppResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        AppError::context(
            format!("创建工作区状态目录失败 ({})", app_data_dir.display()),
            error.into(),
        )
    })?;
    let path = app_data_dir.join(WORKSPACE_FILE);
    let json = serde_json::to_string_pretty(state)?;
    write_utf8_no_bom(&path, &json)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom,
        models::{PersistedMod, WorkspaceView},
    };
    use std::collections::BTreeMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn load_returns_default_when_file_missing() {
        let dir = temp_dir("ws_missing");
        let result = load_workspace(&dir).unwrap();
        let _ = fs::remove_dir_all(&dir);
        assert!(result.mods.is_empty());
        assert!(result.active_mod_root.is_none());
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = temp_dir("ws_roundtrip");
        let state = PersistedWorkspace {
            mods: vec![PersistedMod {
                mod_root: "D:/mods/test".to_string(),
                display_name: "Test Mod".to_string(),
                version: "1.0".to_string(),
            }],
            active_mod_root: Some("D:/mods/test".to_string()),
            current_view: Some(WorkspaceView::Table),
            expanded_mods: vec!["D:/mods/test".to_string()],
            starsector_root: Some("D:/Starsector".to_string()),
            game_mods: vec![],
            game_warnings: vec![],
            column_widths: BTreeMap::from([(
                "D:/mods/test".to_string(),
                BTreeMap::from([(
                    "ships".to_string(),
                    BTreeMap::from([("id".to_string(), 120.0)]),
                )]),
            )]),
        };
        save_workspace(&dir, &state).unwrap();
        let loaded = load_workspace(&dir).unwrap();
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(loaded.mods.len(), 1);
        assert_eq!(loaded.mods[0].display_name, "Test Mod");
        assert_eq!(loaded.active_mod_root, Some("D:/mods/test".to_string()));
        assert_eq!(loaded.column_widths["D:/mods/test"]["ships"]["id"], 120.0);
    }

    #[test]
    fn load_reports_corrupted_json() {
        let dir = temp_dir("ws_corrupted");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(&dir.join("workspace.json"), "not valid json{{{").unwrap();
        let result = load_workspace(&dir);
        let _ = fs::remove_dir_all(&dir);
        assert!(result.is_err());
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
