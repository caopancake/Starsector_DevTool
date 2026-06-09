use crate::{
    errors::AppResult,
    io::{normalized_path_key, path_uses_parent_dir},
    models::{
        CsvTableKey, EntityKind, InvalidatedEntityRef, InvalidatedQueryKind, InvalidatedQueryScope,
        InvalidatedResourceScope, ProjectInvalidation, ResourceSource,
    },
};
use std::path::{Component, Path};

use super::super::{entity_definitions, model::ProjectSession, root, table_definitions};

pub(crate) fn invalidate_session_path(
    session: &mut ProjectSession,
    changed_path: &str,
) -> AppResult<ProjectInvalidation> {
    let Some(project_path) = project_scoped_changed_path(&session.manifest.mod_root, changed_path)
    else {
        return Ok(ProjectInvalidation::default());
    };
    let target = ChangedProjectPath::classify(&project_path);
    let invalidation = target.project_invalidation(&project_path);
    for table_key in &target.csv_tables {
        if let Some(table) = session.csv_tables.get_mut(table_key.as_str()) {
            table.rows = None;
        }
        refresh_table_entity_summary(session, table_key.as_str())?;
    }
    let mod_root = Path::new(&session.manifest.mod_root).to_path_buf();
    if target.refresh_mod_info {
        session.manifest.mod_info = root::read_mod_info(&mod_root)?;
    }
    for kind in &target.affected_entities {
        let definition = entity_definitions::entity_definition(*kind);
        (definition.refresh)(session)?;
        if let Some(table) = definition.csv_table {
            refresh_table_entity_summary(session, table.as_str())?;
        }
    }
    Ok(invalidation)
}

fn project_scoped_changed_path(mod_root: &str, changed_path: &str) -> Option<String> {
    let path = Path::new(changed_path);
    if path_uses_parent_dir(path) {
        return None;
    }
    let normalized_path = normalized_path_key(path);
    if !path.is_absolute() {
        if path
            .components()
            .any(|part| matches!(part, Component::Prefix(_)))
        {
            return None;
        }
        return Some(normalized_path);
    }
    let normalized_root = normalized_path_key(Path::new(mod_root));
    if normalized_path == normalized_root {
        return Some(String::new());
    }
    normalized_path
        .strip_prefix(&format!("{normalized_root}/"))
        .map(ToOwned::to_owned)
}

#[derive(Default)]
struct ChangedProjectPath {
    csv_tables: Vec<CsvTableKey>,
    refresh_mod_info: bool,
    affected_entities: Vec<EntityKind>,
}

impl ChangedProjectPath {
    fn classify(changed_path: &str) -> Self {
        let affected_entities = entity_definitions::entity_definitions()
            .iter()
            .filter(|definition| (definition.path_matches)(definition, changed_path))
            .map(|definition| definition.kind)
            .collect();
        Self {
            csv_tables: affected_csv_tables(changed_path),
            refresh_mod_info: path_affects_target(changed_path, "mod_info.json"),
            affected_entities,
        }
    }

    fn project_invalidation(&self, changed_path: &str) -> ProjectInvalidation {
        let tables = self.csv_tables.clone();
        let mut entities = Vec::new();
        for definition in &self.affected_entities {
            entities.push(InvalidatedEntityRef {
                kind: *definition,
                id: None,
            });
        }
        let resources: Vec<InvalidatedResourceScope> = (!changed_path.is_empty())
            .then(|| InvalidatedResourceScope {
                source: ResourceSource::Mod,
                rel_path: changed_path.to_string(),
            })
            .into_iter()
            .collect();
        let query_scopes = query_scopes_for_invalidation(&tables, &entities, &resources);
        ProjectInvalidation {
            paths: vec![changed_path.to_string()],
            tables,
            entities,
            resources,
            query_scopes,
            session: changed_path.is_empty(),
        }
    }
}

