use crate::{
    errors::{AppError, AppResult},
    models::PersistedWorkspace,
};
use std::{fs, path::Path};

const WORKSPACE_FILE: &str = "workspace.json";

pub fn load_workspace(app_data_dir: &Path) -> PersistedWorkspace {
    let path = app_data_dir.join(WORKSPACE_FILE);
    if !path.exists() {
        return PersistedWorkspace::default();
    }
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => PersistedWorkspace::default(),
    }
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
    fs::write(&path, json.as_bytes()).map_err(|error| {
        AppError::context(
            format!("写入工作区状态失败 ({})", path.display()),
            error.into(),
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::PersistedMod;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn load_returns_default_when_file_missing() {
        let dir = temp_dir("ws_missing");
        let result = load_workspace(&dir);
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
            current_view: Some("table".to_string()),
            expanded_mods: vec!["D:/mods/test".to_string()],
            starsector_root: Some("D:/Starsector".to_string()),
            game_mods: vec![],
            game_warnings: vec![],
        };
        save_workspace(&dir, &state).unwrap();
        let loaded = load_workspace(&dir);
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(loaded.mods.len(), 1);
        assert_eq!(loaded.mods[0].display_name, "Test Mod");
        assert_eq!(loaded.active_mod_root, Some("D:/mods/test".to_string()));
    }

    #[test]
    fn load_handles_corrupted_json() {
        let dir = temp_dir("ws_corrupted");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("workspace.json"), "not valid json{{{").unwrap();
        let result = load_workspace(&dir);
        let _ = fs::remove_dir_all(&dir);
        assert!(result.mods.is_empty());
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
