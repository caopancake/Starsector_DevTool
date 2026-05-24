use crate::{
    errors::{AppError, AppResult},
    io::{load_json_dir_by_id, read_csv_data},
    models::{SkinFile, VariantFile, CSV_TABLES},
};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

use super::super::{
    model::{CoreCache, CoreSourceData, SessionCsvRow, SessionCsvTable},
    spec_files::{load_skin_files, load_variant_files},
};
use super::core_caches;

pub(crate) fn core_cache_snapshot(starsector_root: &str) -> AppResult<CoreCache> {
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

pub(crate) fn replace_core_cache(starsector_root: &str, cache: CoreCache) -> AppResult<()> {
    core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .insert(starsector_root.to_string(), cache);
    Ok(())
}

pub(crate) fn core_dir(starsector_root: &str) -> PathBuf {
    Path::new(starsector_root).join("starsector-core")
}

pub(crate) fn load_core_csv_table(
    starsector_root: &str,
    table: &str,
) -> AppResult<Option<SessionCsvTable>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(csv) = cache.csv_tables.get(table) {
        return Ok(Some(csv.clone()));
    }
    let Some(rel) = CSV_TABLES
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

pub(crate) fn load_core_ship_files(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
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

pub(crate) fn load_core_weapon_files(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
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

pub(crate) fn load_core_variant_files(starsector_root: &str) -> AppResult<Vec<VariantFile>> {
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

pub(crate) fn load_core_skin_files(starsector_root: &str) -> AppResult<Vec<SkinFile>> {
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

pub(crate) fn load_core_source_data(
    starsector_root: &str,
    table: &str,
) -> AppResult<CoreSourceData> {
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
