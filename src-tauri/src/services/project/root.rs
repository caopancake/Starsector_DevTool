use crate::{
    io::{read_csv_data, read_json_file},
    models::{GameModSummary, GameOverviewData, GameScanWarning, OpenDirectoryResult},
};
use serde_json::{Map, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

pub fn detect_directory(
    path: &Path,
    fallback_starsector_root: Option<&str>,
) -> OpenDirectoryResult {
    let selected = path.to_string_lossy().to_string();
    if is_game_root(path) {
        let overview = scan_game_overview(path);
        return OpenDirectoryResult {
            kind: "game-root".to_string(),
            selected_path: selected,
            starsector_root: Some(path.to_string_lossy().to_string()),
            mod_root: None,
            warnings: overview.warnings.clone(),
            overview: Some(overview),
        };
    }

    if is_mod_root(path) {
        let inferred = infer_starsector_root(path);
        let overview = inferred.as_deref().map(scan_game_overview);
        let fallback = fallback_starsector_root
            .filter(|root| !root.trim().is_empty())
            .map(PathBuf::from);
        let starsector_root = inferred.or(fallback);
        return OpenDirectoryResult {
            kind: if overview.is_some() {
                "mod-in-game".to_string()
            } else {
                "external-mod".to_string()
            },
            selected_path: selected,
            starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
            mod_root: Some(path.to_string_lossy().to_string()),
            overview,
            warnings: vec![],
        };
    }

    OpenDirectoryResult {
        kind: "unknown".to_string(),
        selected_path: selected.clone(),
        starsector_root: None,
        mod_root: None,
        overview: None,
        warnings: vec![GameScanWarning {
            path: selected,
            message: "未识别为 Starsector 游戏目录或 Mod 目录".to_string(),
        }],
    }
}

pub fn detect_directory_for_command(
    path: String,
    fallback_starsector_root: Option<String>,
) -> OpenDirectoryResult {
    detect_directory(Path::new(&path), fallback_starsector_root.as_deref())
}

pub fn scan_game_overview(starsector_root: &Path) -> GameOverviewData {
    let mods_dir = starsector_root.join("mods");
    let mut warnings = Vec::new();
    let mut mods = Vec::new();

    if !starsector_root.join("starsector-core").exists() {
        warnings.push(GameScanWarning {
            path: starsector_root
                .join("starsector-core")
                .to_string_lossy()
                .to_string(),
            message: "缺少 starsector-core，原版资源回退不可用".to_string(),
        });
    }

    if !mods_dir.exists() {
        warnings.push(GameScanWarning {
            path: mods_dir.to_string_lossy().to_string(),
            message: "缺少 mods 目录".to_string(),
        });
    } else if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let mod_root = entry.path();
            if !mod_root.is_dir() {
                continue;
            }
            let mod_info_path = mod_root.join("mod_info.json");
            if !mod_info_path.exists() {
                warnings.push(GameScanWarning {
                    path: mod_root.to_string_lossy().to_string(),
                    message: "缺少 mod_info.json，已跳过".to_string(),
                });
                continue;
            }
            match read_json_file(&mod_info_path) {
                Ok(info) => mods.push(summary_from_mod_info(&mod_root, &info)),
                Err(error) => warnings.push(GameScanWarning {
                    path: mod_info_path.to_string_lossy().to_string(),
                    message: format!("读取 mod_info.json 失败: {error}"),
                }),
            }
        }
    } else {
        warnings.push(GameScanWarning {
            path: mods_dir.to_string_lossy().to_string(),
            message: "无法读取 mods 目录".to_string(),
        });
    }

    mods.sort_by_key(|summary| summary.name.to_lowercase());
    append_duplicate_id_warnings(&mods, &mut warnings);

    GameOverviewData {
        starsector_root: starsector_root.to_string_lossy().to_string(),
        core_available: starsector_root.join("starsector-core").exists(),
        mods_dir: mods_dir.to_string_lossy().to_string(),
        mods,
        warnings,
    }
}

pub fn scan_game_overview_for_command(starsector_root: String) -> GameOverviewData {
    scan_game_overview(Path::new(&starsector_root))
}

pub(super) fn is_game_root(path: &Path) -> bool {
    path.join("starsector-core").is_dir() && path.join("mods").is_dir()
}

pub(super) fn is_mod_root(path: &Path) -> bool {
    path.join("mod_info.json").is_file()
}

pub(super) fn infer_starsector_root(mod_root: &Path) -> Option<PathBuf> {
    let candidate = mod_root.parent()?.parent()?;
    is_game_root(candidate).then(|| candidate.to_path_buf())
}

pub(super) fn read_mod_info(mod_root: &Path) -> Value {
    read_json_file(&mod_root.join("mod_info.json")).unwrap_or_else(|_| {
        let mut obj = Map::new();
        let name = mod_root
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Mod");
        obj.insert("id".to_string(), Value::String(name.to_string()));
        obj.insert("name".to_string(), Value::String(name.to_string()));
        Value::Object(obj)
    })
}

pub(super) fn count_mission_list_entries(mod_root: &Path) -> usize {
    let path = mod_root.join("data/missions/mission_list.csv");
    read_csv_data(&path)
        .map(|table| {
            table
                .rows
                .iter()
                .filter(|row| {
                    row.get("mission")
                        .and_then(Value::as_str)
                        .is_some_and(|mission| !mission.trim().is_empty())
                })
                .count()
        })
        .unwrap_or(0)
}

