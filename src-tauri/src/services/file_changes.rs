use crate::{
    errors::{AppError, AppResult},
    io::{
        apply_changes, build_text_change, invalidated_paths_for_changes, normalized_path_key,
        path_uses_parent_dir, read_utf8_no_bom, validate_relative_path_without_parent,
        ChangeDirection, FileChangeSetBuilder,
    },
    models::{
        AssociatedFileChange, EditableFileData, FileChangeRecord, FileChangeReplayDirection,
        WriteResult,
    },
};
use std::path::Path;

pub fn save_text_file(mod_root: &str, path: &str, text: String) -> AppResult<WriteResult> {
    let path = Path::new(path);
    validate_mod_root_path(mod_root, path)?;
    let change = build_text_change(path, Some(text))?;
    apply_changes(std::slice::from_ref(&change), ChangeDirection::Redo)?;
    Ok(write_result(vec![change]))
}

pub fn load_editable_file(mod_root: &str, path: String) -> AppResult<EditableFileData> {
    let target = Path::new(&path);
    validate_mod_root_path(mod_root, target)?;
    read_utf8_no_bom(target).map(|text| EditableFileData {
        path: target.display().to_string(),
        text,
    })
}

pub fn save_mod_files(mod_root: &str, files: Vec<AssociatedFileChange>) -> AppResult<WriteResult> {
    let mut builder = FileChangeSetBuilder::new(Path::new(mod_root));
    for file in files {
        builder.file(&file.rel_path, file.after_text, file.after_data_base64)?;
    }
    builder.apply().map(write_result)
}

pub fn apply_file_change_set(
    mod_root: &str,
    direction: FileChangeReplayDirection,
    changes: Vec<FileChangeRecord>,
) -> AppResult<WriteResult> {
    validate_changeset_paths(mod_root, &changes)?;
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
    let invalidated_paths = invalidated_paths_for_changes(&changes);
    WriteResult {
        changes,
        invalidated_paths,
        key_map: Vec::new(),
        refreshed_entity: None,
        warnings: Vec::new(),
    }
}

fn validate_changeset_paths(mod_root: &str, changes: &[FileChangeRecord]) -> AppResult<()> {
    for change in changes {
        validate_mod_root_path(mod_root, Path::new(&change.path))?;
        for file in change.before_files.iter().chain(change.after_files.iter()) {
            validate_snapshot_relative_path(&file.rel_path)?;
        }
    }
    Ok(())
}

fn validate_snapshot_relative_path(path: &str) -> AppResult<()> {
    validate_relative_path_without_parent(Path::new(path), "file snapshot").map(|_| ())
}

fn validate_mod_root_path(mod_root: &str, path: &Path) -> AppResult<()> {
    let root = Path::new(mod_root);
    if !path.is_absolute()
        || path_uses_parent_dir(path)
        || path_uses_parent_dir(root)
        || !path_belongs_to_root(path, root)
    {
        return Err(AppError::message(format!(
            "file path is outside mod root: {}",
            path.display()
        )));
    }
    Ok(())
}

