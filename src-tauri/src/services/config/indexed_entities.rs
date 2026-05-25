use crate::{
    domain::config::validate_config_id,
    errors::{AppError, AppResult},
    io::{read_csv_data, strip_internal_fields, FileChangeSetBuilder},
    models::{IndexedConfigKind, WriteResult},
    parsers::render_csv_text,
};
use serde_json::{Map, Value};
use std::path::Path;

type IndexRows = Vec<Map<String, Value>>;
type IndexTable = (Vec<String>, IndexRows);

pub fn save_indexed_config_entity(
    mod_root: &str,
    kind: IndexedConfigKind,
    previous_id: Option<&str>,
    next_id: &str,
    index_row: Map<String, Value>,
    entity_data: Value,
    delete_previous_target: bool,
) -> AppResult<WriteResult<Value>> {
    let next_id = validate_config_id(next_id, kind.invalid_id_message())?.to_string();
    let previous_id = previous_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, kind.invalid_id_message()).map(str::to_string))
        .transpose()?;
    let adapter = EntityAdapter::new(kind);
    let mod_root = Path::new(mod_root);
    let index_path = mod_root.join(adapter.index_rel_path());
    let (mut header, mut rows) = read_index_table(&index_path, adapter.default_header())?;
    let existing_next = rows
        .iter()
        .position(|row| adapter.row_matches(row, &header, &next_id));
    if existing_next.is_some() && previous_id.as_deref() != Some(next_id.as_str()) {
        return Err(AppError::message(format!(
            "{} 已存在: {next_id}",
            adapter.display_name()
        )));
    }
    if previous_id.as_deref() != Some(next_id.as_str()) && adapter.target_exists(mod_root, &next_id)
    {
        return Err(AppError::message(format!(
            "{}目标已存在: {}",
            adapter.display_name(),
            adapter.target_rel_path(&next_id)
        )));
    }
    if let Some(previous_id) = previous_id.as_deref() {
        require_index_row(&rows, &header, adapter, previous_id)?;
    }

    remove_index_row(&mut rows, &header, adapter, previous_id.as_deref());
    let index_row = adapter.normalize_index_row(index_row, &next_id);
    upsert_index_row(&mut header, &mut rows, adapter, index_row, &next_id);

    let mut builder = FileChangeSetBuilder::new(mod_root);
    if kind == IndexedConfigKind::Mission
        && delete_previous_target
        && previous_id
            .as_deref()
            .is_some_and(|previous| previous != next_id)
    {
        let previous = previous_id.as_deref().unwrap();
        builder.copy_directory(
            adapter.target_rel_path(previous),
            adapter.target_rel_path(&next_id),
        )?;
    }
    builder.absolute_text_file(&index_path, Some(render_csv_text(&header, &rows)?))?;
    adapter.add_save_changes(&mut builder, &next_id, &entity_data)?;
    if delete_previous_target
        && previous_id
            .as_deref()
            .is_some_and(|previous| previous != next_id)
    {
        adapter.add_delete_target_change(&mut builder, previous_id.as_deref().unwrap())?;
    }
    let changes = builder.apply()?;
    Ok(WriteResult {
        invalidated_paths: changes.iter().map(|change| change.path.clone()).collect(),
        changes,
        key_map: Vec::new(),
        refreshed_entity: Some(serde_json::json!({
            "entityId": next_id,
            "indexPath": adapter.index_rel_path(),
            "indexHeader": header,
            "indexRows": rows,
            "entityData": entity_data,
        })),
        warnings: Vec::new(),
    })
}

pub fn create_indexed_config_entity(
    mod_root: &str,
    kind: IndexedConfigKind,
    next_id: &str,
    index_row: Map<String, Value>,
    entity_data: Value,
) -> AppResult<WriteResult<Value>> {
    save_indexed_config_entity(mod_root, kind, None, next_id, index_row, entity_data, false)
}

pub fn delete_indexed_config_entity(
    mod_root: &str,
    kind: IndexedConfigKind,
    id: &str,
    delete_target: bool,
) -> AppResult<WriteResult<Value>> {
    let id = validate_config_id(id, kind.invalid_id_message())?.to_string();
    let adapter = EntityAdapter::new(kind);
    let mod_root = Path::new(mod_root);
    let index_path = mod_root.join(adapter.index_rel_path());
    let (header, mut rows) = read_index_table(&index_path, adapter.default_header())?;
    if !remove_index_row(&mut rows, &header, adapter, Some(&id)) {
        return Err(AppError::message(format!(
            "{}索引不存在: {id}",
            adapter.display_name()
        )));
    }

    let mut builder = FileChangeSetBuilder::new(mod_root);
    builder.absolute_text_file(&index_path, Some(render_csv_text(&header, &rows)?))?;
    if delete_target {
        adapter.add_delete_target_change(&mut builder, &id)?;
    }
    let changes = builder.apply()?;
    Ok(WriteResult {
        invalidated_paths: changes.iter().map(|change| change.path.clone()).collect(),
        changes,
        key_map: Vec::new(),
        refreshed_entity: Some(serde_json::json!({
            "entityId": id,
            "indexPath": adapter.index_rel_path(),
            "indexHeader": header,
            "indexRows": rows,
            "entityData": Value::Null,
        })),
        warnings: Vec::new(),
    })
}

