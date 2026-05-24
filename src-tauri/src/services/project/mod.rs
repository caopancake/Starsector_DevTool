mod factions;
mod performance;
mod projectiles;
mod sprites;

use crate::{
    domain::config::{build_skin_file, build_variant_file},
    errors::{AppError, AppResult},
    io::{load_json_dir_by_id, read_csv_data, read_json_file},
    models::{
        AppLogEntry, CsvRowKeyMapping, CsvRowPatchPayload, CsvSourceOptionsPayload, CsvTableWindow,
        CsvTableWindowPayload, CsvWindowRow, EntityData, EntitySummaries, GameModSummary,
        GameOverviewData, GameScanWarning, HullReferenceGroup, HullReferenceOption,
        HullReferencesPayload, HullReferencesResult, InvalidateCoreCachePayload,
        InvalidateProjectSessionPayload, OpenDirectoryResult, ProjectManifest, ProjectSessionId,
        QueryEntityListPayload, QueryEntityPayload, ResourceDataUrlBatchEntry,
        ResourceDataUrlBatchPayload, ResourceDataUrlBatchResult, ResourceRef, SaveCsvPatchResult,
        SaveCsvPatchWithHistoryPayload, SkinFile, SourceOption, SourceOptionGroup, TableSummary,
        VariantFile,
    },
    parsers::render_csv_text,
    services::{app_log, file_changes::FileChangeSetBuilder},
};
use performance::PerformanceTrace;
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

struct SpecBundle {
    ship_files: BTreeMap<String, Value>,
    variant_files: Vec<VariantFile>,
    skin_files: Vec<SkinFile>,
    wpn_files: BTreeMap<String, Value>,
    proj_files: BTreeMap<String, Value>,
    system_files: BTreeMap<String, Value>,
    skill_files: BTreeMap<String, Value>,
    warnings: Vec<GameScanWarning>,
}

#[derive(Clone)]
struct SessionCsvTable {
    header: Vec<String>,
    path: String,
    rows: Option<Vec<SessionCsvRow>>,
}

#[derive(Clone)]
struct SessionCsvRow {
    row_key: String,
    row: Map<String, Value>,
}

struct ProjectSession {
    manifest: ProjectManifest,
    faction_files: BTreeMap<String, Value>,
    tag_map: HashMap<String, String>,
    csv_tables: BTreeMap<String, SessionCsvTable>,
    ship_files: BTreeMap<String, Value>,
    variant_files: Vec<VariantFile>,
    skin_files: Vec<SkinFile>,
    wpn_files: BTreeMap<String, Value>,
    proj_files: BTreeMap<String, Value>,
    system_files: BTreeMap<String, Value>,
    skill_files: BTreeMap<String, Value>,
}

#[derive(Clone)]
struct CoreCache {
    csv_tables: BTreeMap<String, SessionCsvTable>,
    ship_files: Option<BTreeMap<String, Value>>,
    variant_files: Option<Vec<VariantFile>>,
    skin_files: Option<Vec<SkinFile>>,
    wpn_files: Option<BTreeMap<String, Value>>,
}

struct SourceOptionsContext<'a> {
    core: Option<CoreSourceData>,
    limit: usize,
    search: &'a str,
    seen: &'a mut std::collections::BTreeSet<String>,
    session: Option<&'a ProjectSession>,
    table: &'a str,
}

#[derive(Clone, Default)]
struct CoreSourceData {
    ship_files: BTreeMap<String, Value>,
    variant_files: Vec<VariantFile>,
    wpn_files: BTreeMap<String, Value>,
}

static PROJECT_SESSIONS: OnceLock<Mutex<BTreeMap<ProjectSessionId, ProjectSession>>> =
    OnceLock::new();
static CORE_CACHES: OnceLock<Mutex<BTreeMap<String, CoreCache>>> = OnceLock::new();

fn sessions() -> &'static Mutex<BTreeMap<ProjectSessionId, ProjectSession>> {
    PROJECT_SESSIONS.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn core_caches() -> &'static Mutex<BTreeMap<String, CoreCache>> {
    CORE_CACHES.get_or_init(|| Mutex::new(BTreeMap::new()))
}

pub fn open_project_session_with_root_for_command(
    app_handle: tauri::AppHandle,
    mod_root: String,
    starsector_root: Option<String>,
) -> AppResult<ProjectManifest> {
    let mut trace = PerformanceTrace::new("project.openSession");
    let result = open_project_session_traced(
        Path::new(&mod_root),
        starsector_root.as_deref().map(Path::new),
        &mut trace,
    );
    if result.is_ok() {
        write_performance_trace(app_handle, &trace, &[("modRoot", mod_root)]);
    }
    result
}

pub fn close_project_session_for_command(session_id: String) -> AppResult<()> {
    sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?
        .remove(&session_id);
    Ok(())
}

pub fn query_csv_table_window_for_command(
    payload: CsvTableWindowPayload,
) -> AppResult<CsvTableWindow> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    ensure_session_table_rows(session, &payload.table)?;
    let table = session_table(session, &payload.table)?;
    let rows_ref = table.rows.as_deref().unwrap_or(&[]);
    let search = payload.search.unwrap_or_default().trim().to_lowercase();
    let faction = payload.faction.unwrap_or_default();
    let filtered: Vec<(usize, &SessionCsvRow)> = table
        .rows
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .enumerate()
        .filter(|(_, row)| csv_row_matches(row, &search, &faction, &payload.table))
        .collect();
    let rows = filtered
        .iter()
        .skip(payload.start)
        .take(payload.count)
        .map(|(index, row)| CsvWindowRow {
            row_key: row.row_key.clone(),
            row_index: *index,
            row: row.row.clone(),
        })
        .collect();
    Ok(CsvTableWindow {
        table: payload.table,
        header: table.header.clone(),
        total_rows: rows_ref.len(),
        filtered_rows: filtered.len(),
        start: payload.start,
        rows,
    })
}

pub fn query_csv_source_options_for_command(
    payload: CsvSourceOptionsPayload,
) -> AppResult<Vec<SourceOptionGroup>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    let (table, column) = parse_csv_source(&payload.source)?;
    ensure_session_table_rows(session, table)?;
    let search = payload.search.unwrap_or_default().to_lowercase();
    let limit = payload.limit.unwrap_or(200);
    let mut seen = std::collections::BTreeSet::new();
    let mut groups = Vec::new();
    let current_options = source_options_from_values(
        "current",
        &payload.current_values,
        &search,
        limit,
        &mut seen,
    );
    if !current_options.is_empty() {
        groups.push(SourceOptionGroup {
            label: "当前值".to_string(),
            options: current_options,
        });
    }
    if let Some(csv) = session.csv_tables.get(table) {
        let rows = csv.rows.as_deref().unwrap_or(&[]);
        let options = source_options_from_rows(
            "mod",
            rows,
            column,
            SourceOptionsContext {
                core: None,
                limit,
                search: &search,
                seen: &mut seen,
                session: Some(session),
                table,
            },
        );
        if !options.is_empty() {
            groups.push(SourceOptionGroup {
                label: "当前 Mod".to_string(),
                options,
            });
        }
    }
    if let Some(root) = session.manifest.starsector_root.as_ref() {
        let core_csv = load_core_csv_table(root, table)?;
        if let Some(core_csv) = core_csv {
            let core_rows = core_csv.rows.unwrap_or_default();
            let core_data = load_core_source_data(root, table)?;
            let options = source_options_from_rows(
                "core",
                &core_rows,
                column,
                SourceOptionsContext {
                    core: Some(core_data),
                    limit,
                    search: &search,
                    seen: &mut seen,
                    session: Some(session),
                    table,
                },
            );
            if !options.is_empty() {
                groups.push(SourceOptionGroup {
                    label: "原版".to_string(),
                    options,
                });
            }
        }
    }
    Ok(groups)
}

