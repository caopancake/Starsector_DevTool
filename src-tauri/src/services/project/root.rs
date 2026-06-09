use super::model::is_comment_row;
use crate::{
    errors::AppResult,
    io::{read_csv_data, read_json_file, validate_walk_entry, FsRootBoundary},
    models::{
        GameModSummary, GameOverviewData, GameScanWarning, OpenDirectoryKind, OpenDirectoryResult,
    },
};
use serde_json::{Map, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

pub fn detect_directory(path: &Path, known_starsector_root: Option<&str>) -> OpenDirectoryResult {
    let selected = path.to_string_lossy().to_string();
    if let Ok(boundary) = FsRootBoundary::new(path, "selected root") {
        let canonical = boundary.root();
        if is_game_root(canonical) {
            let overview = scan_game_overview(canonical);
            return OpenDirectoryResult {
                kind: OpenDirectoryKind::GameRoot,
                selected_path: selected,
                starsector_root: Some(canonical.to_string_lossy().to_string()),
                mod_root: None,
                warnings: overview.warnings.clone(),
                overview: Some(overview),
            };
        }

        if is_mod_root(canonical) {
            let inferred = infer_starsector_root(canonical);
            let overview = inferred.as_deref().map(scan_game_overview);
            let known_root = known_starsector_root
                .filter(|root| !root.trim().is_empty())
                .and_then(|root| FsRootBoundary::new(Path::new(root), "starsector root").ok())
                .map(|root| root.root().to_path_buf());
            let starsector_root = inferred.or(known_root);
            return OpenDirectoryResult {
                kind: if overview.is_some() {
                    OpenDirectoryKind::ModInGame
                } else {
                    OpenDirectoryKind::ExternalMod
                },
                selected_path: selected,
                starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
                mod_root: Some(canonical.to_string_lossy().to_string()),
                overview,
                warnings: vec![],
            };
        }
    }

    OpenDirectoryResult {
        kind: OpenDirectoryKind::Unknown,
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
    } else {
        let core_dir = starsector_root.join("starsector-core");
        mods.push(GameModSummary {
            mod_root: core_dir.to_string_lossy().to_string(),
            id: "starsector-core".to_string(),
            name: "Starsector Core".to_string(),
            version: String::new(),
            description: "原版游戏核心数据".to_string(),
            has_mod_info: false,
        });
    }

    match fs::read_dir(&mods_dir) {
        Ok(entries) => {
            for entry in entries {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(error) => {
                        warnings.push(GameScanWarning {
                            path: mods_dir.to_string_lossy().to_string(),
                            message: format!("读取 mods 目录项失败: {error}"),
                        });
                        continue;
                    }
                };
                let mod_root = entry.path();
                if let Err(error) = validate_walk_entry(&mod_root, "mods directory") {
                    warnings.push(GameScanWarning {
                        path: mod_root.to_string_lossy().to_string(),
                        message: format!("Mod 路径使用链接或不可读取，已跳过: {error}"),
                    });
                    continue;
                }
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
        }
        Err(_) if !mods_dir.exists() => {
            warnings.push(GameScanWarning {
                path: mods_dir.to_string_lossy().to_string(),
                message: "缺少 mods 目录".to_string(),
            });
        }
        Err(error) => {
            warnings.push(GameScanWarning {
                path: mods_dir.to_string_lossy().to_string(),
                message: format!("无法读取 mods 目录: {error}"),
            });
        }
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

pub(super) fn read_mod_info(mod_root: &Path) -> AppResult<Value> {
    let path = mod_root.join("mod_info.json");
    if path.exists() {
        return read_json_file(&path);
    }
    Ok({
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

pub(super) fn count_mission_list_entries(mod_root: &Path) -> AppResult<usize> {
    let path = mod_root.join("data/missions/mission_list.csv");
    read_csv_data(&path).map(|table| {
        table
            .rows
            .iter()
            .filter(|row| {
                if is_comment_row(row) {
                    return false;
                }
                row.get("mission")
                    .and_then(Value::as_str)
                    .is_some_and(|mission| !mission.trim().is_empty())
            })
            .count()
    })
}

fn summary_from_mod_info(mod_root: &Path, info: &Value) -> GameModSummary {
    let folder_name = mod_root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Mod")
        .to_string();
    GameModSummary {
        mod_root: mod_root.to_string_lossy().to_string(),
        id: value_string(info.get("id")).unwrap_or_else(|| folder_name.clone()),
        name: value_string(info.get("name")).unwrap_or(folder_name),
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
        assert_eq!(overview.mods.len(), 2);
        assert_eq!(overview.mods[0].id, "demo");
        assert_eq!(overview.mods[0].version, "1.2.3");
        assert_eq!(overview.mods[1].id, "starsector-core");
        assert!(!overview.mods[1].has_mod_info);
        assert!(overview.warnings.is_empty());
    }

    #[test]
    fn detect_game_root_returns_overview() {
        let root = temp_dir("detect_game");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods")).unwrap();

        let detected = detect_directory(&root, None);

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, OpenDirectoryKind::GameRoot);
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

        let detected = detect_directory(&mod_root, Some("D:/known-root"));
        let expected_mod_root = path_string(&mod_root);
        let expected_starsector_root = path_string(&root);

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, OpenDirectoryKind::ModInGame);
        assert_eq!(detected.mod_root, Some(expected_mod_root));
        assert_eq!(detected.starsector_root, Some(expected_starsector_root));
        assert_eq!(
            detected
                .overview
                .as_ref()
                .map(|overview| overview.mods.len()),
            Some(3)
        );
    }

    #[test]
    fn detect_external_mod_uses_known_root() {
        let mod_root = temp_dir("detect_external_mod");
        let known_root = temp_dir("detect_external_known_root");
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"external"}"#).unwrap();

        let detected = detect_directory(&mod_root, Some(&known_root.to_string_lossy()));
        let expected_known_root = path_string(&known_root);

        let _ = fs::remove_dir_all(mod_root);
        let _ = fs::remove_dir_all(&known_root);
        assert_eq!(detected.kind, OpenDirectoryKind::ExternalMod);
        assert_eq!(detected.starsector_root, Some(expected_known_root));
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

    #[test]
    fn scan_game_overview_reports_unreadable_mods_path_reason() {
        let root = temp_dir("game_mods_path_error");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::write(root.join("mods"), "not a directory").unwrap();

        let overview = scan_game_overview(&root);

        let _ = fs::remove_dir_all(root);
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("无法读取 mods 目录:")));
    }

    #[test]
    fn mission_count_ignores_comment_rows() {
        let root = temp_dir("mission_count_comments");
        fs::create_dir_all(root.join("data/missions")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\n#comment,Hidden\r\ndemo,Demo\r\n",
        )
        .unwrap();

        let count = count_mission_list_entries(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(count, 1);
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

    fn path_string(path: &Path) -> String {
        let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        path.to_string_lossy().to_string()
    }
}
