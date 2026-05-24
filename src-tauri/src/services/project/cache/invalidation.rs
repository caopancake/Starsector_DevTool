use crate::services::project::model::ProjectSession;

pub(crate) fn invalidate_session_path(session: &mut ProjectSession, changed_path: &str) {
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
