use crate::{
    errors::{AppError, AppResult},
    filesystem::{read_json_file, read_utf8_no_bom, strip_internal_fields},
    models::{CsvTable, FileChangeRecord, MissionData},
    parsers::{read_csv_data, render_csv_text},
    services::file_changes::FileChangeSetBuilder,
};
use serde_json::{Map, Value};
use std::path::Path;

use super::validate_config_id;

pub fn scan_mission_list_files(mod_root: &str) -> Vec<String> {
    let rel_path = "data/missions/mission_list.csv";
    if Path::new(mod_root).join(rel_path).exists() {
        vec![rel_path.to_string()]
    } else {
        vec![]
    }
}

pub fn load_mission_list_csv(mod_root: &str, rel_path: &str) -> AppResult<CsvTable> {
    let path = mission_list_path(mod_root, rel_path)?;
    read_csv_data(&path)
}

pub fn load_mission(mod_root: &str, mission: &str) -> AppResult<MissionData> {
    let dir = mission_dir(mod_root, mission)?;
    let descriptor_path = dir.join("descriptor.json");
    let descriptor = if descriptor_path.exists() {
        read_json_file(&descriptor_path)?
    } else {
        Value::Object(Map::new())
    };
    let text_path = dir.join("mission_text.txt");
    let text = if text_path.exists() {
        read_utf8_no_bom(&text_path)?
    } else {
        String::new()
    };
    let icon_path = descriptor
        .get("icon")
        .and_then(Value::as_str)
        .map(|icon| format!("data/missions/{mission}/{icon}"));
    Ok(MissionData {
        descriptor,
        text,
        icon_path,
    })
}

pub struct MissionHistorySaveInput<'a> {
    pub mod_root: &'a str,
    pub mission: &'a str,
    pub previous_mission_id: Option<&'a str>,
    pub descriptor: &'a Value,
    pub text: &'a str,
    pub mission_list_rel_path: &'a str,
    pub header: &'a [String],
    pub rows: &'a [Map<String, Value>],
    pub delete_previous_directory: bool,
}

pub fn save_mission_with_history(
    input: MissionHistorySaveInput<'_>,
) -> AppResult<Vec<FileChangeRecord>> {
    let mission = validate_config_id(input.mission, "无效战役 ID")?;
    let previous_mission_id = input
        .previous_mission_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效战役 ID"))
        .transpose()?;
    let list_path = mission_list_path(input.mod_root, input.mission_list_rel_path)?;
    let clean = strip_internal_fields(input.descriptor);
    let mod_root = Path::new(input.mod_root);
    let mut builder = FileChangeSetBuilder::new(mod_root);
    builder
        .absolute_text_file(&list_path, Some(render_csv_text(input.header, input.rows)?))?
        .text_file(
            format!("data/missions/{mission}/descriptor.json"),
            Some(serde_json::to_string_pretty(&clean)?),
        )?
        .text_file(
            format!("data/missions/{mission}/mission_text.txt"),
            Some(input.text.to_string()),
        )?;
    if input.delete_previous_directory
        && previous_mission_id.is_some_and(|previous| previous != mission)
    {
        let previous = previous_mission_id.unwrap();
        builder.delete_directory(format!("data/missions/{previous}"))?;
    }
    builder.apply()
}

pub fn delete_mission_with_history(
    mod_root: &str,
    mission: &str,
    mission_list_rel_path: &str,
    header: &[String],
    rows: &[Map<String, Value>],
    delete_directory: bool,
) -> AppResult<Vec<FileChangeRecord>> {
    let mission = validate_config_id(mission, "无效战役 ID")?;
    let list_path = mission_list_path(mod_root, mission_list_rel_path)?;
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    builder.absolute_text_file(&list_path, Some(render_csv_text(header, rows)?))?;
    if delete_directory {
        builder.delete_directory(format!("data/missions/{mission}"))?;
    }
    builder.apply()
}

fn mission_dir(mod_root: &str, mission: &str) -> AppResult<std::path::PathBuf> {
    let clean = validate_config_id(mission, "无效战役 ID")?;
    Ok(Path::new(mod_root).join("data/missions").join(clean))
}

fn mission_list_path(mod_root: &str, rel_path: &str) -> AppResult<std::path::PathBuf> {
    let clean = rel_path.replace('\\', "/");
    if clean != "data/missions/mission_list.csv" {
        return Err(AppError::message("无效战役列表路径"));
    }
    Ok(Path::new(mod_root).join(clean))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_utf8_no_bom;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn mission_list_path_rejects_non_list_path() {
        let root = temp_dir("mission_list_path_rejects");

        let result = load_mission_list_csv(&root.to_string_lossy(), "../mission_list.csv");

        assert!(result.is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_mission_with_history_can_delete_directory() {
        let root = temp_dir("delete_mission_with_history_dir");
        fs::create_dir_all(root.join("data/missions/demo")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission\r\ndemo\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/demo/descriptor.json"),
            "{\"title\":\"Demo\"}",
        )
        .unwrap();
        write_utf8_no_bom(&root.join("data/missions/demo/mission_text.txt"), "text").unwrap();

        let changes = delete_mission_with_history(
            &root.to_string_lossy(),
            "demo",
            "data/missions/mission_list.csv",
            &["mission".to_string()],
            &[],
            true,
        )
        .unwrap();

        assert!(!root.join("data/missions/demo").exists());
        assert_eq!(changes.len(), 2);
        assert!(matches!(
            changes[1].kind,
            crate::models::FileChangeKind::Directory
        ));
        let _ = fs::remove_dir_all(root);
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