impl IndexedConfigKind {
    fn invalid_id_message(self) -> &'static str {
        match self {
            Self::Faction => "无效势力 ID",
            Self::Mission => "无效战役 ID",
        }
    }
}

struct EntityAdapter {
    kind: IndexedConfigKind,
}

impl EntityAdapter {
    fn new(kind: IndexedConfigKind) -> &'static Self {
        match kind {
            IndexedConfigKind::Faction => &FACTION_ADAPTER,
            IndexedConfigKind::Mission => &MISSION_ADAPTER,
        }
    }

    fn display_name(&self) -> &'static str {
        match self.kind {
            IndexedConfigKind::Faction => "势力",
            IndexedConfigKind::Mission => "战役",
        }
    }

    fn index_rel_path(&self) -> &'static str {
        match self.kind {
            IndexedConfigKind::Faction => "data/world/factions/factions.csv",
            IndexedConfigKind::Mission => "data/missions/mission_list.csv",
        }
    }

    fn default_header(&self) -> Vec<String> {
        match self.kind {
            IndexedConfigKind::Faction => vec!["id".to_string(), "file".to_string()],
            IndexedConfigKind::Mission => vec!["mission".to_string()],
        }
    }

    fn target_rel_path(&self, id: &str) -> String {
        match self.kind {
            IndexedConfigKind::Faction => format!("data/world/factions/{id}.faction"),
            IndexedConfigKind::Mission => format!("data/missions/{id}"),
        }
    }

    fn target_exists(&self, mod_root: &Path, id: &str) -> bool {
        mod_root.join(self.target_rel_path(id)).exists()
    }

    fn row_matches(&self, row: &Map<String, Value>, header: &[String], id: &str) -> bool {
        let key = self.id_column(header);
        let Some(value) = row.get(&key).and_then(Value::as_str).map(str::trim) else {
            return false;
        };
        match self.kind {
            IndexedConfigKind::Faction => value == id || file_stem(value) == id,
            IndexedConfigKind::Mission => value == id,
        }
    }

    fn normalize_index_row(&self, mut row: Map<String, Value>, id: &str) -> Map<String, Value> {
        match self.kind {
            IndexedConfigKind::Faction => {
                row.insert("id".to_string(), Value::String(id.to_string()));
                row.entry("file".to_string())
                    .or_insert_with(|| Value::String(format!("data/world/factions/{id}.faction")));
            }
            IndexedConfigKind::Mission => {
                row.insert("mission".to_string(), Value::String(id.to_string()));
            }
        }
        row
    }

    fn id_column(&self, header: &[String]) -> String {
        match self.kind {
            IndexedConfigKind::Faction => find_header_col(header, &["id", "faction", "factionId"])
                .unwrap_or_else(|| header.first().cloned().unwrap_or_else(|| "id".to_string())),
            IndexedConfigKind::Mission => find_header_col(header, &["mission", "id"])
                .unwrap_or_else(|| {
                    header
                        .first()
                        .cloned()
                        .unwrap_or_else(|| "mission".to_string())
                }),
        }
    }

    fn add_save_changes(
        &self,
        builder: &mut FileChangeSetBuilder,
        id: &str,
        entity_data: &Value,
    ) -> AppResult<()> {
        match self.kind {
            IndexedConfigKind::Faction => {
                let file = entity_data
                    .get("file")
                    .ok_or_else(|| AppError::message("missing faction file data"))?;
                let clean = strip_internal_fields(file);
                builder.text_file(
                    self.target_rel_path(id),
                    Some(serde_json::to_string_pretty(&clean)?),
                )?;
            }
            IndexedConfigKind::Mission => {
                let descriptor = entity_data
                    .get("descriptor")
                    .ok_or_else(|| AppError::message("missing mission descriptor data"))?;
                let text = entity_data
                    .get("text")
                    .and_then(Value::as_str)
                    .ok_or_else(|| AppError::message("missing mission text data"))?;
                let clean = strip_internal_fields(descriptor);
                builder
                    .text_file(
                        format!("{}/descriptor.json", self.target_rel_path(id)),
                        Some(serde_json::to_string_pretty(&clean)?),
                    )?
                    .text_file(
                        format!("{}/mission_text.txt", self.target_rel_path(id)),
                        Some(text.to_string()),
                    )?;
            }
        }
        Ok(())
    }

    fn add_delete_target_change(
        &self,
        builder: &mut FileChangeSetBuilder,
        id: &str,
    ) -> AppResult<()> {
        match self.kind {
            IndexedConfigKind::Faction => {
                builder.text_file(self.target_rel_path(id), None)?;
            }
            IndexedConfigKind::Mission => {
                builder.delete_directory(self.target_rel_path(id))?;
            }
        }
        Ok(())
    }
}

static FACTION_ADAPTER: EntityAdapter = EntityAdapter {
    kind: IndexedConfigKind::Faction,
};
static MISSION_ADAPTER: EntityAdapter = EntityAdapter {
    kind: IndexedConfigKind::Mission,
};