pub fn query_hull_references_for_command(
    payload: HullReferencesPayload,
) -> AppResult<HullReferencesResult> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for(&guard, &payload.session_id)?;
    build_hull_references(session, &payload.hull_ids)
}

pub fn query_entity_for_command(payload: QueryEntityPayload) -> AppResult<Option<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    if payload.kind == "mission" {
        ensure_session_table_rows(session, "missions")?;
    }
    let data = match payload.kind.as_str() {
        "ship" => session.ship_files.get(&payload.id).cloned(),
        "weapon" => session.wpn_files.get(&payload.id).cloned(),
        "projectile" => session.proj_files.get(&payload.id).cloned(),
        "system" => session.system_files.get(&payload.id).cloned(),
        "skill" => session.skill_files.get(&payload.id).cloned(),
        "faction" => session.faction_files.get(&payload.id).cloned(),
        "mission" => build_mission_entity(session, &payload.id)?,
        "variant" => session
            .variant_files
            .iter()
            .find(|item| item.variant_id == payload.id)
            .and_then(|item| serde_json::to_value(item).ok()),
        "skin" => session
            .skin_files
            .iter()
            .find(|item| item.skin_hull_id == payload.id)
            .and_then(|item| serde_json::to_value(item).ok()),
        _ => None,
    };
    Ok(data.map(|data| EntityData {
        kind: payload.kind,
        id: payload.id,
        data,
    }))
}

pub fn query_entity_list_for_command(
    payload: QueryEntityListPayload,
) -> AppResult<Vec<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    if payload.kind == "mission" {
        ensure_session_table_rows(session, "missions")?;
    }
    let items = match payload.kind.as_str() {
        "variant" => session
            .variant_files
            .iter()
            .filter_map(|item| {
                serde_json::to_value(item).ok().map(|data| EntityData {
                    kind: payload.kind.clone(),
                    id: item.variant_id.clone(),
                    data,
                })
            })
            .collect(),
        "skin" => session
            .skin_files
            .iter()
            .filter_map(|item| {
                serde_json::to_value(item).ok().map(|data| EntityData {
                    kind: payload.kind.clone(),
                    id: item.skin_hull_id.clone(),
                    data,
                })
            })
            .collect(),
        "faction" => session
            .faction_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                data: data.clone(),
            })
            .collect(),
        "mission" => mission_rows(session)
            .into_iter()
            .filter_map(|row| {
                let id = string_from_row(&row, "mission")?;
                build_mission_list_entity(&payload.kind, &id, row)
            })
            .collect(),
        "projectile" => session
            .proj_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                data: data.clone(),
            })
            .collect(),
        "weapon" => session
            .wpn_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                data: data.clone(),
            })
            .collect(),
        "ship" => session
            .ship_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                data: data.clone(),
            })
            .collect(),
        _ => Vec::new(),
    };
    Ok(items)
}

pub fn query_resource_data_urls_for_command(
    payload: ResourceDataUrlBatchPayload,
) -> AppResult<ResourceDataUrlBatchResult> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for(&guard, &payload.session_id)?;
    let mut loaded: BTreeMap<String, Option<String>> = BTreeMap::new();
    let mut entries = Vec::with_capacity(payload.resources.len());
    for resource in payload.resources {
        let cache_key = resource_cache_key(&resource);
        let data_url = if let Some(data_url) = loaded.get(&cache_key) {
            data_url.clone()
        } else {
            let data_url = resource_data_url(session, &resource);
            loaded.insert(cache_key, data_url.clone());
            data_url
        };
        entries.push(ResourceDataUrlBatchEntry {
            key: resource.key,
            source: resource.source,
            rel_path: resource.rel_path,
            data_url,
        });
    }
    Ok(ResourceDataUrlBatchResult { entries })
}

pub fn invalidate_project_session_for_command(
    payload: InvalidateProjectSessionPayload,
) -> AppResult<()> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    for changed_path in payload.changed_paths {
        invalidate_session_path(session, &changed_path);
    }
    Ok(())
}

pub fn invalidate_core_cache_for_command(payload: InvalidateCoreCachePayload) -> AppResult<()> {
    core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .remove(&payload.starsector_root);
    Ok(())
}

fn resource_data_url(session: &ProjectSession, resource: &ResourceRef) -> Option<String> {
    let root = if resource.source == "core" {
        session
            .manifest
            .starsector_root
            .as_ref()
            .map(|root| PathBuf::from(root).join("starsector-core"))
    } else {
        Some(PathBuf::from(&session.manifest.mod_root))
    }?;
    sprites::load_sprite_data_url_from_root(&root, &resource.rel_path)
        .ok()
        .flatten()
}

fn resource_cache_key(resource: &ResourceRef) -> String {
    format!("{}:{}:{}", resource.source, resource.rel_path, resource.key)
}

fn mission_rows(session: &ProjectSession) -> Vec<Map<String, Value>> {
    session
        .csv_tables
        .get("missions")
        .and_then(|table| table.rows.as_ref())
        .map(|rows| rows.iter().map(|row| row.row.clone()).collect())
        .unwrap_or_default()
}

fn build_mission_list_entity(kind: &str, id: &str, row: Map<String, Value>) -> Option<EntityData> {
    let mut data = Map::new();
    data.insert("list".to_string(), Value::Object(row));
    Some(EntityData {
        kind: kind.to_string(),
        id: id.to_string(),
        data: Value::Object(data),
    })
}

