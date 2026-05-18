use crate::{
    errors::{AppError, AppResult},
    models::{csv_path_for, AssociatedFileChangePayload, FileChangeRecord},
    parsers::render_csv_text,
    services::file_changes::{apply_file_change_set, build_file_change, build_text_change},
};
use serde_json::{Map, Value};
use std::path::Path;

pub fn save_csv(
    mod_root: &str,
    table: &str,
    header: &[String],
    rows: &[Map<String, Value>],
    associated_files: Vec<AssociatedFileChangePayload>,
) -> AppResult<Vec<FileChangeRecord>> {
    let rel =
        csv_path_for(table).ok_or_else(|| AppError::message(format!("unknown table: {table}")))?;
    let target = Path::new(mod_root).join(rel);
    let csv_text = render_csv_text(header, rows)?;
    let mut changes = vec![build_text_change(&target, Some(csv_text))?];
    for file in associated_files {
        let rel_path = Path::new(&file.rel_path);
        if rel_path.is_absolute()
            || rel_path
                .components()
                .any(|part| matches!(part, std::path::Component::ParentDir))
        {
            return Err(AppError::message(format!(
                "invalid associated file path: {}",
                file.rel_path
            )));
        }
        changes.push(build_file_change(
            &Path::new(mod_root).join(rel_path),
            file.after_text,
            file.after_data_base64,
        )?);
    }
    apply_file_change_set(crate::models::ApplyFileChangeSetPayload {
        direction: "redo".to_string(),
        changes: changes.clone(),
    })?;
    Ok(changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{io::read_utf8_no_bom, io::write_utf8_no_bom};
    use serde_json::{Map, Value};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_csv_can_create_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_create_assoc");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(&root.join("data/hulls/ship_data.csv"), "id,name\r\n").unwrap();
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("new_ship".to_string()));
        row.insert("name".to_string(), Value::String("New Ship".to_string()));

        let changes = save_csv(
            &root.to_string_lossy(),
            "ships",
            &["id".to_string(), "name".to_string()],
            &[row],
            vec![crate::models::AssociatedFileChangePayload {
                rel_path: "data/hulls/new_ship.ship".to_string(),
                after_text: Some("{\n  \"hullId\": \"new_ship\"\n}".to_string()),
                after_data_base64: None,
            }],
        )
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();
        let spec = read_utf8_no_bom(&root.join("data/hulls/new_ship.ship")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(changes.len(), 2);
        assert!(csv.contains("new_ship,New Ship"));
        assert!(spec.contains("\"hullId\": \"new_ship\""));
    }

    #[test]
    fn save_csv_can_delete_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_delete_assoc");
        fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nold_weapon,Old Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/old_weapon.wpn"),
            "{\n  \"id\": \"old_weapon\"\n}",
        )
        .unwrap();

        let changes = save_csv(
            &root.to_string_lossy(),
            "weapons",
            &["id".to_string(), "name".to_string()],
            &[],
            vec![crate::models::AssociatedFileChangePayload {
                rel_path: "data/weapons/old_weapon.wpn".to_string(),
                after_text: None,
                after_data_base64: None,
            }],
        )
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();
        let spec_exists = root.join("data/weapons/old_weapon.wpn").exists();

        let _ = fs::remove_dir_all(root);
        assert_eq!(changes.len(), 2);
        assert!(!csv.contains("old_weapon,Old Weapon"));
        assert!(!spec_exists);
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