fn query_scopes_for_invalidation(
    tables: &[CsvTableKey],
    entities: &[InvalidatedEntityRef],
    resources: &[InvalidatedResourceScope],
) -> Vec<InvalidatedQueryScope> {
    let mut scopes = Vec::new();
    for table in tables {
        push_query_scope(
            &mut scopes,
            InvalidatedQueryScope {
                kind: InvalidatedQueryKind::CsvTableWindow,
                table: Some(*table),
                source: None,
                entity: None,
                resource: None,
            },
        );
        push_query_scope(
            &mut scopes,
            InvalidatedQueryScope {
                kind: InvalidatedQueryKind::CsvRowPreview,
                table: Some(*table),
                source: None,
                entity: None,
                resource: None,
            },
        );
        push_query_scope(
            &mut scopes,
            InvalidatedQueryScope {
                kind: InvalidatedQueryKind::CsvSourceOptions,
                table: Some(*table),
                source: None,
                entity: None,
                resource: None,
            },
        );
    }
    for entity in entities {
        push_entity_query_scope(
            &mut scopes,
            InvalidatedQueryKind::EntityDetail,
            entity.clone(),
        );
        push_entity_query_scope(
            &mut scopes,
            InvalidatedQueryKind::EntityList,
            entity.clone(),
        );
        let definition = entity_definitions::entity_definition(entity.kind);
        for source in entity_definitions::source_option_origin_scopes(definition) {
            push_source_option_query_scope(&mut scopes, source);
        }
        for impact in definition.query_impacts {
            push_query_scope(
                &mut scopes,
                InvalidatedQueryScope {
                    kind: *impact,
                    table: None,
                    source: None,
                    entity: None,
                    resource: None,
                },
            );
        }
    }
    for resource in resources {
        push_query_scope(
            &mut scopes,
            InvalidatedQueryScope {
                kind: InvalidatedQueryKind::ResourceDataUrls,
                table: None,
                source: None,
                entity: None,
                resource: Some(resource.clone()),
            },
        );
    }
    scopes
}

fn push_source_option_query_scope(scopes: &mut Vec<InvalidatedQueryScope>, source: String) {
    push_query_scope(
        scopes,
        InvalidatedQueryScope {
            kind: InvalidatedQueryKind::CsvSourceOptions,
            table: None,
            source: Some(source),
            entity: None,
            resource: None,
        },
    );
}

fn push_entity_query_scope(
    scopes: &mut Vec<InvalidatedQueryScope>,
    kind: InvalidatedQueryKind,
    entity: InvalidatedEntityRef,
) {
    push_query_scope(
        scopes,
        InvalidatedQueryScope {
            kind,
            table: None,
            source: None,
            entity: Some(entity),
            resource: None,
        },
    );
}

fn push_query_scope(scopes: &mut Vec<InvalidatedQueryScope>, scope: InvalidatedQueryScope) {
    if !scopes.contains(&scope) {
        scopes.push(scope);
    }
}

fn affected_csv_tables(path: &str) -> Vec<CsvTableKey> {
    table_definitions::csv_table_definitions()
        .iter()
        .filter_map(|definition| {
            path_affects_target(path, definition.rel_path).then_some(definition.key)
        })
        .collect()
}

fn path_affects_target(path: &str, target: &str) -> bool {
    path.is_empty() || path == target || target.starts_with(&format!("{path}/"))
}