fn read_index_table(path: &Path, default_header: Vec<String>) -> AppResult<IndexTable> {
    let table = read_csv_data(path)?;
    if table.header.is_empty() {
        Ok((default_header, table.rows))
    } else {
        Ok((table.header, table.rows))
    }
}

fn upsert_index_row(
    header: &mut Vec<String>,
    rows: &mut Vec<Map<String, Value>>,
    adapter: &EntityAdapter,
    row: Map<String, Value>,
    id: &str,
) {
    for key in row.keys() {
        if !header.contains(key) {
            header.push(key.clone());
        }
    }
    if let Some(index) = rows
        .iter()
        .position(|existing| adapter.row_matches(existing, header, id))
    {
        rows[index] = row;
    } else {
        rows.push(row);
    }
}

fn remove_index_row(
    rows: &mut Vec<Map<String, Value>>,
    header: &[String],
    adapter: &EntityAdapter,
    id: Option<&str>,
) -> bool {
    let Some(id) = id else {
        return false;
    };
    let before = rows.len();
    rows.retain(|row| !adapter.row_matches(row, header, id));
    before != rows.len()
}

fn require_index_row(
    rows: &[Map<String, Value>],
    header: &[String],
    adapter: &EntityAdapter,
    id: &str,
) -> AppResult<()> {
    if rows.iter().any(|row| adapter.row_matches(row, header, id)) {
        return Ok(());
    }
    Err(AppError::message(format!(
        "{}索引不存在: {id}",
        adapter.display_name()
    )))
}

fn find_header_col(header: &[String], candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header
            .iter()
            .find(|col| col.eq_ignore_ascii_case(candidate))
            .cloned()
    })
}

fn file_stem(value: &str) -> String {
    Path::new(value)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(value)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{read_utf8_no_bom, write_utf8_no_bom},
        models::FileChangeReplayDirection,
        services::file_changes::apply_file_change_set,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn faction_save_can_rename_file_and_index_with_undo_redo() {
        let root = temp_dir("indexed_faction_rename");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\nold,data/world/factions/old.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("old.faction"), r#"{"id":"old"}"#).unwrap();

        let result = save_indexed_config_entity(
            &root.to_string_lossy(),
            IndexedConfigKind::Faction,
            Some("old"),
            "new",
            {
                let mut row = Map::new();
                row.insert("id".to_string(), Value::String("new".to_string()));
                row.insert(
                    "file".to_string(),
                    Value::String("data/world/factions/new.faction".to_string()),
                );
                row
            },
            serde_json::json!({"file": {"id": "new", "displayName": "New"}}),
            true,
        )
        .unwrap();

        assert!(!dir.join("old.faction").exists());
        assert!(dir.join("new.faction").exists());
        assert!(read_utf8_no_bom(&dir.join("factions.csv"))
            .unwrap()
            .contains("new,data/world/factions/new.faction"));

        apply_file_change_set(FileChangeReplayDirection::Undo, result.changes.clone()).unwrap();
        assert!(dir.join("old.faction").exists());
        assert!(!dir.join("new.faction").exists());

        apply_file_change_set(FileChangeReplayDirection::Redo, result.changes).unwrap();
        let new_text = read_utf8_no_bom(&dir.join("new.faction")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert!(new_text.contains("\"id\": \"new\""));
    }

    #[test]
    fn indexed_entity_rejects_duplicate_id() {
        let root = temp_dir("indexed_duplicate_id");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\nnew,data/world/factions/new.faction\r\n",
        )
        .unwrap();

        let result = save_indexed_config_entity(
            &root.to_string_lossy(),
            IndexedConfigKind::Faction,
            Some("old"),
            "new",
            {
                let mut row = Map::new();
                row.insert("id".to_string(), Value::String("new".to_string()));
                row
            },
            serde_json::json!({"file": {"id": "new"}}),
            false,
        );

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
    }

    #[test]
    fn indexed_entity_save_requires_previous_index_row() {
        let root = temp_dir("indexed_missing_previous");
        fs::create_dir_all(root.join("data/world/factions")).unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/factions.csv"),
            "id,file\r\n",
        )
        .unwrap();

        let error = save_indexed_config_entity(
            &root.to_string_lossy(),
            IndexedConfigKind::Faction,
            Some("missing"),
            "next",
            {
                let mut row = Map::new();
                row.insert("id".to_string(), Value::String("next".to_string()));
                row
            },
            serde_json::json!({"file": {"id": "next"}}),
            false,
        )
        .unwrap_err()
        .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("势力索引不存在: missing"));
    }

    #[test]
    fn indexed_entity_delete_requires_index_row() {
        let root = temp_dir("indexed_delete_missing");
        fs::create_dir_all(root.join("data/missions")).unwrap();
        write_utf8_no_bom(&root.join("data/missions/mission_list.csv"), "mission\r\n").unwrap();

        let error = delete_indexed_config_entity(
            &root.to_string_lossy(),
            IndexedConfigKind::Mission,
            "missing",
            false,
        )
        .unwrap_err()
        .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("战役索引不存在: missing"));
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