fn build_mission_entity(session: &ProjectSession, id: &str) -> AppResult<Option<Value>> {
    let row = mission_rows(session)
        .into_iter()
        .find(|row| string_from_row(row, "mission").as_deref() == Some(id))
        .unwrap_or_else(|| {
            let mut row = Map::new();
            row.insert("mission".to_string(), Value::String(id.to_string()));
            row
        });
    let clean = crate::domain::config::validate_config_id(id, "无效战役 ID")?;
    let dir = Path::new(&session.manifest.mod_root)
        .join("data/missions")
        .join(clean);
    let descriptor_path = dir.join("descriptor.json");
    let descriptor = if descriptor_path.exists() {
        read_json_file(&descriptor_path)?
    } else {
        Value::Object(Map::new())
    };
    let text_path = dir.join("mission_text.txt");
    let text = if text_path.exists() {
        crate::io::read_utf8_no_bom(&text_path)?
    } else {
        String::new()
    };
    let icon_resource_ref = descriptor
        .get("icon")
        .and_then(Value::as_str)
        .map(|icon| {
            resource_ref(
                "mod",
                &format!("data/missions/{clean}/{icon}"),
                "mission",
                id,
                "icon",
            )
        })
        .and_then(|resource| serde_json::to_value(resource).ok());
    let mut data = Map::new();
    data.insert("list".to_string(), Value::Object(row));
    data.insert("descriptor".to_string(), descriptor);
    data.insert("text".to_string(), Value::String(text));
    if let Some(icon_resource_ref) = icon_resource_ref {
        data.insert("iconResourceRef".to_string(), icon_resource_ref);
    }
    data.insert(
        "relPath".to_string(),
        Value::String(format!("data/missions/{clean}")),
    );
    Ok(Some(Value::Object(data)))
}

pub fn save_csv_patch_for_command(
    payload: SaveCsvPatchWithHistoryPayload,
) -> AppResult<SaveCsvPatchResult> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    ensure_session_table_rows(session, &payload.table)?;
    let (mod_root, rel_path, header, mut rows) = {
        let table = session_table(session, &payload.table)?;
        (
            session.manifest.mod_root.clone(),
            table.path.clone(),
            table.header.clone(),
            table.rows.clone().unwrap_or_default(),
        )
    };
    let key_map = apply_csv_row_patches(&payload.table, &mut rows, payload.patches)?;
    let row_values: Vec<Map<String, Value>> = rows.iter().map(|row| row.row.clone()).collect();
    let csv_text = render_csv_text(&header, &row_values)?;
    let mut builder = FileChangeSetBuilder::new(Path::new(&mod_root));
    builder.text_file(&rel_path, Some(csv_text))?;
    for file in payload.associated_files {
        builder.file(&file.rel_path, file.after_text, file.after_data_base64)?;
    }
    let changes = builder.apply()?;
    {
        let table = session_table_mut(session, &payload.table)?;
        table.rows = Some(rows);
        table.header = header;
    }
    Ok(SaveCsvPatchResult { changes, key_map })
}

fn session_for<'a>(
    sessions: &'a BTreeMap<ProjectSessionId, ProjectSession>,
    session_id: &str,
) -> AppResult<&'a ProjectSession> {
    sessions
        .get(session_id)
        .ok_or_else(|| AppError::message(format!("unknown project session: {session_id}")))
}

fn session_for_mut<'a>(
    sessions: &'a mut BTreeMap<ProjectSessionId, ProjectSession>,
    session_id: &str,
) -> AppResult<&'a mut ProjectSession> {
    sessions
        .get_mut(session_id)
        .ok_or_else(|| AppError::message(format!("unknown project session: {session_id}")))
}

fn session_table<'a>(session: &'a ProjectSession, table: &str) -> AppResult<&'a SessionCsvTable> {
    session
        .csv_tables
        .get(table)
        .ok_or_else(|| AppError::message(format!("unknown table: {table}")))
}

fn session_table_mut<'a>(
    session: &'a mut ProjectSession,
    table: &str,
) -> AppResult<&'a mut SessionCsvTable> {
    session
        .csv_tables
        .get_mut(table)
        .ok_or_else(|| AppError::message(format!("unknown table: {table}")))
}

fn ensure_session_table_rows(session: &mut ProjectSession, table: &str) -> AppResult<()> {
    let needs_load = session
        .csv_tables
        .get(table)
        .map(|csv| csv.rows.is_none())
        .unwrap_or(false);
    if !needs_load {
        return Ok(());
    }
    let rel_path = session_table(session, table)?.path.clone();
    let path = Path::new(&session.manifest.mod_root).join(&rel_path);
    let mut csv = if path.exists() {
        read_csv_data(&path)?
    } else {
        crate::models::CsvTable {
            header: if table == "missions" {
                vec!["mission".to_string()]
            } else {
                Vec::new()
            },
            rows: Vec::new(),
            path: rel_path.clone(),
        }
    };
    if csv.header.is_empty() {
        if let Some(root) = session.manifest.starsector_root.as_ref() {
            if let Some(core_table) = load_core_csv_table(root, table)? {
                csv.header = core_table.header.clone();
            }
        }
    }
    for row in &mut csv.rows {
        let id = str_field(row, "id");
        let tags = str_field(row, "tags");
        row.insert(
            "_faction".to_string(),
            Value::String(factions::detect_faction(&id, &tags, &session.tag_map)),
        );
    }
    let rows = csv
        .rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| SessionCsvRow {
            row_key: format!("{table}:row:{index}"),
            row,
        })
        .collect();
    let table_state = session_table_mut(session, table)?;
    if table_state.header.is_empty() {
        table_state.header = csv.header;
    }
    table_state.rows = Some(rows);
    Ok(())
}

fn core_cache_snapshot(starsector_root: &str) -> AppResult<CoreCache> {
    let mut guard = core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?;
    Ok(guard
        .entry(starsector_root.to_string())
        .or_insert_with(|| CoreCache {
            csv_tables: BTreeMap::new(),
            ship_files: None,
            variant_files: None,
            skin_files: None,
            wpn_files: None,
        })
        .clone())
}

fn replace_core_cache(starsector_root: &str, cache: CoreCache) -> AppResult<()> {
    core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .insert(starsector_root.to_string(), cache);
    Ok(())
}

fn core_dir(starsector_root: &str) -> PathBuf {
    Path::new(starsector_root).join("starsector-core")
}

fn load_core_csv_table(starsector_root: &str, table: &str) -> AppResult<Option<SessionCsvTable>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(csv) = cache.csv_tables.get(table) {
        return Ok(Some(csv.clone()));
    }
    let Some(rel) = crate::models::CSV_TABLES
        .iter()
        .find_map(|(key, rel)| (*key == table).then_some(*rel))
    else {
        return Ok(None);
    };
    let core_dir = core_dir(starsector_root);
    if !core_dir.exists() {
        replace_core_cache(starsector_root, cache)?;
        return Ok(None);
    }
    let csv = read_csv_data(&core_dir.join(rel))?;
    let table_state = SessionCsvTable {
        header: csv.header,
        path: rel.to_string(),
        rows: Some(
            csv.rows
                .into_iter()
                .enumerate()
                .map(|(index, row)| SessionCsvRow {
                    row_key: format!("core:{table}:row:{index}"),
                    row,
                })
                .collect(),
        ),
    };
    cache
        .csv_tables
        .insert(table.to_string(), table_state.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(Some(table_state))
}