fn refresh_table_entity_summary(session: &mut ProjectSession, table_key: &str) -> AppResult<()> {
    let Some(definition) = table_definitions::csv_table_definition_by_key(table_key) else {
        return Ok(());
    };
    let count = if let Some(count) = table_definitions::csv_table_entity_summary(
        definition.key,
        &session.manifest.entity_summaries,
    ) {
        count
    } else {
        let mod_root = Path::new(&session.manifest.mod_root);
        let rel_path = session
            .csv_tables
            .get(table_key)
            .map(|table| table.path.as_str());
        if let Some(rel_path) = rel_path {
            super::super::session::count_valid_csv_entities(mod_root, definition.key, rel_path)?
        } else {
            0
        }
    };
    session
        .manifest
        .table_entity_summaries
        .insert(definition.key, count);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom, models::CsvTableKey,
        services::project::performance::PerformanceTrace,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn invalidating_variant_path_refreshes_session_variant_index() {
        let root = temp_dir("invalidate_variant_index");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/demo.variant"),
            r#"{"variantId":"old","hullId":"hull"}"#,
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/demo.variant"),
            r#"{"variantId":"new","hullId":"hull"}"#,
        )
        .unwrap();

        invalidate_session_path(&mut session, "data/variants/demo.variant").unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(session
            .variant_files
            .iter()
            .any(|variant| variant.variant_id == "new"));
        assert!(!session
            .variant_files
            .iter()
            .any(|variant| variant.variant_id == "old"));
        assert_eq!(session.manifest.entity_summaries.variants, 1);
    }

    #[test]
    fn invalidating_faction_path_refreshes_tags_and_loaded_csv_rows() {
        let root = temp_dir("invalidate_faction_tags");
        fs::create_dir_all(root.join("data/world/factions")).unwrap();
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/demo.faction"),
            r#"{"id":"demo","displayName":"Demo","knownShips":{"tags":["demo_old_bp"]}}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,tags\r\nship,demo_old_bp\r\n",
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();
        super::super::ensure_registered_table_rows(&mut session, CsvTableKey::Ships).unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/demo.faction"),
            r#"{"id":"demo","displayName":"Demo","knownShips":{"tags":["demo_new_bp"]}}"#,
        )
        .unwrap();

        invalidate_session_path(&mut session, "data/world/factions/demo.faction").unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(session.tag_map.contains_key("demo_new_bp"));
        assert!(!session.tag_map.contains_key("demo_old_bp"));
        assert!(session
            .csv_tables
            .get(CsvTableKey::Ships.as_str())
            .and_then(|table| table.rows.as_ref())
            .is_none());
    }

    #[test]
    fn changed_path_classification_uses_project_relative_targets() {
        assert!(affected_csv_tables("data/hulls/ship_data.csv").contains(&CsvTableKey::Ships));
        assert!(affected_csv_tables("data/hulls").contains(&CsvTableKey::Ships));
        assert!(
            !affected_csv_tables("backup/data/hulls/ship_data.csv").contains(&CsvTableKey::Ships)
        );
        assert!(entity_spec_path_matches(
            EntityKind::Faction,
            "data/world/factions/demo.faction"
        ));
        assert!(!entity_spec_path_matches(
            EntityKind::Faction,
            "backup/data/world/factions/demo.faction"
        ));
        assert!(entity_spec_path_matches(EntityKind::Ship, "data/hulls"));
        assert!(entity_spec_path_matches(EntityKind::Skin, "data/hulls"));
        assert!(entity_spec_path_matches(
            EntityKind::Ship,
            "data/hulls/demo.ship"
        ));
        assert!(!entity_spec_path_matches(
            EntityKind::Ship,
            "data/hulls/demo.txt"
        ));
        assert!(!entity_spec_path_matches(
            EntityKind::Ship,
            "backup/data/hulls/demo.ship"
        ));
    }

    #[test]
    fn project_scoped_changed_path_rejects_external_absolute_paths() {
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "D:/mods/current/data/hulls/demo.ship"),
            Some("data/hulls/demo.ship".to_string())
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "data/hulls/demo.ship"),
            Some("data/hulls/demo.ship".to_string())
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "D:/mods/other/data/hulls/demo.ship"),
            None
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "data/hulls/../weapons/demo.wpn"),
            None
        );
        assert_eq!(
            project_scoped_changed_path(
                "D:/mods/current",
                "D:/mods/current/data/hulls/../weapons/demo.wpn"
            ),
            None
        );
    }

    #[test]
    fn invalidating_external_absolute_path_does_not_refresh_session_indexes() {
        let root = temp_dir("invalidate_external_current");
        let external = temp_dir("invalidate_external_other");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        fs::create_dir_all(external.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/current.ship"),
            r#"{"hullId":"current"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &external.join("data/hulls/external.ship"),
            r#"{"hullId":"external"}"#,
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();

        invalidate_session_path(
            &mut session,
            &external.join("data/hulls/external.ship").to_string_lossy(),
        )
        .unwrap();

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(external);
        assert_eq!(session.manifest.entity_summaries.ships, 1);
        assert!(session.ship_files.contains_key("current"));
        assert!(!session.ship_files.contains_key("external"));
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

    fn entity_spec_path_matches(kind: EntityKind, path: &str) -> bool {
        entity_definitions::entity_definitions()
            .iter()
            .find(|definition| definition.kind == kind)
            .and_then(|definition| definition.spec)
            .is_some_and(|spec| spec.path_matches(path))
    }
}
