use super::factions;
use crate::{
    errors::AppResult,
    models::{csv_path_for, CsvTable, CSV_TABLES},
    parsers::read_csv_data,
};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};

pub(super) struct LoadedTables {
    pub csv_headers: BTreeMap<String, Vec<String>>,
    pub csv_paths: BTreeMap<String, String>,
    pub rows: HashMap<String, Vec<Map<String, Value>>>,
}

pub(super) fn load_csv_tables(
    mod_root: &Path,
    tag_map: &HashMap<String, String>,
) -> AppResult<LoadedTables> {
    let mut csv_headers = BTreeMap::new();
    let mut csv_paths = BTreeMap::new();
    let mut rows_by_key = HashMap::new();
    for (key, rel) in CSV_TABLES {
        let table = read_csv_data(&mod_root.join(rel))?;
        let mut rows = table.rows;
        for row in &mut rows {
            let id = str_field(row, "id");
            let tags = str_field(row, "tags");
            row.insert(
                "_faction".to_string(),
                Value::String(factions::detect_faction(&id, &tags, tag_map)),
            );
        }
        csv_headers.insert(key.to_string(), table.header);
        csv_paths.insert(key.to_string(), rel.to_string());
        rows_by_key.insert(key.to_string(), rows);
    }
    Ok(LoadedTables {
        csv_headers,
        csv_paths,
        rows: rows_by_key,
    })
}

pub fn load_csv_table(mod_root: &Path, table: &str) -> AppResult<CsvTable> {
    let rel_path = csv_path_for(table)
        .ok_or_else(|| crate::errors::AppError::message(format!("未知 CSV 表: {table}")))?;
    let mut csv = read_csv_data(&mod_root.join(rel_path))?;
    csv.path = rel_path.to_string();
    Ok(csv)
}

fn str_field(row: &Map<String, Value>, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
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
    fn loads_all_known_csv_tables() {
        let root = temp_dir("load_csv_tables");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name,tags\r\nship,Ship,demo_bp\r\n",
        )
        .unwrap();
        fs::create_dir_all(root.join("data/shipsystems")).unwrap();
        write_utf8_no_bom(
            &root.join("data/shipsystems/ship_systems.csv"),
            "name,id,icon\r\nBurn Drive,burndrive,graphics/icons/hullsys/burn_drive.png\r\n",
        )
        .unwrap();
        let mut tag_map = HashMap::new();
        tag_map.insert("demo_bp".to_string(), "demo".to_string());

        let loaded = load_csv_tables(&root, &tag_map).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["ships"], ["id", "name", "tags"]);
        assert_eq!(loaded.rows["ships"][0]["_faction"], "demo");
        assert!(loaded.rows.contains_key("weapons"));
        assert_eq!(loaded.rows["shipSystems"][0]["id"], "burndrive");
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
