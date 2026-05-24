use super::model::{ProjectSession, SessionCsvTable, SpecBundle};
use super::{
    cache::{self, invalidate_session_path, session_for_mut, sessions},
    factions,
    performance::PerformanceTrace,
    projectiles, root,
    spec_files::{load_skin_files, load_variant_files},
};
use crate::{
    errors::{AppError, AppResult},
    io::load_json_dir_by_id,
    models::{
        AppLogEntry, EntitySummaries, InvalidateCoreCachePayload, InvalidateProjectSessionPayload,
        ProjectManifest, TableSummary,
    },
    services::app_log,
};
use std::{
    collections::BTreeMap,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

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
    cache::invalidate_core_cache(&payload.starsector_root)
}

pub(super) fn open_project_session_traced(
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

pub(super) fn build_project_session(
    mod_root: &Path,
    starsector_root_override: Option<&Path>,
    trace: &mut PerformanceTrace,
) -> AppResult<ProjectSession> {
    let session_id = new_session_id();
    let starsector_root = starsector_root_override
        .map(Path::to_path_buf)
        .or_else(|| root::infer_starsector_root(mod_root));
    let core_available = starsector_root
        .as_ref()
        .is_some_and(|root| root.join("starsector-core").exists());
    let timer = trace.timer();
    let mod_info = root::read_mod_info(mod_root);
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
    let mission_count = root::count_mission_list_entries(mod_root);
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

pub(super) fn build_session_csv_tables(_mod_root: &Path) -> BTreeMap<String, SessionCsvTable> {
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

pub(super) fn new_session_id() -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("session-{stamp}")
}

pub(super) fn load_spec_bundle(
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

pub(super) fn write_performance_trace(
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;

    #[test]
    fn open_project_session_rejects_variant_missing_required_ids() {
        let root = temp_dir("variant_missing_ids");
        std::fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/bad.variant"),
            r#"{"variantId":"bad"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("bad.variant"));
        assert!(error.contains("hullId"));
    }

    #[test]
    fn open_project_session_warns_and_keeps_first_duplicate_variant_id() {
        let root = temp_dir("variant_duplicate_id");
        std::fs::create_dir_all(root.join("data/variants/a")).unwrap();
        std::fs::create_dir_all(root.join("data/variants/b")).unwrap();
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

        let _ = std::fs::remove_dir_all(root);
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
        std::fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/bad.skin"),
            r#"{"skinHullId":"bad"}"#,
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("bad.skin"));
        assert!(error.contains("baseHullId"));
    }

    #[test]
    fn open_project_session_warns_and_keeps_first_duplicate_skin_hull_id() {
        let root = temp_dir("skin_duplicate_id");
        std::fs::create_dir_all(root.join("data/hulls/skins/a")).unwrap();
        std::fs::create_dir_all(root.join("data/hulls/skins/b")).unwrap();
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

        let _ = std::fs::remove_dir_all(root);
        assert_eq!(loaded.entity_summaries.skins, 1);
        assert!(loaded
            .warnings
            .iter()
            .any(|warning| warning.message.contains("重复 skinHullId dup")
                && warning.path.contains("two.skin")));
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
