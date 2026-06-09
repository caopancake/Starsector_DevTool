use super::model::is_comment_row;
use crate::{
    errors::AppResult,
    io::{read_csv_data, read_json_file},
};
use serde_json::{Map, Value};
use std::path::Path;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

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
}
