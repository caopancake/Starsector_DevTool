use super::model::{
    ProjectSession, SessionCsvTable, SpecBundle, MISSION_LIST_REL_PATH, MISSION_LIST_TABLE_KEY,
};
use super::{
    cache::{self, invalidate_session_path, session_for_mut, sessions},
    factions,
    performance::PerformanceTrace,
    projectiles, root,
    spec_files::{load_skin_files, load_variant_files},
};
use crate::{
    errors::{AppError, AppResult},
    io::{load_json_dir_by_id, read_csv_data, FsRootBoundary},
    models::{CsvTableKey, EntitySummaries, ProjectManifest, TableSummary},
    models::{ProjectInvalidation, ProjectSessionInvalidationResult},
};
use std::{
    collections::BTreeMap,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

pub fn close_project_session(session_id: String) -> AppResult<()> {
    sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?
        .remove(&session_id);
    Ok(())
}

pub fn ensure_project_session_mod_root(session_id: &str, mod_root: &str) -> AppResult<()> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = super::cache::session_for(&guard, session_id)?;
    let expected_root = FsRootBoundary::new(Path::new(&session.manifest.mod_root), "mod root")?;
    let actual_root = FsRootBoundary::new(Path::new(mod_root), "mod root")?;
    if expected_root.root() != actual_root.root() {
        return Err(AppError::message(format!(
            "project session {session_id} does not own mod root: {mod_root}"
        )));
    }
    Ok(())
}

pub fn invalidate_project_session(
    session_id: &str,
    changed_paths: Vec<String>,
) -> AppResult<ProjectSessionInvalidationResult> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    let mut invalidation = ProjectInvalidation::default();
    for changed_path in changed_paths {
        invalidation.merge(invalidate_session_path(session, &changed_path)?);
    }
    Ok(ProjectSessionInvalidationResult {
        manifest: session.manifest.clone(),
        invalidation,
    })
}

pub fn invalidate_core_cache(starsector_root: &str) -> AppResult<()> {
    cache::invalidate_core_cache(starsector_root)
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
    let mod_root_boundary = FsRootBoundary::new(mod_root, "mod root")?;
    let mod_root = mod_root_boundary.root();
    let session_id = new_session_id();
    let starsector_root = starsector_root_override
        .map(Path::to_path_buf)
        .or_else(|| root::infer_starsector_root(mod_root));
    let starsector_root = starsector_root
        .as_deref()
        .map(|root| {
            FsRootBoundary::new(root, "starsector root")
                .map(|boundary| boundary.root().to_path_buf())
        })
        .transpose()?;
    let core_available = starsector_root
        .as_ref()
        .is_some_and(|root| root.join("starsector-core").exists());
    let timer = trace.timer();
    let mod_info = root::read_mod_info(mod_root)?;
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
    let mission_count = root::count_mission_list_entries(mod_root)?;
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

    let table_summaries = super::table_definitions::csv_table_definitions()
        .iter()
        .map(|definition| {
            let table = csv_tables.get(definition.key.as_str()).ok_or_else(|| {
                AppError::message(format!(
                    "missing registered CSV table: {}",
                    definition.key.as_str()
                ))
            })?;
            Ok((
                definition.key,
                TableSummary {
                    path: table.path.clone(),
                    header: table.header.clone(),
                    available: mod_root.join(&table.path).exists(),
                    total_rows: None,
                },
            ))
        })
        .collect::<AppResult<BTreeMap<_, _>>>()?;
    let entity_summaries = EntitySummaries {
        factions: faction_files.len(),
        missions: mission_count,
        ships: spec_bundle.ship_files.len(),
        weapons: spec_bundle.weapon_specs.len(),
        projectiles: spec_bundle.projectile_specs.len(),
        variants: spec_bundle.variant_files.len(),
        skins: spec_bundle.skin_files.len(),
        systems: spec_bundle.system_files.len(),
        skills: spec_bundle.skill_files.len(),
    };
    let table_entity_summaries = build_table_entity_summaries(mod_root, &entity_summaries)?;
    let manifest = ProjectManifest {
        session_id,
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|path| path.to_string_lossy().to_string()),
        core_available,
        associated_spec_tables: super::entity_definitions::associated_spec_tables(),
        mod_info,
        table_summaries,
        table_entity_summaries,
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
        weapon_specs: spec_bundle.weapon_specs,
        projectile_specs: spec_bundle.projectile_specs,
        system_files: spec_bundle.system_files,
        skill_files: spec_bundle.skill_files,
    })
}

pub(super) fn build_session_csv_tables(_mod_root: &Path) -> BTreeMap<String, SessionCsvTable> {
    let mut tables: BTreeMap<String, SessionCsvTable> =
        super::table_definitions::csv_table_definitions()
            .iter()
            .map(|definition| {
                (
                    definition.key.as_str().to_string(),
                    SessionCsvTable {
                        header: Vec::new(),
                        path: definition.rel_path.to_string(),
                        rows: None,
                    },
                )
            })
            .collect();
    tables.insert(
        MISSION_LIST_TABLE_KEY.to_string(),
        SessionCsvTable {
            header: vec!["mission".to_string()],
            path: MISSION_LIST_REL_PATH.to_string(),
            rows: None,
        },
    );
    tables
}

