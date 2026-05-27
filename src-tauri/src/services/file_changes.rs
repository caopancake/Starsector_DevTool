use crate::{
    errors::AppResult,
    io::{
        apply_changes, build_text_change, read_json_file, read_utf8_no_bom, ChangeDirection,
        FileChangeSetBuilder,
    },
    models::{
        AssociatedFileChange, EditableFileData, FileChangeRecord, FileChangeReplayDirection,
        WriteResult,
    },
};
use serde_json::Value;
use std::path::Path;

pub fn save_text_file(path: &str, text: String) -> AppResult<WriteResult> {
    let path = Path::new(path);
    let change = build_text_change(path, Some(text))?;
    apply_changes(std::slice::from_ref(&change), ChangeDirection::Redo)?;
    Ok(write_result(vec![change]))
}

pub fn load_editable_file(path: String) -> AppResult<EditableFileData> {
    let target = Path::new(&path);
    read_utf8_no_bom(target).map(|text| EditableFileData {
        path: target.display().to_string(),
        text,
    })
}

pub fn load_json_spec_file(path: String) -> AppResult<Value> {
    read_json_file(Path::new(&path))
}

pub fn save_mod_files(mod_root: &str, files: Vec<AssociatedFileChange>) -> AppResult<WriteResult> {
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    for file in files {
        builder.file(&file.rel_path, file.after_text, file.after_data_base64)?;
    }
    builder.apply().map(write_result)
}

pub fn apply_file_change_set(
    direction: FileChangeReplayDirection,
    changes: Vec<FileChangeRecord>,
) -> AppResult<WriteResult> {
    apply_changes(&changes, change_direction(direction))?;
    Ok(write_result(changes))
}

fn change_direction(direction: FileChangeReplayDirection) -> ChangeDirection {
    match direction {
        FileChangeReplayDirection::Undo => ChangeDirection::Undo,
        FileChangeReplayDirection::Redo => ChangeDirection::Redo,
    }
}

fn write_result(changes: Vec<FileChangeRecord>) -> WriteResult {
    let invalidated_paths = changes.iter().map(|change| change.path.clone()).collect();
    WriteResult {
        changes,
        invalidated_paths,
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{build_directory_delete_change, build_file_change, write_utf8_no_bom},
        models::{AssociatedFileChange, FileChangeReplayDirection},
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

        let result = save_mod_files(
            &root.to_string_lossy(),
            vec![
                AssociatedFileChange {
                    rel_path: "mod_info.json".to_string(),
                    after_text: Some("{\"id\":\"new\"}".to_string()),
                    after_data_base64: None,
                    previous_rel_path: None,
                },
                AssociatedFileChange {
                    rel_path: "data/missions/demo/mission_text.txt".to_string(),
                    after_text: Some("text".to_string()),
                    after_data_base64: None,
                    previous_rel_path: None,
                },
            ],
        )
        .unwrap();

        let mod_info = read_utf8_no_bom(&root.join("mod_info.json")).unwrap();
        let mission_text =
            read_utf8_no_bom(&root.join("data/missions/demo/mission_text.txt")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert_eq!(result.invalidated_paths.len(), 2);
        assert_eq!(mod_info, "{\"id\":\"new\"}");
        assert_eq!(mission_text, "text");
    }

    #[test]
    fn save_mod_files_rejects_path_traversal() {
        let root = temp_dir("save_mod_files_rejects_path");

        let result = save_mod_files(
            &root.to_string_lossy(),
            vec![AssociatedFileChange {
                rel_path: "../outside.txt".to_string(),
                after_text: Some("bad".to_string()),
                after_data_base64: None,
                previous_rel_path: None,
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
        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change.clone()]).unwrap();
        assert!(!dir.exists());

        apply_file_change_set(FileChangeReplayDirection::Undo, vec![change]).unwrap();

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

        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change.clone()]).unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(FileChangeReplayDirection::Undo, vec![change.clone()]).unwrap();
        assert!(!path.exists());

        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change]).unwrap();
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

        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change.clone()]).unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(FileChangeReplayDirection::Undo, vec![change.clone()]).unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);

        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change]).unwrap();
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

        apply_file_change_set(FileChangeReplayDirection::Redo, vec![change.clone()]).unwrap();
        assert!(!path.exists());

        apply_file_change_set(FileChangeReplayDirection::Undo, vec![change]).unwrap();
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
