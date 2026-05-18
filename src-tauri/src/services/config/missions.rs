use crate::{
    errors::{AppError, AppResult},
    filesystem::{read_json_file, read_utf8_no_bom},
    models::{CsvTable, MissionData},
    parsers::read_csv_data,
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
    use crate::{
        filesystem::write_utf8_no_bom,
        models::{DeleteIndexedConfigEntityPayload, IndexedConfigEntityPayload},
        services::config::{
            delete_indexed_config_entity_with_history, save_indexed_config_entity_with_history,
        },
    };
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
    fn indexed_entity_can_delete_mission_directory() {
        let root = temp_dir("delete_indexed_mission_dir");
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

        let result = delete_indexed_config_entity_with_history(DeleteIndexedConfigEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            kind: "mission".to_string(),
            id: "demo".to_string(),
            delete_target: true,
        })
        .unwrap();

        assert!(!root.join("data/missions/demo").exists());
        assert_eq!(result.changes.len(), 2);
        assert!(matches!(
            result.changes[1].kind,
            crate::models::FileChangeKind::Directory
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn indexed_entity_renames_mission_directory_preserving_binary_assets() {
        let root = temp_dir("rename_mission_preserve_assets");
        fs::create_dir_all(root.join("data/missions/old/nested")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission\r\nold\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/old/descriptor.json"),
            r#"{"title":"Old","icon":"icon.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(&root.join("data/missions/old/mission_text.txt"), "old text").unwrap();
        write_utf8_no_bom(&root.join("data/missions/old/nested/readme.txt"), "keep").unwrap();
        fs::write(
            root.join("data/missions/old/icon.png"),
            [0x89, 0x50, 0x4E, 0x47],
        )
        .unwrap();

        let mut descriptor = Map::new();
        descriptor.insert("title".to_string(), Value::String("New".to_string()));
        descriptor.insert("icon".to_string(), Value::String("icon.png".to_string()));
        let result = save_indexed_config_entity_with_history(IndexedConfigEntityPayload {
            mod_root: root.to_string_lossy().to_string(),
            kind: "mission".to_string(),
            previous_id: Some("old".to_string()),
            next_id: "new".to_string(),
            index_row: {
                let mut row = Map::new();
                row.insert("mission".to_string(), Value::String("new".to_string()));
                row
            },
            payload: serde_json::json!({
                "descriptor": Value::Object(descriptor),
                "text": "new text"
            }),
            delete_previous_target: true,
        })
        .unwrap();

        let descriptor_text =
            read_utf8_no_bom(&root.join("data/missions/new/descriptor.json")).unwrap();
        let mission_text =
            read_utf8_no_bom(&root.join("data/missions/new/mission_text.txt")).unwrap();
        let nested_text =
            read_utf8_no_bom(&root.join("data/missions/new/nested/readme.txt")).unwrap();
        let icon = fs::read(root.join("data/missions/new/icon.png")).unwrap();
        let old_exists = root.join("data/missions/old").exists();

        let _ = fs::remove_dir_all(root);
        assert!(result
            .changes
            .iter()
            .any(|change| matches!(change.kind, crate::models::FileChangeKind::Directory)));
        assert!(descriptor_text.contains("\"title\": \"New\""));
        assert_eq!(mission_text, "new text");
        assert_eq!(nested_text, "keep");
        assert_eq!(icon, vec![0x89, 0x50, 0x4E, 0x47]);
        assert!(!old_exists);
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