fn load_core_ship_files(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.ship_files.clone() {
        return Ok(files);
    }
    let files = if core_dir(starsector_root).exists() {
        load_json_dir_by_id(
            &core_dir(starsector_root).join("data/hulls"),
            "ship",
            "hullId",
        )?
    } else {
        BTreeMap::new()
    };
    cache.ship_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

fn load_core_weapon_files(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.wpn_files.clone() {
        return Ok(files);
    }
    let files = if core_dir(starsector_root).exists() {
        load_json_dir_by_id(&core_dir(starsector_root).join("data/weapons"), "wpn", "id")?
    } else {
        BTreeMap::new()
    };
    cache.wpn_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

fn load_core_variant_files(starsector_root: &str) -> AppResult<Vec<VariantFile>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.variant_files.clone() {
        return Ok(files);
    }
    let files = if core_dir(starsector_root).exists() {
        load_variant_files(&core_dir(starsector_root))?.0
    } else {
        Vec::new()
    };
    cache.variant_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

fn load_core_skin_files(starsector_root: &str) -> AppResult<Vec<SkinFile>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.skin_files.clone() {
        return Ok(files);
    }
    let files = if core_dir(starsector_root).exists() {
        load_skin_files(&core_dir(starsector_root))?.0
    } else {
        Vec::new()
    };
    cache.skin_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

fn load_core_source_data(starsector_root: &str, table: &str) -> AppResult<CoreSourceData> {
    let mut data = CoreSourceData::default();
    match table {
        "ships" => data.ship_files = load_core_ship_files(starsector_root)?,
        "weapons" => data.wpn_files = load_core_weapon_files(starsector_root)?,
        "wings" => {
            data.ship_files = load_core_ship_files(starsector_root)?;
            data.variant_files = load_core_variant_files(starsector_root)?;
        }
        _ => {}
    }
    Ok(data)
}

fn apply_csv_row_patches(
    table: &str,
    rows: &mut Vec<SessionCsvRow>,
    patches: Vec<CsvRowPatchPayload>,
) -> AppResult<Vec<CsvRowKeyMapping>> {
    let mut key_map = Vec::new();
    for patch in patches {
        match patch.action.as_str() {
            "delete" => rows.retain(|row| row.row_key != patch.row_key),
            "upsert" => {
                if let Some(row) = rows.iter_mut().find(|row| row.row_key == patch.row_key) {
                    row.row = patch.row;
                } else {
                    let next_key = if patch.row_key.contains(":new:") {
                        format!("{table}:row:{}", rows.len())
                    } else {
                        patch.row_key.clone()
                    };
                    key_map.push(CsvRowKeyMapping {
                        previous_key: patch.row_key,
                        next_key: next_key.clone(),
                    });
                    rows.push(SessionCsvRow {
                        row_key: next_key,
                        row: patch.row,
                    });
                }
            }
            other => {
                return Err(AppError::message(format!(
                    "unknown CSV row patch action: {other}"
                )));
            }
        }
    }
    Ok(key_map)
}

fn invalidate_session_path(session: &mut ProjectSession, changed_path: &str) {
    let normalized = changed_path.replace('\\', "/");
    for (key, rel) in crate::models::CSV_TABLES {
        if normalized.ends_with(rel) {
            if let Some(table) = session.csv_tables.get_mut(key) {
                table.rows = None;
            }
        }
    }
    if normalized.contains("/data/missions/")
        || normalized.ends_with("data/missions/mission_list.csv")
    {
        if let Some(table) = session.csv_tables.get_mut("missions") {
            table.rows = None;
        }
    }
}

fn open_project_session_traced(
    mod_root: &Path,
    starsector_root_override: Option<&Path>,
    trace: &mut PerformanceTrace,
) -> AppResult<ProjectManifest> {
    let session = build_project_session(mod_root, starsector_root_override, trace)?;
    let manifest = session.manifest.clone();
    sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?
        .insert(manifest.session_id.clone(), session);
    Ok(manifest)
}

fn build_project_session(
    mod_root: &Path,
    starsector_root_override: Option<&Path>,
    trace: &mut PerformanceTrace,
) -> AppResult<ProjectSession> {
    let session_id = new_session_id();
    let starsector_root = starsector_root_override
        .map(Path::to_path_buf)
        .or_else(|| infer_starsector_root(mod_root));
    let core_available = starsector_root
        .as_ref()
        .is_some_and(|root| root.join("starsector-core").exists());
    let timer = trace.timer();
    let mod_info = read_mod_info(mod_root);
    trace.record_stage(
        "mod_info",
        timer,
        [(
            "path",
            mod_root.join("mod_info.json").to_string_lossy().to_string(),
        )],
    );
    let timer = trace.timer();
    let (_, tag_map) = factions::discover_factions(mod_root)?;
    let faction_files = factions::load_faction_files(mod_root)?;
    trace.record_stage(
        "factions",
        timer,
        [
            ("factionFiles", faction_files.len().to_string()),
            ("tags", tag_map.len().to_string()),
        ],
    );
    let timer = trace.timer();
    let mission_count = count_mission_list_entries(mod_root);
    trace.record_stage(
        "mission_count",
        timer,
        [("missions", mission_count.to_string())],
    );
    let timer = trace.timer();
    let csv_tables = build_session_csv_tables(mod_root);
    trace.record_stage(
        "csv_index",
        timer,
        [("tables", csv_tables.len().to_string())],
    );
    let spec_bundle = load_spec_bundle(
        mod_root,
        starsector_root
            .as_ref()
            .map(|root| root.join("starsector-core"))
            .as_deref(),
        trace,
    )?;

    let table_summaries = csv_tables
        .iter()
        .map(|(key, table)| {
            (
                key.clone(),
                TableSummary {
                    path: table.path.clone(),
                    header: table.header.clone(),
                    available: mod_root.join(&table.path).exists(),
                    total_rows: None,
                },
            )
        })
        .collect();
    let entity_summaries = EntitySummaries {
        factions: faction_files.len(),
        missions: mission_count,
        ships: spec_bundle.ship_files.len(),
        weapons: spec_bundle.wpn_files.len(),
        projectiles: spec_bundle.proj_files.len(),
        variants: spec_bundle.variant_files.len(),
        skins: spec_bundle.skin_files.len(),
        systems: spec_bundle.system_files.len(),
        skills: spec_bundle.skill_files.len(),
    };
    let manifest = ProjectManifest {
        session_id,
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|path| path.to_string_lossy().to_string()),
        core_available,
        mod_info,
        table_summaries,
        entity_summaries,
        warnings: spec_bundle.warnings.clone(),
    };
    Ok(ProjectSession {
        manifest,
        faction_files,
        tag_map,
        csv_tables,
        ship_files: spec_bundle.ship_files,
        variant_files: spec_bundle.variant_files,
        skin_files: spec_bundle.skin_files,
        wpn_files: spec_bundle.wpn_files,
        proj_files: spec_bundle.proj_files,
        system_files: spec_bundle.system_files,
        skill_files: spec_bundle.skill_files,
    })
}

fn build_session_csv_tables(_mod_root: &Path) -> BTreeMap<String, SessionCsvTable> {
    let mut tables: BTreeMap<String, SessionCsvTable> = crate::models::CSV_TABLES
        .iter()
        .map(|(key, rel)| {
            (
                (*key).to_string(),
                SessionCsvTable {
                    header: Vec::new(),
                    path: (*rel).to_string(),
                    rows: None,
                },
            )
        })
        .collect();
    tables.insert(
        "missions".to_string(),
        SessionCsvTable {
            header: vec!["mission".to_string()],
            path: "data/missions/mission_list.csv".to_string(),
            rows: None,
        },
    );
    tables
}

fn new_session_id() -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("session-{stamp}")
}

