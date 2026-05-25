use super::super::{
    cache::{
        ensure_registered_session_table_rows, load_core_csv_table, load_core_source_data,
        loaded_csv_rows, session_for_mut, sessions,
    },
    model::{is_comment_row, SourceOptionsContext},
};
use super::resources_shared::source_option_resource_ref;
use crate::{
    errors::{AppError, AppResult},
    models::{CsvTableKey, ResourceSource, SourceOptionGroup, SourceOptionOrigin},
};
use std::collections::BTreeSet;

pub fn query_csv_source_options(
    session_id: &str,
    source: &str,
    current_values: &[String],
    search: Option<String>,
    limit: Option<usize>,
) -> AppResult<Vec<SourceOptionGroup>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    let (table, column) = parse_csv_source(source)?;
    let table_key = table.as_str();
    ensure_registered_session_table_rows(session, table)?;
    let csv = session
        .csv_tables
        .get(table_key)
        .ok_or_else(|| AppError::message(format!("unknown table: {table_key}")))?;
    ensure_source_column(&csv.header, table_key, column)?;
    let search = search.unwrap_or_default().to_lowercase();
    let limit = limit.unwrap_or(200);
    let mut seen = BTreeSet::new();
    let mut groups = Vec::new();
    let current_options = source_options_from_values(
        SourceOptionOrigin::Current,
        current_values,
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
    let rows = loaded_csv_rows(csv, table_key)?;
    let options = source_options_from_rows(
        ResourceSource::Mod,
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
    )?;
    if !options.is_empty() {
        groups.push(SourceOptionGroup {
            label: "当前 Mod".to_string(),
            options,
        });
    }
    if let Some(root) = session.manifest.starsector_root.as_ref() {
        let core_csv = load_core_csv_table(root, table)?;
        if let Some(core_csv) = core_csv {
            ensure_source_column(&core_csv.header, table_key, column)?;
            let core_rows = loaded_csv_rows(&core_csv, table_key)?;
            let core_data = load_core_source_data(root, table)?;
            let options = source_options_from_rows(
                ResourceSource::Core,
                core_rows,
                column,
                SourceOptionsContext {
                    core: Some(core_data),
                    limit,
                    search: &search,
                    seen: &mut seen,
                    session: Some(session),
                    table,
                },
            )?;
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

fn parse_csv_source(source: &str) -> AppResult<(CsvTableKey, &str)> {
    let trimmed = source.strip_prefix("csv:").unwrap_or(source);
    let (table, column) = trimmed
        .split_once('.')
        .ok_or_else(|| AppError::message(format!("invalid csv source: {source}")))?;
    let table = CsvTableKey::from_key(table)
        .ok_or_else(|| AppError::message(format!("unknown csv source table: {table}")))?;
    Ok((table, column))
}

fn ensure_source_column(header: &[String], table: &str, column: &str) -> AppResult<()> {
    if header.iter().any(|field| field == column) {
        return Ok(());
    }
    Err(AppError::message(format!(
        "csv source column does not exist: {table}.{column}"
    )))
}

fn source_options_from_values(
    origin: SourceOptionOrigin,
    values: &[String],
    search: &str,
    limit: usize,
    seen: &mut BTreeSet<String>,
) -> Vec<crate::models::SourceOption> {
    values
        .iter()
        .filter(|value| !value.trim().is_empty())
        .filter(|value| search.is_empty() || value.to_lowercase().contains(search))
        .filter(|value| seen.insert((*value).clone()))
        .take(limit)
        .map(|value| crate::models::SourceOption {
            label: value.clone(),
            value: value.clone(),
            resource_ref: None,
            origin,
        })
        .collect()
}

fn source_options_from_rows(
    resource_source: ResourceSource,
    rows: &[super::super::model::SessionCsvRow],
    column: &str,
    context: SourceOptionsContext<'_>,
) -> AppResult<Vec<crate::models::SourceOption>> {
    rows.iter()
        .filter(|row| !is_comment_row(&row.row))
        .filter_map(|row| {
            row.row
                .get(column)
                .and_then(serde_json::Value::as_str)
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
                resource_source,
                context.table,
                value,
                &row.row,
                context.core.as_ref(),
                context.session,
            )?;
            Ok(crate::models::SourceOption {
                label,
                value: value.to_string(),
                resource_ref,
                origin: resource_source.into(),
            })
        })
        .collect()
}

fn source_option_label(row: &super::super::model::SessionCsvRow, value: &str) -> String {
    let name = row
        .row
        .get("name")
        .or_else(|| row.row.get("hullName"))
        .or_else(|| row.row.get("displayName"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if name.trim().is_empty() || name == value {
        value.to_string()
    } else {
        format!("{name} ({value})")
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn source_options_return_resource_refs_without_data_urls() {
        let root = temp_dir("source_resource_refs");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
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

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let groups =
            query_csv_source_options(&manifest.session_id, "csv:ships.id", &[], None, None)
                .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let option = groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == "ship_a")
            .unwrap();
        assert_eq!(
            option
                .resource_ref
                .as_ref()
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/ship_a.png")
        );
    }

    #[test]
    fn core_wing_source_options_fail_when_skin_index_fails() {
        let root = temp_dir("core_wing_source_ref_skin_error");
        let mod_root = root.join("mods/demo");
        std::fs::create_dir_all(&mod_root).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/hulls/skins")).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/wing_data.csv"),
            "id,variant\r\ncore_wing,core_variant\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/variants/core_variant.variant"),
            r#"{"variantId":"core_variant","hullId":"skin_hull"}"#,
        )
        .unwrap();
        write_utf8_no_bom(&root.join("starsector-core/data/hulls/skins/bad.skin"), "{").unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let error = query_csv_source_options(
            &manifest.session_id,
            "csv:wings.id",
            &[],
            Some("core_wing".to_string()),
            None,
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("bad.skin"));
    }

    #[test]
    fn csv_source_parser_requires_registered_table_key() {
        let result = parse_csv_source("csv:missions.id");

        assert!(result.is_err());
    }

    #[test]
    fn csv_source_options_reject_missing_source_column() {
        let root = temp_dir("source_missing_column");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name\r\nship_a,Ship A\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_csv_source_options(
            &manifest.session_id,
            "csv:ships.missing",
            &["current".to_string()],
            None,
            None,
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("csv source column does not exist: ships.missing"));
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
