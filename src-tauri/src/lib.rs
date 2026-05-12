use base64::{engine::general_purpose, Engine as _};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    io::Write,
    path::Path,
};
use walkdir::WalkDir;

const CSV_TABLES: [(&str, &str); 5] = [
    ("ships", "data/hulls/ship_data.csv"),
    ("weapons", "data/weapons/weapon_data.csv"),
    ("wings", "data/hulls/wing_data.csv"),
    ("hullmods", "data/hullmods/hull_mods.csv"),
    ("industries", "data/campaign/industries.csv"),
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsvTable {
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub mod_root: String,
    pub starsector_root: Option<String>,
    pub core_available: bool,
    pub mod_info: Value,
    pub faction_meta: BTreeMap<String, FactionMeta>,
    pub csv_headers: BTreeMap<String, Vec<String>>,
    pub csv_paths: BTreeMap<String, String>,
    pub ships: Vec<Map<String, Value>>,
    pub weapons: Vec<Map<String, Value>>,
    pub wings: Vec<Map<String, Value>>,
    pub hullmods: Vec<Map<String, Value>>,
    pub industries: Vec<Map<String, Value>>,
    pub ship_files: BTreeMap<String, Value>,
    pub variants: BTreeMap<String, Vec<Value>>,
    pub ship_sprites: BTreeMap<String, String>,
    pub available_sprites: Vec<String>,
    pub wpn_files: BTreeMap<String, Value>,
    pub proj_files: BTreeMap<String, Value>,
    pub weapon_sprites: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FactionMeta {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCsvPayload {
    pub mod_root: String,
    pub table: String,
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveJsonPayload {
    pub mod_root: String,
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePayload {
    pub mod_root: String,
    pub table: Option<String>,
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpritePayload {
    pub mod_root: String,
    pub filename: String,
    pub data: String,
    pub overwrite: bool,
    pub subfolder: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpriteResult {
    pub ok: bool,
    pub exists: bool,
    pub path: String,
    pub overwritten: bool,
    pub message: Option<String>,
}

#[tauri::command]
fn load_mod_data(mod_root: String) -> Result<AppData, String> {
    load_all_data(Path::new(&mod_root)).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_csv(payload: SaveCsvPayload) -> Result<String, String> {
    let rel = csv_path_for(&payload.table).ok_or_else(|| format!("unknown table: {}", payload.table))?;
    let target = Path::new(&payload.mod_root).join(rel);
    save_csv_file(&target, &payload.header, &payload.rows).map_err(|e| e.to_string())?;
    Ok(rel.to_string())
}

#[tauri::command]
fn add_csv_row(payload: SaveCsvPayload) -> Result<(), String> {
    let rel = csv_path_for(&payload.table).ok_or_else(|| format!("unknown table: {}", payload.table))?;
    let target = Path::new(&payload.mod_root).join(rel);
    let row = payload.rows.first().cloned().unwrap_or_default();
    append_csv_row(&target, &row).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_csv_row(payload: DeletePayload) -> Result<(), String> {
    let table = payload.table.ok_or_else(|| "missing table".to_string())?;
    let rel = csv_path_for(&table).ok_or_else(|| format!("unknown table: {table}"))?;
    let target = Path::new(&payload.mod_root).join(rel);
    delete_csv_id(&target, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_ship(payload: SaveJsonPayload) -> Result<String, String> {
    save_json_by_id(Path::new(&payload.mod_root), "data/hulls", "ship", "hullId", &payload.id, &payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_ship(payload: DeletePayload) -> Result<bool, String> {
    delete_json_by_id(Path::new(&payload.mod_root), "data/hulls", "ship", "hullId", &payload.id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_wpn(payload: SaveJsonPayload) -> Result<String, String> {
    save_json_by_id(Path::new(&payload.mod_root), "data/weapons", "wpn", "id", &payload.id, &payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_proj(payload: SaveJsonPayload) -> Result<String, String> {
    save_json_by_id(Path::new(&payload.mod_root), "data/weapons/proj", "proj", "id", &payload.id, &payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn upload_sprite(payload: UploadSpritePayload) -> Result<UploadSpriteResult, String> {
    let sub = match payload.subfolder.as_deref() {
        Some("weapons") => "graphics/weapons",
        Some("missiles") | Some("proj") => "graphics/missiles",
        Some("fx") => "graphics/fx",
        _ => "graphics/ships",
    };
    let safe_re = Regex::new(r"[^\w\-.]").unwrap();
    let mut safe_name = safe_re.replace_all(&payload.filename, "_").to_string();
    if !safe_name.to_ascii_lowercase().ends_with(".png") {
        safe_name.push_str(".png");
    }
    let target_dir = Path::new(&payload.mod_root).join(sub);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    let target = target_dir.join(&safe_name);
    let rel = format!("{}/{}", sub, safe_name).replace('\\', "/");
    let exists = target.exists();
    if exists && !payload.overwrite {
        return Ok(UploadSpriteResult {
            ok: false,
            exists: true,
            path: rel,
            overwritten: false,
            message: Some(format!("{safe_name} already exists. Overwrite?")),
        });
    }
    let bytes = general_purpose::STANDARD.decode(payload.data).map_err(|e| e.to_string())?;
    fs::write(target, bytes).map_err(|e| e.to_string())?;
    Ok(UploadSpriteResult {
        ok: true,
        exists,
        path: rel,
        overwritten: exists,
        message: None,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_mod_data,
            save_csv,
            add_csv_row,
            delete_csv_row,
            save_ship,
            delete_ship,
            save_wpn,
            save_proj,
            upload_sprite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn load_all_data(mod_root: &Path) -> Result<AppData, Box<dyn std::error::Error>> {
    let starsector_root = mod_root.parent().and_then(|p| p.parent()).map(Path::to_path_buf);
    let core_dir = starsector_root.as_ref().map(|p| p.join("starsector-core"));
    let core_available = core_dir.as_ref().is_some_and(|p| p.exists());
    let mod_info = read_json_file(&mod_root.join("mod_info.json")).unwrap_or_else(|_| {
        let mut obj = Map::new();
        let name = mod_root.file_name().and_then(|s| s.to_str()).unwrap_or("Mod");
        obj.insert("id".to_string(), Value::String(name.to_string()));
        obj.insert("name".to_string(), Value::String(name.to_string()));
        Value::Object(obj)
    });

    let (mut faction_meta, tag_map) = discover_factions(mod_root);
    faction_meta.entry("other".to_string()).or_insert(FactionMeta {
        name: "其他".to_string(),
        color: "#6b7280".to_string(),
    });

    let mut csv_headers = BTreeMap::new();
    let mut csv_paths = BTreeMap::new();
    let mut tables: HashMap<String, Vec<Map<String, Value>>> = HashMap::new();
    for (key, rel) in CSV_TABLES {
        let table = read_csv_data(&mod_root.join(rel))?;
        let mut rows = table.rows;
        for row in &mut rows {
            let id = str_field(row, "id");
            let tags = str_field(row, "tags");
            row.insert("_faction".to_string(), Value::String(detect_faction(&id, &tags, &tag_map)));
        }
        csv_headers.insert(key.to_string(), table.header);
        csv_paths.insert(key.to_string(), rel.to_string());
        tables.insert(key.to_string(), rows);
    }

    let ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId");
    let mut variants: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for value in load_json_dir(&mod_root.join("data/variants"), "variant") {
        if let Some(hull_id) = value.get("hullId").and_then(Value::as_str) {
            variants.entry(hull_id.to_string()).or_default().push(value);
        }
    }
    let mut ship_sprites = BTreeMap::new();
    for (id, value) in &ship_files {
        if let Some(sprite) = value.get("spriteName").and_then(Value::as_str) {
            let path = mod_root.join(sprite.replace('\\', "/"));
            if path.exists() {
                let bytes = fs::read(path)?;
                ship_sprites.insert(id.clone(), format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(bytes)));
            }
        }
    }

    Ok(AppData {
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
        core_available,
        mod_info,
        faction_meta,
        csv_headers,
        csv_paths,
        ships: tables.remove("ships").unwrap_or_default(),
        weapons: tables.remove("weapons").unwrap_or_default(),
        wings: tables.remove("wings").unwrap_or_default(),
        hullmods: tables.remove("hullmods").unwrap_or_default(),
        industries: tables.remove("industries").unwrap_or_default(),
        ship_files,
        variants,
        ship_sprites,
        available_sprites: list_sprites(mod_root, &["graphics/ships"]),
        wpn_files: load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id"),
        proj_files: load_proj_files(mod_root, core_dir.as_deref()),
        weapon_sprites: list_sprites(mod_root, &["graphics/weapons", "graphics/missiles", "graphics/fx"]),
    })
}

fn parse_ss_json(text: &str) -> Result<Value, serde_json::Error> {
    let comment_re = Regex::new(r"(?m)#[^\n]*").unwrap();
    let trailing_re = Regex::new(r",\s*([}\]])").unwrap();
    let key_re = Regex::new(r#"(?m)(^|[\{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:"#).unwrap();
    let mut cleaned = comment_re.replace_all(text, "").to_string();
    cleaned = trailing_re.replace_all(&cleaned, "$1").to_string();
    cleaned = key_re.replace_all(&cleaned, "$1\"$2\":").to_string();
    let end = first_json_object_end(&cleaned).unwrap_or(cleaned.len());
    serde_json::from_str(&cleaned[..end])
}

fn first_json_object_end(text: &str) -> Option<usize> {
    let mut depth = 0i32;
    let mut in_str = false;
    let mut escape = false;
    let mut started = false;
    for (idx, ch) in text.char_indices() {
        if in_str {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        match ch {
            '"' => in_str = true,
            '{' => {
                depth += 1;
                started = true;
            }
            '}' if started => {
                depth -= 1;
                if depth == 0 {
                    return Some(idx + ch.len_utf8());
                }
            }
            _ => {}
        }
    }
    None
}

fn read_json_file(path: &Path) -> Result<Value, Box<dyn std::error::Error>> {
    let text = fs::read_to_string(path)?;
    Ok(parse_ss_json(&text)?)
}

fn discover_factions(mod_root: &Path) -> (BTreeMap<String, FactionMeta>, HashMap<String, String>) {
    let mut factions = BTreeMap::new();
    let mut tag_map = HashMap::new();
    let dir = mod_root.join("data/world/factions");
    if !dir.exists() {
        return (factions, tag_map);
    }
    for entry in WalkDir::new(dir).max_depth(1).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some("faction") {
            continue;
        }
        if let Ok(Value::Object(obj)) = read_json_file(entry.path()) {
            let Some(fid) = obj.get("id").and_then(Value::as_str) else { continue };
            let Some(name) = obj.get("displayName").or_else(|| obj.get("displayNameLong")).and_then(Value::as_str) else { continue };
            let color = obj.get("color").and_then(Value::as_array).map(|v| rgb_to_hex(v)).unwrap_or_else(|| "#808080".to_string());
            factions.insert(fid.to_string(), FactionMeta { name: name.to_string(), color });
            for section in ["knownShips", "knownWeapons", "knownFighters"] {
                if let Some(tags) = obj.get(section)
                    .and_then(|v| v.get("tags"))
                    .and_then(Value::as_array)
                {
                    for tag in tags.iter().filter_map(Value::as_str) {
                        if tag.contains("_bp") && !matches!(tag, "base_bp" | "lowtech_bp" | "midline_bp" | "hightech_bp" | "missile_bp" | "pirate_bp" | "pirates") {
                            tag_map.insert(tag.to_string(), fid.to_string());
                        }
                    }
                }
            }
        }
    }
    (factions, tag_map)
}

fn rgb_to_hex(values: &[Value]) -> String {
    let r = values.first().and_then(Value::as_i64).unwrap_or(128).clamp(0, 255);
    let g = values.get(1).and_then(Value::as_i64).unwrap_or(128).clamp(0, 255);
    let b = values.get(2).and_then(Value::as_i64).unwrap_or(128).clamp(0, 255);
    format!("#{r:02x}{g:02x}{b:02x}")
}

fn detect_faction(id: &str, tags: &str, tag_map: &HashMap<String, String>) -> String {
    for (tag, faction) in tag_map {
        if tags.contains(tag) {
            return faction.clone();
        }
    }
    if id.contains('_') {
        let prefix = id.split('_').next().unwrap_or_default().to_ascii_lowercase();
        if !prefix.is_empty() {
            return "other".to_string();
        }
    }
    "other".to_string()
}

fn read_csv_data(path: &Path) -> Result<CsvTable, Box<dyn std::error::Error>> {
    if !path.exists() {
        return Ok(CsvTable { header: vec![], rows: vec![], path: path.to_string_lossy().to_string() });
    }
    let mut rdr = csv::ReaderBuilder::new().has_headers(false).from_path(path)?;
    let records: Vec<csv::StringRecord> = rdr.records().collect::<Result<_, _>>()?;
    if records.is_empty() {
        return Ok(CsvTable { header: vec![], rows: vec![], path: path.to_string_lossy().to_string() });
    }
    let header: Vec<String> = records[0].iter().map(ToString::to_string).collect();
    let mut rows = Vec::new();
    for record in records.iter().skip(1) {
        if record.get(0).is_some_and(|v| v.starts_with('#')) {
            continue;
        }
        let mut row = Map::new();
        for (idx, h) in header.iter().enumerate() {
            row.insert(h.clone(), Value::String(record.get(idx).unwrap_or("").to_string()));
        }
        rows.push(row);
    }
    Ok(CsvTable { header, rows, path: path.to_string_lossy().to_string() })
}

fn save_csv_file(path: &Path, header: &[String], rows: &[Map<String, Value>]) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut comments = Vec::new();
    if path.exists() {
        let mut rdr = csv::ReaderBuilder::new().has_headers(false).from_path(path)?;
        for record in rdr.records().skip(1) {
            let record = record?;
            if record.get(0).is_some_and(|v| v.starts_with('#')) {
                comments.push(record);
            }
        }
    }
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(header)?;
    for comment in comments {
        wtr.write_record(&comment)?;
    }
    for row in rows {
        let values: Vec<String> = header.iter().map(|h| value_to_cell(row.get(h).unwrap_or(&Value::Null))).collect();
        wtr.write_record(values)?;
    }
    wtr.flush()?;
    Ok(())
}

fn append_csv_row(path: &Path, row: &Map<String, Value>) -> Result<(), Box<dyn std::error::Error>> {
    let table = read_csv_data(path)?;
    let mut file = fs::OpenOptions::new().append(true).create(true).open(path)?;
    let mut wtr = csv::WriterBuilder::new().has_headers(false).from_writer(vec![]);
    let values: Vec<String> = table.header.iter().map(|h| value_to_cell(row.get(h).unwrap_or(&Value::Null))).collect();
    wtr.write_record(values)?;
    let bytes = wtr.into_inner()?;
    file.write_all(&bytes)?;
    Ok(())
}

fn delete_csv_id(path: &Path, id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut rdr = csv::ReaderBuilder::new().has_headers(false).from_path(path)?;
    let records: Vec<csv::StringRecord> = rdr.records().collect::<Result<_, _>>()?;
    if records.is_empty() {
        return Ok(());
    }
    let header = records[0].clone();
    let Some(id_idx) = header.iter().position(|h| h == "id") else {
        return Err("no id column".into());
    };
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(&header)?;
    for record in records.iter().skip(1) {
        if record.get(id_idx) == Some(id) {
            continue;
        }
        wtr.write_record(record)?;
    }
    wtr.flush()?;
    Ok(())
}

fn load_json_dir_by_id(dir: &Path, ext: &str, id_key: &str) -> BTreeMap<String, Value> {
    let mut result = BTreeMap::new();
    for value in load_json_dir(dir, ext) {
        if let Some(id) = value.get(id_key).and_then(Value::as_str) {
            result.insert(id.to_string(), value);
        }
    }
    result
}

fn load_json_dir(dir: &Path, ext: &str) -> Vec<Value> {
    if !dir.exists() {
        return vec![];
    }
    WalkDir::new(dir)
        .max_depth(1)
        .into_iter()
        .flatten()
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some(ext))
        .filter_map(|e| read_json_file(e.path()).ok())
        .collect()
}

fn load_proj_files(mod_root: &Path, core_dir: Option<&Path>) -> BTreeMap<String, Value> {
    let mut result = BTreeMap::new();
    for mut value in load_json_dir(&mod_root.join("data/weapons/proj"), "proj") {
        if let Some(id) = value.get("id").and_then(Value::as_str).map(ToString::to_string) {
            if let Value::Object(obj) = &mut value {
                obj.insert("_source".to_string(), Value::String("mod".to_string()));
            }
            result.insert(id, value);
        }
    }
    if let Some(core) = core_dir {
        for mut value in load_json_dir(&core.join("data/weapons/proj"), "proj") {
            if let Some(id) = value.get("id").and_then(Value::as_str).map(ToString::to_string) {
                if result.contains_key(&id) {
                    continue;
                }
                if let Value::Object(obj) = &mut value {
                    obj.insert("_source".to_string(), Value::String("core".to_string()));
                }
                result.insert(id, value);
            }
        }
    }
    result
}

fn list_sprites(mod_root: &Path, dirs: &[&str]) -> Vec<String> {
    let mut sprites = Vec::new();
    for dir in dirs {
        let base = mod_root.join(dir);
        if !base.exists() {
            continue;
        }
        for entry in WalkDir::new(base).into_iter().flatten() {
            if entry.path().extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("png")) {
                if let Ok(rel) = entry.path().strip_prefix(mod_root) {
                    sprites.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    sprites.sort();
    sprites
}

fn save_json_by_id(
    mod_root: &Path,
    rel_dir: &str,
    ext: &str,
    id_key: &str,
    id: &str,
    data: &Value,
) -> Result<String, Box<dyn std::error::Error>> {
    let dir = mod_root.join(rel_dir);
    fs::create_dir_all(&dir)?;
    let mut target = None;
    if dir.exists() {
        for entry in WalkDir::new(&dir).max_depth(1).into_iter().flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
                continue;
            }
            if let Ok(value) = read_json_file(entry.path()) {
                if value.get(id_key).and_then(Value::as_str) == Some(id) {
                    target = Some(entry.path().to_path_buf());
                    break;
                }
            }
        }
    }
    let target = target.unwrap_or_else(|| dir.join(format!("{id}.{ext}")));
    let clean = strip_internal_fields(data);
    fs::write(&target, serde_json::to_string_pretty(&clean)?)?;
    Ok(target.strip_prefix(mod_root).unwrap_or(&target).to_string_lossy().replace('\\', "/"))
}

fn delete_json_by_id(mod_root: &Path, rel_dir: &str, ext: &str, id_key: &str, id: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let dir = mod_root.join(rel_dir);
    if !dir.exists() {
        return Ok(false);
    }
    for entry in WalkDir::new(dir).max_depth(1).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
            continue;
        }
        if let Ok(value) = read_json_file(entry.path()) {
            if value.get(id_key).and_then(Value::as_str) == Some(id) {
                fs::remove_file(entry.path())?;
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn strip_internal_fields(value: &Value) -> Value {
    match value {
        Value::Object(obj) => {
            let mut clean = Map::new();
            for (key, val) in obj {
                if !key.starts_with('_') {
                    clean.insert(key.clone(), strip_internal_fields(val));
                }
            }
            Value::Object(clean)
        }
        Value::Array(items) => Value::Array(items.iter().map(strip_internal_fields).collect()),
        other => other.clone(),
    }
}

fn csv_path_for(table: &str) -> Option<&'static str> {
    CSV_TABLES.iter().find_map(|(key, path)| (*key == table).then_some(*path))
}

fn str_field(row: &Map<String, Value>, key: &str) -> String {
    row.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn value_to_cell(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_starsector_loose_json() {
        let text = r#"
        # comment
        {
          id: "abc",
          color: [1,2,3,],
        }
        trailing
        "#;
        let parsed = parse_ss_json(text).unwrap();
        assert_eq!(parsed["id"], "abc");
        assert_eq!(parsed["color"][2], 3);
    }

    #[test]
    fn strips_internal_fields_recursively() {
        let value = serde_json::json!({"id":"x","_source":"mod","nested":{"_temp":1,"ok":2}});
        let clean = strip_internal_fields(&value);
        assert!(clean.get("_source").is_none());
        assert_eq!(clean["nested"]["ok"], 2);
        assert!(clean["nested"].get("_temp").is_none());
    }

    #[test]
    fn csv_save_preserves_comments() {
        let path = temp_path("csv_save_preserves_comments.csv");
        fs::write(&path, "id,name\r\n#note,keep\r\na,A\r\n").unwrap();
        let header = vec!["id".to_string(), "name".to_string()];
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("b".to_string()));
        row.insert("name".to_string(), Value::String("B".to_string()));
        save_csv_file(&path, &header, &[row]).unwrap();
        let out = fs::read_to_string(&path).unwrap();
        assert!(out.contains("#note,keep"));
        assert!(out.contains("b,B"));
        let _ = fs::remove_file(path);
    }

    fn temp_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("{stamp}_{name}"))
    }
}