fn path_belongs_to_root(path: &Path, root: &Path) -> bool {
    let path = normalized_path_key(path);
    let root = normalized_path_key(root);
    path == root || path.starts_with(&format!("{root}/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{build_directory_delete_change, build_file_change, write_utf8_no_bom},
        models::{AssociatedFileChange, FileChangeKind, FileChangeReplayDirection, FileSnapshot},
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
    fn save_mod_files_rejects_non_file_relative_paths() {
        let root = temp_dir("save_mod_files_rejects_non_file_relative_paths");

        for rel_path in ["", ".", "data/./demo.txt", "C:outside.txt"] {
            let result = save_mod_files(
                &root.to_string_lossy(),
                vec![AssociatedFileChange {
                    rel_path: rel_path.to_string(),
                    after_text: Some("bad".to_string()),
                    after_data_base64: None,
                    previous_rel_path: None,
                }],
            );

            assert!(result.is_err(), "{rel_path}");
        }

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn save_text_file_rejects_path_outside_mod_root() {
        let root = temp_dir("save_text_file_rejects_external_root");
        let outside = temp_dir("save_text_file_rejects_external_outside");

        let result = save_text_file(
            &root.to_string_lossy(),
            &outside.join("outside.txt").to_string_lossy(),
            "bad".to_string(),
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn save_text_file_rejects_parent_dir_escape() {
        let root = temp_dir("save_text_file_rejects_parent_dir_escape");
        let escaped = root.join("..").join("outside.txt");

        let result = save_text_file(
            &root.to_string_lossy(),
            &escaped.to_string_lossy(),
            "bad".to_string(),
        );

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
    }

    #[test]
    fn load_editable_file_rejects_path_outside_mod_root() {
        let root = temp_dir("load_editable_file_rejects_external_root");
        let outside = temp_dir("load_editable_file_rejects_external_outside");
        let outside_file = outside.join("outside.txt");
        write_utf8_no_bom(&outside_file, "bad").unwrap();

        let result = load_editable_file(
            &root.to_string_lossy(),
            outside_file.to_string_lossy().to_string(),
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn load_editable_file_rejects_parent_dir_escape() {
        let root = temp_dir("load_editable_file_rejects_parent_dir_escape");
        let escaped = root.join("..").join("outside.txt");

        let result = load_editable_file(
            &root.to_string_lossy(),
            escaped.to_string_lossy().to_string(),
        );

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
    }

    #[test]
    fn write_result_expands_directory_change_invalidated_paths() {
        let root = temp_dir("directory_invalidated_paths");
        let dir = root.join("data/variants/nested");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("demo.variant"), "{}").unwrap();

        let change = build_directory_delete_change(&dir).unwrap();
        let result = write_result(vec![change]);

        let _ = fs::remove_dir_all(root);
        assert!(result
            .invalidated_paths
            .iter()
            .any(|path| normalized_path_key(Path::new(path)) == normalized_path_key(&dir)));
        assert!(result.invalidated_paths.iter().any(|path| {
            normalized_path_key(Path::new(path)) == normalized_path_key(&dir.join("demo.variant"))
        }));
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
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change.clone()],
        )
        .unwrap();
        assert!(!dir.exists());

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            vec![change],
        )
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

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change.clone()],
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            vec![change.clone()],
        )
        .unwrap();
        assert!(!path.exists());

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change],
        )
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

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change.clone()],
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            vec![change.clone()],
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change],
        )
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

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change.clone()],
        )
        .unwrap();
        assert!(!path.exists());

        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            vec![change],
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![9, 8, 7]);
    }

    #[test]
    fn replay_rejects_changeset_path_outside_mod_root() {
        let root = temp_dir("changeset_rejects_external_path");
        let outside = temp_dir("changeset_rejects_external_outside");
        let change =
            build_file_change(&outside.join("outside.txt"), Some("bad".to_string()), None).unwrap();

        let result = apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change],
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn replay_rejects_parent_dir_escape() {
        let root = temp_dir("changeset_rejects_parent_dir_escape");
        let change = build_file_change(
            &root.join("..").join("outside.txt"),
            Some("bad".to_string()),
            None,
        )
        .unwrap();

        let result = apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change],
        );

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
    }

    #[test]
    fn replay_rejects_directory_snapshot_parent_dir_before_apply() {
        let root = temp_dir("changeset_rejects_snapshot_parent_dir");
        let dir = root.join("data/missions/demo");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(&dir.join("mission_text.txt"), "keep").unwrap();
        let change = FileChangeRecord {
            kind: FileChangeKind::Directory,
            path: dir.to_string_lossy().to_string(),
            before_exists: true,
            before_text: None,
            before_data_base64: None,
            before_files: vec![],
            after_exists: true,
            after_text: None,
            after_data_base64: None,
            after_files: vec![FileSnapshot {
                rel_path: "../outside.txt".to_string(),
                text: Some("bad".to_string()),
                data_base64: None,
            }],
        };

        let result = apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            vec![change],
        );
        let text = read_utf8_no_bom(&dir.join("mission_text.txt")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert_eq!(text, "keep");
    }

    #[test]
    fn replay_rejects_invalid_directory_snapshot_relative_paths_before_apply() {
        let root = temp_dir("changeset_rejects_invalid_snapshot_rel_path");
        let dir = root.join("data/missions/demo");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(&dir.join("mission_text.txt"), "keep").unwrap();

        for rel_path in ["", ".", "nested/./bad.txt", "C:outside.txt"] {
            let change = FileChangeRecord {
                kind: FileChangeKind::Directory,
                path: dir.to_string_lossy().to_string(),
                before_exists: true,
                before_text: None,
                before_data_base64: None,
                before_files: vec![],
                after_exists: true,
                after_text: None,
                after_data_base64: None,
                after_files: vec![FileSnapshot {
                    rel_path: rel_path.to_string(),
                    text: Some("bad".to_string()),
                    data_base64: None,
                }],
            };

            let result = apply_file_change_set(
                &root.to_string_lossy(),
                FileChangeReplayDirection::Redo,
                vec![change],
            );
            let text = read_utf8_no_bom(&dir.join("mission_text.txt")).unwrap();

            assert!(result.is_err(), "{rel_path}");
            assert_eq!(text, "keep", "{rel_path}");
        }

        let _ = fs::remove_dir_all(root);
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