fn csv_row_matches(row: &SessionCsvRow, search: &str, faction: &str, table: &str) -> bool {
    if !faction.is_empty()
        && faction != "all"
        && (table == "ships" || table == "weapons")
        && row
            .row
            .get("_faction")
            .and_then(Value::as_str)
            .unwrap_or_default()
            != faction
    {
        return false;
    }
    if search.is_empty() {
        return true;
    }
    row.row
        .values()
        .filter_map(Value::as_str)
        .any(|value| value.to_lowercase().contains(search))
}

fn str_field(row: &Map<String, Value>, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn string_from_row(row: &Map<String, Value>, key: &str) -> Option<String> {
    row.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn weapon_sprite_path(weapon: &Value) -> Option<String> {
    [
        "turretSprite",
        "hardpointSprite",
        "turretUnderSprite",
        "hardpointUnderSprite",
        "turretGunSprite",
        "hardpointGunSprite",
        "turretGlowSprite",
        "hardpointGlowSprite",
    ]
    .iter()
    .find_map(|key| string_field(weapon, key))
}

fn parse_csv_source(source: &str) -> AppResult<(&str, &str)> {
    let trimmed = source.strip_prefix("csv:").unwrap_or(source);
    let (table, column) = trimmed
        .split_once('.')
        .ok_or_else(|| AppError::message(format!("invalid csv source: {source}")))?;
    Ok((table, column))
}

fn source_options_from_values(
    origin: &str,
    values: &[String],
    search: &str,
    limit: usize,
    seen: &mut std::collections::BTreeSet<String>,
) -> Vec<SourceOption> {
    values
        .iter()
        .filter(|value| !value.trim().is_empty())
        .filter(|value| search.is_empty() || value.to_lowercase().contains(search))
        .filter(|value| seen.insert((*value).clone()))
        .take(limit)
        .map(|value| SourceOption {
            label: value.clone(),
            value: value.clone(),
            sprite: None,
            resource_ref: None,
            origin: origin.to_string(),
        })
        .collect()
}

fn source_options_from_rows(
    origin: &str,
    rows: &[SessionCsvRow],
    column: &str,
    context: SourceOptionsContext<'_>,
) -> Vec<SourceOption> {
    rows.iter()
        .filter(|row| !is_comment_row(&row.row))
        .filter_map(|row| {
            row.row
                .get(column)
                .and_then(Value::as_str)
                .map(|value| (row, value))
        })
        .filter(|(_, value)| !value.trim().is_empty())
        .filter(|(_, value)| {
            context.search.is_empty() || value.to_lowercase().contains(context.search)
        })
        .filter(|(_, value)| context.seen.insert((*value).to_string()))
        .take(context.limit)
        .map(|(row, value)| {
            let label = source_option_label(row, value);
            let resource_ref = source_option_resource_ref(
                origin,
                context.table,
                value,
                &row.row,
                context.session,
                context.core.as_ref(),
            );
            SourceOption {
                label,
                value: value.to_string(),
                sprite: None,
                resource_ref,
                origin: origin.to_string(),
            }
        })
        .collect()
}

fn source_option_label(row: &SessionCsvRow, value: &str) -> String {
    let name = row
        .row
        .get("name")
        .or_else(|| row.row.get("hullName"))
        .or_else(|| row.row.get("displayName"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    if name.trim().is_empty() || name == value {
        value.to_string()
    } else {
        format!("{name} ({value})")
    }
}

fn build_hull_references(
    session: &ProjectSession,
    requested_hull_ids: &[String],
) -> AppResult<HullReferencesResult> {
    let mut groups = Vec::new();
    let mut sprites = BTreeMap::new();
    let mut seen = std::collections::BTreeSet::new();
    let ship_options: Vec<HullReferenceOption> = session
        .ship_files
        .iter()
        .map(|(hull_id, ship)| {
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName")
                .map(|sprite| resource_ref("mod", &sprite, "ship", hull_id, "thumbnail"));
            if let Some(resource_ref) = resource_ref.clone() {
                sprites.insert(hull_id.clone(), resource_ref);
            }
            HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: "mod".to_string(),
                kind: "ship".to_string(),
                resource_ref,
            }
        })
        .collect();
    if !ship_options.is_empty() {
        groups.push(HullReferenceGroup {
            label: "当前 Mod".to_string(),
            options: ship_options,
        });
    }

    let skin_options: Vec<HullReferenceOption> = session
        .skin_files
        .iter()
        .map(|skin| {
            seen.insert(skin.skin_hull_id.clone());
            let resource_ref = skin_resource_ref("mod", &session.ship_files, skin);
            if let Some(resource_ref) = resource_ref.clone() {
                sprites.insert(skin.skin_hull_id.clone(), resource_ref);
            }
            HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: "mod".to_string(),
                kind: "skin".to_string(),
                resource_ref,
            }
        })
        .collect();
    if !skin_options.is_empty() {
        groups.push(HullReferenceGroup {
            label: "舰船皮肤".to_string(),
            options: skin_options,
        });
    }

    let mut core_ship_files = BTreeMap::new();
    let mut core_skin_files = Vec::new();
    if let Some(root) = session.manifest.starsector_root.as_ref() {
        core_ship_files = load_core_ship_files(root)?;
        core_skin_files = load_core_skin_files(root)?;

        let mut core_ship_options = Vec::new();
        for (hull_id, ship) in &core_ship_files {
            if seen.contains(hull_id) {
                continue;
            }
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName")
                .map(|sprite| resource_ref("core", &sprite, "ship", hull_id, "thumbnail"));
            core_ship_options.push(HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: "core".to_string(),
                kind: "ship".to_string(),
                resource_ref,
            });
        }
        if !core_ship_options.is_empty() {
            groups.push(HullReferenceGroup {
                label: "原版".to_string(),
                options: core_ship_options,
            });
        }

        let mut core_skin_options = Vec::new();
        for skin in &core_skin_files {
            if seen.contains(&skin.skin_hull_id) {
                continue;
            }
            seen.insert(skin.skin_hull_id.clone());
            let resource_ref = skin_resource_ref("core", &core_ship_files, skin);
            core_skin_options.push(HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: "core".to_string(),
                kind: "skin".to_string(),
                resource_ref,
            });
        }
        if !core_skin_options.is_empty() {
            groups.push(HullReferenceGroup {
                label: "原版皮肤".to_string(),
                options: core_skin_options,
            });
        }
    }

    for hull_id in requested_hull_ids {
        if sprites.contains_key(hull_id) {
            continue;
        }
        let resource_ref = session
            .skin_files
            .iter()
            .find(|skin| skin.skin_hull_id == *hull_id)
            .and_then(|skin| skin_resource_ref("mod", &session.ship_files, skin))
            .or_else(|| {
                session
                    .ship_files
                    .get(hull_id)
                    .and_then(|ship| string_field(ship, "spriteName"))
                    .map(|sprite| resource_ref("mod", &sprite, "ship", hull_id, "thumbnail"))
            })
            .or_else(|| {
                core_skin_files
                    .iter()
                    .find(|skin| skin.skin_hull_id == *hull_id)
                    .and_then(|skin| skin_resource_ref("core", &core_ship_files, skin))
            })
            .or_else(|| {
                core_ship_files
                    .get(hull_id)
                    .and_then(|ship| string_field(ship, "spriteName"))
                    .map(|sprite| resource_ref("core", &sprite, "ship", hull_id, "thumbnail"))
            });
        if let Some(resource_ref) = resource_ref {
            sprites.insert(hull_id.clone(), resource_ref);
        }
    }

    Ok(HullReferencesResult { groups, sprites })
}

