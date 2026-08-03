pub(super) mod core;
pub(super) mod csv;
pub(super) mod invalidation;
pub(super) mod persistent;

use crate::{
    errors::{AppError, AppResult},
    models::ProjectSessionId,
};
use std::{
    collections::BTreeMap,
    sync::{Mutex, OnceLock},
};

use super::model::{CoreCache, ProjectSession};

pub(crate) use core::{
    load_core_csv_table, load_core_projectile_specs, load_core_ship_files, load_core_skin_files,
    load_core_source_data,
};
pub(crate) use csv::{
    ensure_registered_table_rows, ensure_session_table_rows, loaded_csv_rows,
    loaded_registered_csv_rows, registered_session_table, registered_session_table_mut,
};
pub(crate) use invalidation::invalidate_session_changes;

static PROJECT_SESSIONS: OnceLock<Mutex<BTreeMap<ProjectSessionId, ProjectSession>>> =
    OnceLock::new();
static CORE_CACHES: OnceLock<Mutex<BTreeMap<String, CoreCache>>> = OnceLock::new();

pub(crate) fn sessions() -> &'static Mutex<BTreeMap<ProjectSessionId, ProjectSession>> {
    PROJECT_SESSIONS.get_or_init(|| Mutex::new(BTreeMap::new()))
}

pub(crate) fn core_caches() -> &'static Mutex<BTreeMap<String, CoreCache>> {
    CORE_CACHES.get_or_init(|| Mutex::new(BTreeMap::new()))
}

pub(crate) fn session_for<'a>(
    sessions: &'a BTreeMap<ProjectSessionId, ProjectSession>,
    session_id: &str,
) -> AppResult<&'a ProjectSession> {
    sessions
        .get(session_id)
        .ok_or_else(|| AppError::message(format!("unknown project session: {session_id}")))
}

pub(crate) fn session_for_mut<'a>(
    sessions: &'a mut BTreeMap<ProjectSessionId, ProjectSession>,
    session_id: &str,
) -> AppResult<&'a mut ProjectSession> {
    sessions
        .get_mut(session_id)
        .ok_or_else(|| AppError::message(format!("unknown project session: {session_id}")))
}

pub(super) fn invalidate_core_cache(starsector_root: &str) -> AppResult<()> {
    let cache_key = core::core_cache_key(starsector_root)?;
    core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .remove(&cache_key);
    Ok(())
}