fn summary_from_mod_info(mod_root: &Path, info: &Value) -> GameModSummary {
    let fallback_name = mod_root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Mod")
        .to_string();
    GameModSummary {
        mod_root: mod_root.to_string_lossy().to_string(),
        id: value_string(info.get("id")).unwrap_or_else(|| fallback_name.clone()),
        name: value_string(info.get("name")).unwrap_or(fallback_name),
        version: version_string(info.get("version")).unwrap_or_default(),
        description: value_string(info.get("description")).unwrap_or_default(),
        has_mod_info: true,
    }
}

fn version_string(value: Option<&Value>) -> Option<String> {
    let Some(Value::Object(obj)) = value else {
        return value_string(value);
    };
    let major = version_part(obj.get("major"))?;
    let minor = version_part(obj.get("minor"))?;
    let patch = version_part(obj.get("patch"))?;
    Some(format!("{major}.{minor}.{patch}"))
}

fn version_part(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Number(number)) => Some(number.to_string()),
        Some(Value::String(text)) if !text.trim().is_empty() => Some(text.trim().to_string()),
        _ => None,
    }
}

fn value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => Some(text.clone()),
        Some(Value::Number(number)) => Some(number.to_string()),
        Some(Value::Bool(flag)) => Some(flag.to_string()),
        Some(other) => serde_json::to_string(other).ok(),
        None => None,
    }
}

fn append_duplicate_id_warnings(mods: &[GameModSummary], warnings: &mut Vec<GameScanWarning>) {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for summary in mods {
        *counts.entry(summary.id.as_str()).or_default() += 1;
    }
    for summary in mods {
        if counts.get(summary.id.as_str()).copied().unwrap_or_default() > 1 {
            warnings.push(GameScanWarning {
                path: summary.mod_root.clone(),
                message: format!("重复 Mod id: {}", summary.id),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn scan_game_overview_reads_mod_summaries_only() {
        let root = temp_dir("game_overview");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods/demo")).unwrap();
        fs::create_dir_all(root.join("mods/demo/data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("mods/demo/mod_info.json"),
            r#"{"id":"demo","name":"Demo Mod","version":{"major":1,"minor":2,"patch":3}}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("mods/demo/data/hulls/ship_data.csv"),
            "id,name\r\nship,Ship\r\n",
        )
        .unwrap();

        let overview = scan_game_overview(&root);

        let _ = fs::remove_dir_all(&root);
        assert!(overview.core_available);
        assert_eq!(overview.mods.len(), 1);
        assert_eq!(overview.mods[0].id, "demo");
        assert_eq!(overview.mods[0].version, "1.2.3");
        assert!(overview.warnings.is_empty());
    }

    #[test]
    fn detect_game_root_returns_overview() {
        let root = temp_dir("detect_game");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods")).unwrap();

        let detected = detect_directory(&root, None);

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, "game-root");
        assert!(detected.overview.is_some());
    }

    #[test]
    fn detect_mod_root_infers_game_root() {
        let root = temp_dir("detect_game_mod");
        let mod_root = root.join("mods/demo");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods/other")).unwrap();
        fs::create_dir_all(&mod_root).unwrap();
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"demo"}"#).unwrap();
        write_utf8_no_bom(&root.join("mods/other/mod_info.json"), r#"{"id":"other"}"#).unwrap();

        let detected = detect_directory(&mod_root, Some("D:/fallback"));

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, "mod-in-game");
        assert_eq!(
            detected.mod_root,
            Some(mod_root.to_string_lossy().to_string())
        );
        assert_eq!(
            detected.starsector_root,
            Some(root.to_string_lossy().to_string())
        );
        assert_eq!(
            detected
                .overview
                .as_ref()
                .map(|overview| overview.mods.len()),
            Some(2)
        );
    }

    #[test]
    fn detect_external_mod_uses_fallback_root() {
        let mod_root = temp_dir("detect_external_mod");
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"external"}"#).unwrap();

        let detected = detect_directory(&mod_root, Some("D:/fallback"));

        let _ = fs::remove_dir_all(mod_root);
        assert_eq!(detected.kind, "external-mod");
        assert_eq!(detected.starsector_root, Some("D:/fallback".to_string()));
        assert!(detected.overview.is_none());
    }

    #[test]
    fn scan_game_overview_warns_duplicate_ids_and_missing_core() {
        let root = temp_dir("game_warnings");
        fs::create_dir_all(root.join("mods/a")).unwrap();
        fs::create_dir_all(root.join("mods/b")).unwrap();
        fs::create_dir_all(root.join("mods/no_info")).unwrap();
        write_utf8_no_bom(&root.join("mods/a/mod_info.json"), r#"{"id":"dup"}"#).unwrap();
        write_utf8_no_bom(&root.join("mods/b/mod_info.json"), r#"{"id":"dup"}"#).unwrap();

        let overview = scan_game_overview(&root);

        let _ = fs::remove_dir_all(root);
        assert!(!overview.core_available);
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("starsector-core")));
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("缺少 mod_info.json")));
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("重复 Mod id")));
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