fn hull_reference_label(hull_id: &str, ship: &Value) -> String {
    let name = string_field(ship, "hullName")
        .or_else(|| string_field(ship, "name"))
        .unwrap_or_default();
    if name.trim().is_empty() || name == hull_id {
        hull_id.to_string()
    } else {
        format!("{name} ({hull_id})")
    }
}

fn skin_resource_ref(
    source: &str,
    ship_files: &BTreeMap<String, Value>,
    skin: &SkinFile,
) -> Option<ResourceRef> {
    string_field(&skin.data, "spriteName")
        .map(|sprite| resource_ref(source, &sprite, "skin", &skin.skin_hull_id, "thumbnail"))
        .or_else(|| {
            ship_files
                .get(&skin.base_hull_id)
                .and_then(|ship| string_field(ship, "spriteName"))
                .map(|sprite| {
                    resource_ref(source, &sprite, "skin", &skin.skin_hull_id, "thumbnail")
                })
        })
}

fn resource_ref(
    source: &str,
    rel_path: &str,
    owner_kind: &str,
    owner_id: &str,
    key: &str,
) -> ResourceRef {
    ResourceRef {
        source: source.to_string(),
        rel_path: rel_path.to_string(),
        owner_kind: owner_kind.to_string(),
        owner_id: owner_id.to_string(),
        key: key.to_string(),
    }
}

fn source_option_resource_ref(
    origin: &str,
    table: &str,
    value: &str,
    row: &Map<String, Value>,
    session: Option<&ProjectSession>,
    core: Option<&CoreSourceData>,
) -> Option<ResourceRef> {
    let rel_path = match table {
        "ships" => session
            .and_then(|session| session.ship_files.get(value))
            .or_else(|| core.and_then(|core| core.ship_files.get(value)))
            .and_then(|ship| string_field(ship, "spriteName")),
        "weapons" => session
            .and_then(|session| session.wpn_files.get(value))
            .or_else(|| core.and_then(|core| core.wpn_files.get(value)))
            .and_then(weapon_sprite_path),
        "wings" => {
            let variant_id = string_from_row(row, "variant")?;
            let variant = session
                .and_then(|session| {
                    session
                        .variant_files
                        .iter()
                        .find(|variant| variant.variant_id == variant_id)
                })
                .or_else(|| {
                    core.and_then(|core| {
                        core.variant_files
                            .iter()
                            .find(|variant| variant.variant_id == variant_id)
                    })
                })?;
            session
                .and_then(|session| session.ship_files.get(&variant.hull_id))
                .or_else(|| core.and_then(|core| core.ship_files.get(&variant.hull_id)))
                .and_then(|ship| string_field(ship, "spriteName"))
        }
        "hullmods" => string_from_row(row, "sprite"),
        "shipSystems" => string_from_row(row, "icon"),
        "industries" => string_from_row(row, "image"),
        "skills" | "abilities" | "commodities" | "specialItems" | "submarkets"
        | "marketConditions" => string_from_row(row, "icon"),
        _ => None,
    }?;
    Some(ResourceRef {
        source: origin.to_string(),
        rel_path,
        owner_kind: table.to_string(),
        owner_id: value.to_string(),
        key: "thumbnail".to_string(),
    })
}

fn is_comment_row(row: &Map<String, Value>) -> bool {
    row.values()
        .filter_map(Value::as_str)
        .find(|value| !value.trim().is_empty())
        .is_some_and(|value| value.trim_start().starts_with('#'))
}

fn load_spec_bundle(
    mod_root: &Path,
    core_dir: Option<&Path>,
    trace: &mut PerformanceTrace,
) -> AppResult<SpecBundle> {
    let total_timer = trace.timer();
    let timer = trace.timer();
    let ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId")?;
    trace.record_stage(
        "spec.ship_files",
        timer,
        [("files", ship_files.len().to_string())],
    );
    let timer = trace.timer();
    let wpn_files = load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id")?;
    trace.record_stage(
        "spec.weapon_files",
        timer,
        [("files", wpn_files.len().to_string())],
    );
    let timer = trace.timer();
    let (variant_files, variant_warnings) = load_variant_files(mod_root)?;
    trace.record_stage(
        "spec.variant_files",
        timer,
        [
            ("files", variant_files.len().to_string()),
            ("warnings", variant_warnings.len().to_string()),
        ],
    );
    let timer = trace.timer();
    let (skin_files, skin_warnings) = load_skin_files(mod_root)?;
    trace.record_stage(
        "spec.skin_files",
        timer,
        [
            ("files", skin_files.len().to_string()),
            ("warnings", skin_warnings.len().to_string()),
        ],
    );
    let warnings = variant_warnings.into_iter().chain(skin_warnings).collect();
    let timer = trace.timer();
    let proj_files = projectiles::load_projectile_files(mod_root, core_dir)?;
    trace.record_stage(
        "spec.projectile_files",
        timer,
        [("files", proj_files.len().to_string())],
    );
    let timer = trace.timer();
    let system_files = load_json_dir_by_id(&mod_root.join("data/shipsystems"), "system", "id")?;
    trace.record_stage(
        "spec.system_files",
        timer,
        [("files", system_files.len().to_string())],
    );
    let timer = trace.timer();
    let skill_files = load_json_dir_by_id(&mod_root.join("data/characters/skills"), "skill", "id")?;
    trace.record_stage(
        "spec.skill_files",
        timer,
        [("files", skill_files.len().to_string())],
    );
    let bundle = SpecBundle {
        ship_files,
        variant_files,
        skin_files,
        wpn_files,
        proj_files,
        system_files,
        skill_files,
        warnings,
    };
    trace.record_stage(
        "spec_bundle",
        total_timer,
        [
            ("shipFiles", bundle.ship_files.len().to_string()),
            ("weaponFiles", bundle.wpn_files.len().to_string()),
            ("projectileFiles", bundle.proj_files.len().to_string()),
            ("systemFiles", bundle.system_files.len().to_string()),
            ("skillFiles", bundle.skill_files.len().to_string()),
            ("variantFiles", bundle.variant_files.len().to_string()),
            ("skinFiles", bundle.skin_files.len().to_string()),
        ],
    );
    Ok(bundle)
}