pub(super) fn build_table_entity_summaries(
    mod_root: &Path,
    entity_summaries: &EntitySummaries,
) -> AppResult<BTreeMap<CsvTableKey, usize>> {
    super::table_definitions::csv_table_definitions()
        .iter()
        .map(|definition| {
            let count = if let Some(count) =
                super::table_definitions::csv_table_entity_summary(definition.key, entity_summaries)
            {
                count
            } else {
                count_valid_csv_entities(mod_root, definition.key, definition.rel_path)?
            };
            Ok((definition.key, count))
        })
        .collect()
}

pub(super) fn count_valid_csv_entities(
    mod_root: &Path,
    table: CsvTableKey,
    rel_path: &str,
) -> AppResult<usize> {
    let id_field = super::table_definitions::csv_table_entity_id_field(table);
    let csv = read_csv_data(&mod_root.join(rel_path))?;
    Ok(csv
        .rows
        .iter()
        .filter(|row| !super::model::is_comment_row(row))
        .filter(|row| super::model::string_from_row(row, id_field).is_some())
        .count())
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
    let weapon_specs = load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id")?;
    trace.record_stage(
        "spec.weapon_specs",
        timer,
        [("files", weapon_specs.len().to_string())],
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
    let projectile_specs = projectiles::load_projectile_specs(mod_root, core_dir)?;
    trace.record_stage(
        "spec.projectile_specs",
        timer,
        [("files", projectile_specs.len().to_string())],
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
        weapon_specs,
        projectile_specs,
        system_files,
        skill_files,
        warnings,
    };
    trace.record_stage(
        "spec_bundle",
        total_timer,
        [
            ("shipFiles", bundle.ship_files.len().to_string()),
            ("weaponSpecs", bundle.weapon_specs.len().to_string()),
            ("projectileSpecs", bundle.projectile_specs.len().to_string()),
            ("systemFiles", bundle.system_files.len().to_string()),
            ("skillFiles", bundle.skill_files.len().to_string()),
            ("variantFiles", bundle.variant_files.len().to_string()),
            ("skinFiles", bundle.skin_files.len().to_string()),
        ],
    );
    Ok(bundle)
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
    fn open_project_session_rejects_corrupted_mod_info() {
        let root = temp_dir("mod_info_corrupted");
        write_utf8_no_bom(&root.join("mod_info.json"), "{").unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("mod_info.json"));
    }

    #[test]
    fn open_project_session_rejects_corrupted_mission_list() {
        let root = temp_dir("mission_list_corrupted");
        std::fs::create_dir_all(root.join("data/missions")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission\r\nbad,extra\r\n",
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, None, &mut trace)
            .unwrap_err()
            .to_string();

        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("mission_list.csv"));
    }

    #[test]
    fn open_project_session_rejects_parent_dir_starsector_root() {
        let root = temp_dir("session_parent_dir_starsector_root");
        let escaped = root.join("..");

        let mut trace = PerformanceTrace::new("project.openSession");
        let error = open_project_session_traced(&root, Some(&escaped), &mut trace)
            .unwrap_err()
            .to_string();

        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("invalid starsector root path"));
    }

    #[test]
    fn session_mod_root_validation_rejects_wrong_root() {
        let left = temp_dir("session_mod_root_left");
        let right = temp_dir("session_mod_root_right");
        write_utf8_no_bom(&left.join("mod_info.json"), r#"{"id":"left"}"#).unwrap();
        write_utf8_no_bom(&right.join("mod_info.json"), r#"{"id":"right"}"#).unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&left, None, &mut trace).unwrap();

        ensure_project_session_mod_root(&manifest.session_id, &left.to_string_lossy()).unwrap();
        let error = ensure_project_session_mod_root(&manifest.session_id, &right.to_string_lossy())
            .unwrap_err()
            .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(left);
        let _ = std::fs::remove_dir_all(right);
        assert!(error.contains("does not own mod root"));
    }

    #[test]
    fn open_project_session_manifest_summaries_only_include_public_csv_tables() {
        let root = temp_dir("manifest_public_csv_tables");
        std::fs::create_dir_all(root.join("data/missions")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission\r\ndemo\r\n",
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let manifest_json = serde_json::to_value(&manifest).unwrap();

        let _ = std::fs::remove_dir_all(root);
        assert_eq!(manifest.entity_summaries.missions, 1);
        assert!(!manifest_json["tableSummaries"]
            .as_object()
            .unwrap()
            .contains_key(MISSION_LIST_TABLE_KEY));
    }

    #[test]
    fn open_project_session_manifest_counts_valid_table_entities() {
        let root = temp_dir("manifest_table_entity_counts");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        std::fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/wing_data.csv"),
            "id,variant\r\nwing_a,var_a\r\n,\r\n#comment,\r\nwing_b,var_b\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/sim_opponents.csv"),
            "variant id\r\nvar_a\r\n\r\n#comment\r\nvar_b\r\n",
        )
        .unwrap();

        let mut trace = PerformanceTrace::new("project.openSession");
        let loaded = open_project_session_traced(&root, None, &mut trace).unwrap();

        let _ = std::fs::remove_dir_all(root);
        assert_eq!(
            loaded.table_entity_summaries[&crate::models::CsvTableKey::Wings],
            2
        );
        assert_eq!(
            loaded.table_entity_summaries[&crate::models::CsvTableKey::SimOpponents],
            2
        );
        assert_eq!(
            loaded.table_summaries[&crate::models::CsvTableKey::Wings].total_rows,
            None
        );
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
