use crate::{
    errors::AppResult,
    io::{
        apply_changes, build_text_change, read_utf8_no_bom, ChangeDirection, FileChangeSetBuilder,
    },
    models::{
        ApplyFileChangeSetPayload, AssociatedFileChangePayload, EditableFileData, FileChangeRecord,
    },
};
use std::path::Path;

pub fn save_text_file(path: &str, text: String) -> AppResult<Vec<FileChangeRecord>> {
    let path = Path::new(path);
    let change = build_text_change(path, Some(text))?;
    apply_changes(std::slice::from_ref(&change), ChangeDirection::Redo)?;
    Ok(vec![change])
}

pub fn load_editable_file(path: String) -> AppResult<EditableFileData> {
    let target = Path::new(&path);
    read_utf8_no_bom(target).map(|text| EditableFileData {
        path: target.display().to_string(),
        text,
    })
}

pub fn save_mod_files(
    mod_root: &str,
    files: Vec<AssociatedFileChangePayload>,
) -> AppResult<Vec<FileChangeRecord>> {
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    for file in files {
        builder.file(&file.rel_path, file.after_text, file.after_data_base64)?;
    }
    builder.apply()
}

pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> AppResult<()> {
    let direction = ChangeDirection::parse(&payload.direction)?;
    apply_changes(&payload.changes, direction)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{build_directory_delete_change, build_file_change, write_utf8_no_bom},
        models::AssociatedFileChangePayload,
    };
    use base64::{engine::general_purpose, Engine as _};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_mod_files_writes_multiple_files_in_one_changeset() {
        let root = temp_dir("save_mod_files_changeset");
        write_utf8_no_bom(&root.join("mod_info.json"), "{\"id\":\"old\"}").unwrap();

        let changes = save_mod_files(
            &root.to_string_lossy(),
            vec![
                AssociatedFileChangePayload {
                    rel_path: "mod_info.json".to_string(),
                    after_text: Some("{\"id\":\"new\"}".to_string()),
                    after_data_base64: None,
                },
                AssociatedFileChangePayload {
                    rel_path: "data/missions/demo/mission_text.txt".to_string(),
                    after_text: Some("text".to_string()),
                    after_data_base64: None,
                },
            ],
        )
        .unwrap();

        let mod_info = read_utf8_no_bom(&root.join("mod_info.json")).unwrap();
        let mission_text =
            read_utf8_no_bom(&root.join("data/missions/demo/mission_text.txt")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(changes.len(), 2);
        assert_eq!(mod_info, "{\"id\":\"new\"}");
        assert_eq!(mission_text, "text");
    }

    #[test]
    fn save_mod_files_rejects_path_traversal() {
        let root = temp_dir("save_mod_files_rejects_path");

        let result = save_mod_files(
            &root.to_string_lossy(),
            vec![AssociatedFileChangePayload {
                rel_path: "../outside.txt".to_string(),
                after_text: Some("bad".to_string()),
                after_data_base64: None,
            }],
        );

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
    }

    #[test]
    fn directory_delete_change_roundtrips_text_snapshot() {
        let root = temp_dir("directory_delete_roundtrip");
        let dir = root.join("data/missions/demo");
        fs::create_dir_all(dir.join("nested")).unwrap();
        write_utf8_no_bom(&dir.join("descriptor.json"), "{\"title\":\"Demo\"}").unwrap();
        write_utf8_no_bom(&dir.join("nested/readme.txt"), "details").unwrap();
        fs::write(dir.join("icon.bin"), [0, 159, 146, 150]).unwrap();

        let change = build_directory_delete_change(&dir).unwrap();
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert!(!dir.exists());

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: vec![change],
        })
        .unwrap();

        let descriptor = read_utf8_no_bom(&dir.join("descriptor.json")).unwrap();
        let nested = read_utf8_no_bom(&dir.join("nested/readme.txt")).unwrap();
        let icon = fs::read(dir.join("icon.bin")).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(descriptor, "{\"title\":\"Demo\"}");
        assert_eq!(nested, "details");
        assert_eq!(icon, vec![0, 159, 146, 150]);
    }

    #[test]
    fn binary_file_change_can_create_undo_and_redo() {
        let root = temp_dir("binary_file_create_history");
        let path = root.join("graphics/ships/demo.png");
        let change = build_file_change(
            &path,
            None,
            Some(general_purpose::STANDARD.encode([1, 2, 3])),
        )
        .unwrap();

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert!(!path.exists());

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change],
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn binary_file_change_can_overwrite_and_restore() {
        let root = temp_dir("binary_file_overwrite_history");
        let path = root.join("graphics/ships/demo.png");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, [9, 8, 7]).unwrap();
        let change = build_file_change(
            &path,
            None,
            Some(general_purpose::STANDARD.encode([1, 2, 3])),
        )
        .unwrap();

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change],
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn binary_file_change_can_delete_and_restore() {
        let root = temp_dir("binary_file_delete_history");
        let path = root.join("graphics/ships/demo.png");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, [9, 8, 7]).unwrap();
        let change = build_file_change(&path, None, None).unwrap();

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: vec![change.clone()],
        })
        .unwrap();
        assert!(!path.exists());

        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: vec![change],
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![9, 8, 7]);
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