fn write_performance_trace(
    app_handle: tauri::AppHandle,
    trace: &PerformanceTrace,
    root_fields: &[(&str, String)],
) {
    for message in trace.log_messages(root_fields) {
        let _ = app_log::append_log_for_app(
            app_handle.clone(),
            AppLogEntry {
                level: "info".to_string(),
                message,
                path: None,
                line: None,
            },
        );
    }
}

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

fn is_game_root(path: &Path) -> bool {
    path.join("starsector-core").is_dir() && path.join("mods").is_dir()
}

fn is_mod_root(path: &Path) -> bool {
    path.join("mod_info.json").is_file()
}

fn infer_starsector_root(mod_root: &Path) -> Option<PathBuf> {
    let candidate = mod_root.parent()?.parent()?;
    is_game_root(candidate).then(|| candidate.to_path_buf())
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

fn read_mod_info(mod_root: &Path) -> Value {
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

fn count_mission_list_entries(mod_root: &Path) -> usize {
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

fn load_variant_files(mod_root: &Path) -> AppResult<(Vec<VariantFile>, Vec<GameScanWarning>)> {
    let dir = mod_root.join("data/variants");
    if !dir.exists() {
        return Ok((vec![], vec![]));
    }
    let mut seen = HashMap::new();
    let mut files = Vec::new();
    let mut warnings = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            crate::errors::AppError::context(
                format!("遍历 variant 目录失败 ({})", dir.display()),
                crate::errors::AppError::message(error.to_string()),
            )
        })?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("variant") {
            continue;
        }
        let path = entry.path();
        let data = read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_variant_file(mod_root, &rel_path, &data)
            .map_err(|error| crate::errors::AppError::context(path.display().to_string(), error))?;
        if let Some(previous) =
            seen.insert(file.variant_id.clone(), path.to_string_lossy().to_string())
        {
            warnings.push(GameScanWarning {
                path: path.to_string_lossy().to_string(),
                message: format!(
                    "重复 variantId {}，已保留第一个文件并跳过后续文件：{previous}",
                    file.variant_id
                ),
            });
            continue;
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.hull_id
            .cmp(&b.hull_id)
            .then_with(|| a.variant_id.cmp(&b.variant_id))
    });
    Ok((files, warnings))
}

fn load_skin_files(mod_root: &Path) -> AppResult<(Vec<SkinFile>, Vec<GameScanWarning>)> {
    let dir = mod_root.join("data/hulls/skins");
    if !dir.exists() {
        return Ok((vec![], vec![]));
    }
    let mut seen = HashMap::new();
    let mut files = Vec::new();
    let mut warnings = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            crate::errors::AppError::context(
                format!("遍历 skin 目录失败 ({})", dir.display()),
                crate::errors::AppError::message(error.to_string()),
            )
        })?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("skin") {
            continue;
        }
        let path = entry.path();
        let data = read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_skin_file(mod_root, &rel_path, &data)
            .map_err(|error| crate::errors::AppError::context(path.display().to_string(), error))?;
        if let Some(previous) = seen.insert(
            file.skin_hull_id.clone(),
            path.to_string_lossy().to_string(),
        ) {
            warnings.push(GameScanWarning {
                path: path.to_string_lossy().to_string(),
                message: format!(
                    "重复 skinHullId {}，已保留第一个文件并跳过后续文件：{previous}",
                    file.skin_hull_id
                ),
            });
            continue;
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.base_hull_id
            .cmp(&b.base_hull_id)
            .then_with(|| a.skin_hull_id.cmp(&b.skin_hull_id))
    });
    Ok((files, warnings))
}

