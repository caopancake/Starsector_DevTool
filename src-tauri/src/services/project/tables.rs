use super::{factions, performance::PerformanceTrace};
use crate::{
    errors::AppResult,
    io::{read_csv_data, read_text_bytes_no_bom},
    models::{csv_path_for, CsvTable, CSV_TABLES},
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

#[cfg(test)]
fn load_csv_tables(
    mod_root: &Path,
    core_dir: Option<&Path>,
    tag_map: &HashMap<String, String>,
) -> AppResult<LoadedTables> {
    load_csv_tables_with_trace(mod_root, core_dir, tag_map, None)
}

pub(super) fn load_csv_tables_with_trace(
    mod_root: &Path,
    core_dir: Option<&Path>,
    tag_map: &HashMap<String, String>,
    mut trace: Option<&mut PerformanceTrace>,
) -> AppResult<LoadedTables> {
    let mut csv_headers = BTreeMap::new();
    let mut csv_paths = BTreeMap::new();
    let mut rows_by_key = HashMap::new();
    for (key, rel) in CSV_TABLES {
        let table = read_csv_data_for_load(mod_root, key, rel, trace.as_deref_mut())?;
        let mut rows = table.rows;
        let timer = trace.as_ref().map(|trace| trace.timer());
        for row in &mut rows {
            let id = str_field(row, "id");
            let tags = str_field(row, "tags");
            row.insert(
                "_faction".to_string(),
                Value::String(factions::detect_faction(&id, &tags, tag_map)),
            );
        }
        if let (Some(trace), Some(timer)) = (trace.as_deref_mut(), timer) {
            trace.record_stage(
                "csv.table.decorate_rows",
                timer,
                [
                    ("table", key.to_string()),
                    ("rows", rows.len().to_string()),
                    ("path", rel.to_string()),
                ],
            );
        }
        // When the local CSV does not exist (empty header), fall back to
        // starsector-core headers so the frontend can still create rows.
        let header = if table.header.is_empty() {
            if let Some(core) = core_dir {
                let core_table = read_csv_data_for_load(core, key, rel, trace.as_deref_mut())?;
                core_table.header
            } else {
                vec![]
            }
        } else {
            table.header
        };
        csv_headers.insert(key.to_string(), header);
        csv_paths.insert(key.to_string(), rel.to_string());
        rows_by_key.insert(key.to_string(), rows);
    }
    Ok(LoadedTables {
        csv_headers,
        csv_paths,
        rows: rows_by_key,
    })
}

fn read_csv_data_for_load(
    root: &Path,
    table_key: &str,
    rel_path: &str,
    trace: Option<&mut PerformanceTrace>,
) -> AppResult<CsvTable> {
    match trace {
        Some(trace) => read_csv_data_for_load_with_trace(root, table_key, rel_path, trace),
        None => read_csv_data(&root.join(rel_path)),
    }
}

fn read_csv_data_for_load_with_trace(
    root: &Path,
    table_key: &str,
    rel_path: &str,
    trace: &mut PerformanceTrace,
) -> AppResult<CsvTable> {
    let path = root.join(rel_path);
    let path_label = path.to_string_lossy().to_string();
    let source = if root.ends_with("starsector-core") {
        "core"
    } else {
        "mod"
    };
    if !path.exists() {
        trace.record_stage(
            "csv.table.missing",
            trace.timer(),
            [
                ("table", table_key.to_string()),
                ("source", source.to_string()),
                ("path", rel_path.to_string()),
            ],
        );
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path_label,
        });
    }

    let timer = trace.timer();
    let bytes = read_text_bytes_no_bom(&path)?;
    trace.record_stage(
        "csv.table.read_bytes",
        timer,
        [
            ("table", table_key.to_string()),
            ("source", source.to_string()),
            ("path", rel_path.to_string()),
            ("bytes", bytes.len().to_string()),
        ],
    );

    let timer = trace.timer();
    let mut metrics = Vec::new();
    let table = crate::parsers::parse_csv_bytes_with_metrics(&path_label, &bytes, |stage, ms| {
        metrics.push((stage.to_string(), ms));
    })?;
    let total_parse_ms = timer.elapsed_ms();
    for (stage, ms) in metrics {
        trace.record_stage_with_ms(
            format!("csv.table.{stage}"),
            ms,
            [
                ("table", table_key.to_string()),
                ("source", source.to_string()),
                ("path", rel_path.to_string()),
            ],
        );
    }
    trace.record_stage_with_ms(
        "csv.table.parse_total",
        total_parse_ms,
        [
            ("table", table_key.to_string()),
            ("source", source.to_string()),
            ("path", rel_path.to_string()),
            ("rows", table.rows.len().to_string()),
            ("columns", table.header.len().to_string()),
        ],
    );
    Ok(table)
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

        let loaded = load_csv_tables(&root, None, &tag_map).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["ships"], ["id", "name", "tags"]);
        assert_eq!(loaded.rows["ships"][0]["_faction"], "demo");
        assert!(loaded.rows.contains_key("weapons"));
        assert!(loaded.rows.contains_key("abilities"));
        assert!(loaded.rows["abilities"].is_empty());
        assert!(loaded.rows.contains_key("commodities"));
        assert!(loaded.rows["commodities"].is_empty());
        assert!(loaded.rows.contains_key("specialItems"));
        assert!(loaded.rows["specialItems"].is_empty());
        assert!(loaded.rows.contains_key("submarkets"));
        assert!(loaded.rows["submarkets"].is_empty());
        assert!(loaded.rows.contains_key("marketConditions"));
        assert!(loaded.rows["marketConditions"].is_empty());
        assert!(loaded.rows.contains_key("simOpponents"));
        assert!(loaded.rows["simOpponents"].is_empty());
        assert!(loaded.rows.contains_key("descriptions"));
        assert!(loaded.rows["descriptions"].is_empty());
        assert_eq!(loaded.rows["shipSystems"][0]["id"], "burndrive");
    }

    #[test]
    fn loads_abilities_csv_when_present() {
        let root = temp_dir("load_abilities_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/abilities.csv"),
            "name,id,icon\r\nEmergency Burn,emergency_burn,graphics/icons/abilities/emergency_burn.png\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["abilities"], ["name", "id", "icon"]);
        assert_eq!(loaded.rows["abilities"][0]["id"], "emergency_burn");
    }

    #[test]
    fn loads_commodities_csv_when_present() {
        let root = temp_dir("load_commodities_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/commodities.csv"),
            "name,id,icon\r\nSupplies,supplies,graphics/icons/cargo/supplies.png\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["commodities"], ["name", "id", "icon"]);
        assert_eq!(loaded.rows["commodities"][0]["id"], "supplies");
    }

    #[test]
    fn loads_special_items_csv_when_present() {
        let root = temp_dir("load_special_items_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/special_items.csv"),
            "name,id,icon\r\nCorrupted Nanoforge,corrupted_nanoforge,graphics/icons/cargo/nanoforge_corrupted.png\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["specialItems"], ["name", "id", "icon"]);
        assert_eq!(loaded.rows["specialItems"][0]["id"], "corrupted_nanoforge");
    }

    #[test]
    fn loads_submarkets_csv_when_present() {
        let root = temp_dir("load_submarkets_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/submarkets.csv"),
            "id,name,icon\r\nopen_market,Open Market,graphics/icons/submarkets/open_market.png\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["submarkets"], ["id", "name", "icon"]);
        assert_eq!(loaded.rows["submarkets"][0]["id"], "open_market");
    }

    #[test]
    fn loads_market_conditions_csv_when_present() {
        let root = temp_dir("load_market_conditions_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/market_conditions.csv"),
            "name,id,icon\r\nUrbanized Polity,urbanized_polity,graphics/icons/markets/urbanized_polity.png\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(
            loaded.csv_headers["marketConditions"],
            ["name", "id", "icon"]
        );
        assert_eq!(loaded.rows["marketConditions"][0]["id"], "urbanized_polity");
    }

    #[test]
    fn loads_sim_opponents_csv_when_present() {
        let root = temp_dir("load_sim_opponents_csv");
        fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/sim_opponents.csv"),
            "variant id\r\nparagon_Elite\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.csv_headers["simOpponents"], ["variant id"]);
        assert_eq!(
            loaded.rows["simOpponents"][0]["variant id"],
            "paragon_Elite"
        );
    }

    #[test]
    fn loads_descriptions_csv_when_present() {
        let root = temp_dir("load_descriptions_csv");
        fs::create_dir_all(root.join("data/strings")).unwrap();
        write_utf8_no_bom(
            &root.join("data/strings/descriptions.csv"),
            "id,type,text1,notes\r\ndemo_desc,CUSTOM,Demo text,Demo note\r\n",
        )
        .unwrap();

        let loaded = load_csv_tables(&root, None, &HashMap::new()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(
            loaded.csv_headers["descriptions"],
            ["id", "type", "text1", "notes"]
        );
        assert_eq!(loaded.rows["descriptions"][0]["id"], "demo_desc");
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
