use super::super::{
    cache::{
        ensure_session_table_rows, load_core_csv_table, load_core_source_data, session_for_mut,
        sessions,
    },
    model::{is_comment_row, SourceOptionsContext},
};
use super::resources_shared::source_option_resource_ref;
use crate::{
    errors::{AppError, AppResult},
    models::{CsvSourceOptionsPayload, SourceOptionGroup},
};
use std::collections::BTreeSet;

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
    let mut seen = BTreeSet::new();
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
            sprite: None,
            resource_ref: None,
            origin: origin.to_string(),
        })
        .collect()
}

fn source_options_from_rows(
    origin: &str,
    rows: &[super::super::model::SessionCsvRow],
    column: &str,
    context: SourceOptionsContext<'_>,
) -> Vec<crate::models::SourceOption> {
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
                origin,
                context.table,
                value,
                &row.row,
                context.core.as_ref(),
                context.session,
            );
            crate::models::SourceOption {
                label,
                value: value.to_string(),
                sprite: None,
                resource_ref,
                origin: origin.to_string(),
            }
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
    use super::*;
    use crate::{
        io::write_utf8_no_bom,
        services::project::session::{
            close_project_session_for_command, open_project_session_traced,
        },
    };
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
        let groups = query_csv_source_options_for_command(CsvSourceOptionsPayload {
            session_id: manifest.session_id.clone(),
            source: "csv:ships.id".to_string(),
            search: None,
            limit: None,
            current_values: Vec::new(),
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
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