fn normalize_rel_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::{read_utf8_no_bom, write_utf8_no_bom};
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
    fn save_csv_patch_creates_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_patch_create_assoc");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(&root.join("data/hulls/ship_data.csv"), "id,name\r\n").unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("new_ship".to_string()));
        row.insert("name".to_string(), Value::String("New Ship".to_string()));
        let session_id = manifest.session_id.clone();
        let result = save_csv_patch_for_command(SaveCsvPatchWithHistoryPayload {
            session_id: session_id.clone(),
            table: "ships".to_string(),
            patches: vec![CsvRowPatchPayload {
                row_key: "ships:new:1".to_string(),
                action: "upsert".to_string(),
                row,
            }],
            associated_files: vec![crate::models::AssociatedFileChangePayload {
                rel_path: "data/hulls/new_ship.ship".to_string(),
                after_text: Some("{\r\n  \"hullId\": \"new_ship\"\r\n}".to_string()),
                after_data_base64: None,
            }],
        })
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();
        let spec = read_utf8_no_bom(&root.join("data/hulls/new_ship.ship")).unwrap();

        let _ = close_project_session_for_command(session_id);
        let _ = fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert_eq!(result.key_map[0].previous_key, "ships:new:1");
        assert!(csv.contains("new_ship,New Ship"));
        assert!(spec.contains("\"hullId\": \"new_ship\""));
    }

    #[test]
    fn save_csv_patch_deletes_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_patch_delete_assoc");
        fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nold_weapon,Old Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/old_weapon.wpn"),
            "{\r\n  \"id\": \"old_weapon\"\r\n}",
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let window = query_csv_table_window_for_command(CsvTableWindowPayload {
            session_id: manifest.session_id.clone(),
            table: "weapons".to_string(),
            start: 0,
            count: 10,
            search: None,
            faction: None,
        })
        .unwrap();
        let result = save_csv_patch_for_command(SaveCsvPatchWithHistoryPayload {
            session_id: manifest.session_id.clone(),
            table: "weapons".to_string(),
            patches: vec![CsvRowPatchPayload {
                row_key: window.rows[0].row_key.clone(),
                action: "delete".to_string(),
                row: Map::new(),
            }],
            associated_files: vec![crate::models::AssociatedFileChangePayload {
                rel_path: "data/weapons/old_weapon.wpn".to_string(),
                after_text: None,
                after_data_base64: None,
            }],
        })
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();
        let spec_exists = root.join("data/weapons/old_weapon.wpn").exists();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert!(!csv.contains("old_weapon,Old Weapon"));
        assert!(!spec_exists);
    }

    #[test]
    fn source_options_return_resource_refs_without_data_urls() {
        let root = temp_dir("source_resource_refs");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name\r\nship_a,Ship A\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_a.ship"),
            r#"{"hullId":"ship_a","spriteName":"graphics/ships/ship_a.png"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let groups = query_csv_source_options_for_command(CsvSourceOptionsPayload {
            session_id: manifest.session_id.clone(),
            source: "csv:ships.id".to_string(),
            search: None,
            limit: None,
            current_values: Vec::new(),
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = fs::remove_dir_all(root);
        let option = groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == "ship_a")
            .unwrap();
        assert!(option.sprite.is_none());
        assert_eq!(
            option
                .resource_ref
                .as_ref()
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/ship_a.png")
        );
    }

    #[test]
    fn mission_entity_query_returns_index_descriptor_text_and_icon_ref() {
        let root = temp_dir("mission_entity_query");
        fs::create_dir_all(root.join("data/missions/demo")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\ndemo,Demo Mission\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/demo/descriptor.json"),
            r#"{"title":"Demo","icon":"icon.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/demo/mission_text.txt"),
            "mission text",
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let list = query_entity_list_for_command(QueryEntityListPayload {
            session_id: manifest.session_id.clone(),
            kind: "mission".to_string(),
        })
        .unwrap();
        let entity = query_entity_for_command(QueryEntityPayload {
            session_id: manifest.session_id.clone(),
            kind: "mission".to_string(),
            id: "demo".to_string(),
        })
        .unwrap()
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = fs::remove_dir_all(root);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "demo");
        assert_eq!(entity.data["list"]["mission"], "demo");
        assert_eq!(entity.data["descriptor"]["title"], "Demo");
        assert_eq!(entity.data["text"], "mission text");
        assert_eq!(
            entity.data["iconResourceRef"]["relPath"],
            "data/missions/demo/icon.png"
        );
    }

    #[test]
    fn batch_resource_query_keeps_order_and_uses_empty_for_missing() {
        let root = temp_dir("batch_resource_query");
        fs::create_dir_all(root.join("graphics/ships")).unwrap();
        fs::write(root.join("graphics/ships/ship.png"), [137, 80, 78, 71]).unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let result = query_resource_data_urls_for_command(ResourceDataUrlBatchPayload {
            session_id: manifest.session_id.clone(),
            resources: vec![
                ResourceRef {
                    source: "mod".to_string(),
                    rel_path: "graphics/ships/ship.png".to_string(),
                    owner_kind: "ship".to_string(),
                    owner_id: "ship".to_string(),
                    key: "ship".to_string(),
                },
                ResourceRef {
                    source: "mod".to_string(),
                    rel_path: "graphics/ships/missing.png".to_string(),
                    owner_kind: "ship".to_string(),
                    owner_id: "missing".to_string(),
                    key: "missing".to_string(),
                },
            ],
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = fs::remove_dir_all(root);
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].key, "ship");
        assert!(result.entries[0].data_url.is_some());
        assert_eq!(result.entries[1].key, "missing");
        assert!(result.entries[1].data_url.is_none());
    }

    #[test]
    fn hull_reference_query_returns_mod_and_core_ship_and_skin_refs() {
        let root = temp_dir("hull_reference_query");
        let mod_root = root.join("mods/demo");
        fs::create_dir_all(mod_root.join("data/hulls/skins")).unwrap();
        fs::create_dir_all(root.join("starsector-core/data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/hulls/mod_ship.ship"),
            r#"{"hullId":"mod_ship","hullName":"Mod Ship","spriteName":"graphics/ships/mod_ship.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/hulls/skins/mod_skin.skin"),
            r#"{"skinHullId":"mod_skin","baseHullId":"mod_ship"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/core_ship.ship"),
            r#"{"hullId":"core_ship","hullName":"Core Ship","spriteName":"graphics/ships/core_ship.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/skins/core_skin.skin"),
            r#"{"skinHullId":"core_skin","baseHullId":"core_ship"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let result = query_hull_references_for_command(HullReferencesPayload {
            session_id: manifest.session_id.clone(),
            hull_ids: vec![
                "mod_ship".to_string(),
                "mod_skin".to_string(),
                "core_ship".to_string(),
                "core_skin".to_string(),
            ],
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = fs::remove_dir_all(root);
        let values: Vec<String> = result
            .groups
            .iter()
            .flat_map(|group| group.options.iter().map(|option| option.value.clone()))
            .collect();
        assert!(values.contains(&"mod_ship".to_string()));
        assert!(values.contains(&"mod_skin".to_string()));
        assert!(values.contains(&"core_ship".to_string()));
        assert!(values.contains(&"core_skin".to_string()));
        assert_eq!(
            result
                .sprites
                .get("core_skin")
                .map(|resource| resource.source.as_str()),
            Some("core")
        );
        assert_eq!(
            result
                .sprites
                .get("mod_skin")
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/mod_ship.png")
        );
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
    fn open_project_session_rejects_variant_missing_required_ids() {
        let root = temp_dir("variant_missing_ids");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/bad.variant"),
            r#"{"variantId":"bad"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("bad.variant"));
        assert!(error.contains("hullId"));
    }

    #[test]
    fn open_project_session_warns_and_keeps_first_duplicate_variant_id() {
        let root = temp_dir("variant_duplicate_id");
        fs::create_dir_all(root.join("data/variants/a")).unwrap();
        fs::create_dir_all(root.join("data/variants/b")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/a/one.variant"),
            r#"{"variantId":"dup","hullId":"hull_a"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/b/two.variant"),
            r#"{"variantId":"dup","hullId":"hull_b"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let loaded = open_project_session_traced(&root, None, &mut trace).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.entity_summaries.variants, 1);
        assert!(loaded
            .warnings
            .iter()
            .any(|warning| warning.message.contains("重复 variantId dup")
                && warning.path.contains("two.variant")));
    }

    #[test]
    fn open_project_session_rejects_skin_missing_required_ids() {
        let root = temp_dir("skin_missing_ids");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/bad.skin"),
            r#"{"skinHullId":"bad"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("bad.skin"));
        assert!(error.contains("baseHullId"));
    }

    #[test]
    fn open_project_session_warns_and_keeps_first_duplicate_skin_hull_id() {
        let root = temp_dir("skin_duplicate_id");
        fs::create_dir_all(root.join("data/hulls/skins/a")).unwrap();
        fs::create_dir_all(root.join("data/hulls/skins/b")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/a/one.skin"),
            r#"{"skinHullId":"dup","baseHullId":"hull_a"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/b/two.skin"),
            r#"{"skinHullId":"dup","baseHullId":"hull_b"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let loaded = open_project_session_traced(&root, None, &mut trace).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded.entity_summaries.skins, 1);
        assert!(loaded
            .warnings
            .iter()
            .any(|warning| warning.message.contains("重复 skinHullId dup")
                && warning.path.contains("two.skin")));
    }

    #[test]
    fn duplicate_variant_ids_keep_first_and_warn() {
        let root = temp_dir("core_kite_duplicate");
        let core_root = root.join("starsector-core");
        fs::create_dir_all(core_root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_original_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_Experimental.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_HF.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();

        let (variants, warnings) = load_variant_files(&core_root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(variants.len(), 3);
        assert_eq!(warnings.len(), 3);
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_hegemony_Interceptor"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_original_Stock"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "ziggurat_Experimental"));
        assert!(warnings
            .iter()
            .any(|warning| warning.message.contains("kite_hegemony_Interceptor")));
    }

    #[test]
    fn duplicate_variant_ids_do_not_fail_mod_loading() {
        let root = temp_dir("mod_kite_duplicate");
        fs::create_dir_all(root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();

        let (variants, warnings) = load_variant_files(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(variants.len(), 1);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0]
            .message
            .contains("重复 variantId kite_hegemony_Interceptor"));
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
