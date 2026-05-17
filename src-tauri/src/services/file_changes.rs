use crate::{
    errors::{AppError, AppResult},
    filesystem::{read_utf8_no_bom, write_utf8_no_bom},
    models::{
        ApplyFileChangeSetPayload, FileChangeKind, FileChangeRecord, FileSnapshot,
        SaveModFilesWithHistoryPayload, SaveTextFileWithHistoryPayload,
    },
};
use base64::{engine::general_purpose, Engine as _};
use std::{
    fs,
    path::{Component, Path},
};
use walkdir::WalkDir;

pub fn save_text_file_with_history(
    payload: SaveTextFileWithHistoryPayload,
) -> AppResult<Vec<FileChangeRecord>> {
    let path = Path::new(&payload.path);
    let change = build_text_change(path, Some(payload.text))?;
    apply_changes(std::slice::from_ref(&change), ChangeDirection::Redo)?;
    Ok(vec![change])
}

pub fn save_mod_files_with_history(
    payload: SaveModFilesWithHistoryPayload,
) -> AppResult<Vec<FileChangeRecord>> {
    let mut builder = FileChangeSetBuilder::new(Path::new(&payload.mod_root));
    for file in payload.files {
        builder.text_file(&file.rel_path, file.after_text)?;
    }
    builder.apply()
}

pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> AppResult<()> {
    let direction = ChangeDirection::parse(&payload.direction)?;
    apply_changes(&payload.changes, direction)
}

fn validate_relative_path(path: &str) -> AppResult<&Path> {
    let rel = Path::new(path);
    if rel.is_absolute()
        || rel
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return Err(AppError::message(format!(
            "invalid relative file path: {path}"
        )));
    }
    Ok(rel)
}

pub fn build_text_change(path: &Path, after_text: Option<String>) -> AppResult<FileChangeRecord> {
    let before_exists = path.exists();
    let before_text = if before_exists {
        Some(read_utf8_no_bom(path)?)
    } else {
        None
    };
    Ok(FileChangeRecord {
        kind: FileChangeKind::File,
        path: path.to_string_lossy().to_string(),
        before_exists,
        before_text,
        before_files: vec![],
        after_exists: after_text.is_some(),
        after_text,
        after_files: vec![],
    })
}

pub fn build_directory_delete_change(path: &Path) -> AppResult<FileChangeRecord> {
    let before_exists = path.exists();
    let before_files = if before_exists {
        snapshot_directory(path)?
    } else {
        vec![]
    };
    Ok(FileChangeRecord {
        kind: FileChangeKind::Directory,
        path: path.to_string_lossy().to_string(),
        before_exists,
        before_text: None,
        before_files,
        after_exists: false,
        after_text: None,
        after_files: vec![],
    })
}

pub struct FileChangeSetBuilder {
    root: std::path::PathBuf,
    changes: Vec<FileChangeRecord>,
}

impl FileChangeSetBuilder {
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
            changes: Vec::new(),
        }
    }

    pub fn text_file(
        &mut self,
        rel_path: impl AsRef<str>,
        after_text: Option<String>,
    ) -> AppResult<&mut Self> {
        let rel_path = validate_relative_path(rel_path.as_ref())?;
        self.changes
            .push(build_text_change(&self.root.join(rel_path), after_text)?);
        Ok(self)
    }

    pub fn absolute_text_file(
        &mut self,
        path: &Path,
        after_text: Option<String>,
    ) -> AppResult<&mut Self> {
        self.changes.push(build_text_change(path, after_text)?);
        Ok(self)
    }

    pub fn delete_directory(&mut self, rel_path: impl AsRef<str>) -> AppResult<&mut Self> {
        let rel_path = validate_relative_path(rel_path.as_ref())?;
        self.changes
            .push(build_directory_delete_change(&self.root.join(rel_path))?);
        Ok(self)
    }

    pub fn apply(self) -> AppResult<Vec<FileChangeRecord>> {
        apply_changes(&self.changes, ChangeDirection::Redo)?;
        Ok(self.changes)
    }
}

#[derive(Clone, Copy)]
enum ChangeDirection {
    Undo,
    Redo,
}

impl ChangeDirection {
    fn parse(value: &str) -> AppResult<Self> {
        match value {
            "undo" => Ok(Self::Undo),
            "redo" => Ok(Self::Redo),
            other => Err(AppError::message(format!(
                "unknown changeset direction: {other}"
            ))),
        }
    }
}

fn apply_changes(changes: &[FileChangeRecord], direction: ChangeDirection) -> AppResult<()> {
    let mut rollback = Vec::new();
    for change in changes {
        let path = Path::new(&change.path);
        rollback.push(build_current_state(path)?);
        if let Err(error) = apply_one(change, direction) {
            rollback_changes(&rollback);
            return Err(error);
        }
    }
    Ok(())
}

fn apply_one(change: &FileChangeRecord, direction: ChangeDirection) -> AppResult<()> {
    match change.kind {
        FileChangeKind::File => apply_file_change(change, direction),
        FileChangeKind::Directory => apply_directory_change(change, direction),
    }
}

fn apply_file_change(change: &FileChangeRecord, direction: ChangeDirection) -> AppResult<()> {
    let (exists, text) = match direction {
        ChangeDirection::Undo => (change.before_exists, change.before_text.as_deref()),
        ChangeDirection::Redo => (change.after_exists, change.after_text.as_deref()),
    };
    let path = Path::new(&change.path);
    if exists {
        let text = text.ok_or_else(|| AppError::message("changeset missing file text"))?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        write_utf8_no_bom(path, text)?;
    } else if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn apply_directory_change(change: &FileChangeRecord, direction: ChangeDirection) -> AppResult<()> {
    let (exists, files) = match direction {
        ChangeDirection::Undo => (change.before_exists, &change.before_files),
        ChangeDirection::Redo => (change.after_exists, &change.after_files),
    };
    let path = Path::new(&change.path);
    if path.exists() {
        fs::remove_dir_all(path)?;
    }
    if exists {
        fs::create_dir_all(path)?;
        for file in files {
            let rel = validate_relative_path(&file.rel_path)?;
            let target = path.join(rel);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            restore_snapshot_file(&target, file)?;
        }
    }
    Ok(())
}

fn build_current_state(path: &Path) -> AppResult<FileChangeRecord> {
    if path.is_dir() {
        return Ok(FileChangeRecord {
            kind: FileChangeKind::Directory,
            path: path.to_string_lossy().to_string(),
            before_exists: true,
            before_text: None,
            before_files: snapshot_directory(path)?,
            after_exists: true,
            after_text: None,
            after_files: snapshot_directory(path)?,
        });
    }
    let exists = path.exists();
    let text = if exists {
        Some(read_utf8_no_bom(path)?)
    } else {
        None
    };
    Ok(FileChangeRecord {
        kind: FileChangeKind::File,
        path: path.to_string_lossy().to_string(),
        before_exists: exists,
        before_text: text.clone(),
        before_files: vec![],
        after_exists: exists,
        after_text: text,
        after_files: vec![],
    })
}

fn rollback_changes(changes: &[FileChangeRecord]) {
    for change in changes.iter().rev() {
        let _ = apply_one(change, ChangeDirection::Redo);
    }
}

fn snapshot_directory(path: &Path) -> AppResult<Vec<FileSnapshot>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(path).into_iter() {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("遍历目录失败 ({})", path.display()),
                AppError::message(error.to_string()),
            )
        })?;
        if !entry.file_type().is_file() {
            continue;
        }
        let rel_path = entry
            .path()
            .strip_prefix(path)
            .map_err(|error| AppError::message(error.to_string()))?
            .to_string_lossy()
            .replace('\\', "/");
        files.push(snapshot_file(entry.path(), rel_path)?);
    }
    files.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    Ok(files)
}

fn snapshot_file(path: &Path, rel_path: String) -> AppResult<FileSnapshot> {
    match read_utf8_no_bom(path) {
        Ok(text) => Ok(FileSnapshot {
            rel_path,
            text: Some(text),
            data_base64: None,
        }),
        Err(_) => {
            let bytes = fs::read(path)?;
            Ok(FileSnapshot {
                rel_path,
                text: None,
                data_base64: Some(general_purpose::STANDARD.encode(bytes)),
            })
        }
    }
}

fn restore_snapshot_file(path: &Path, file: &FileSnapshot) -> AppResult<()> {
    if let Some(text) = &file.text {
        write_utf8_no_bom(path, text)?;
        return Ok(());
    }
    let data = file
        .data_base64
        .as_deref()
        .ok_or_else(|| AppError::message("directory snapshot missing file data"))?;
    let bytes = general_purpose::STANDARD.decode(data)?;
    fs::write(path, bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{filesystem::write_utf8_no_bom, models::AssociatedFileChangePayload};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_mod_files_with_history_writes_multiple_files_in_one_changeset() {
        let root = temp_dir("save_mod_files_changeset");
        write_utf8_no_bom(&root.join("mod_info.json"), "{\"id\":\"old\"}").unwrap();

        let changes = save_mod_files_with_history(SaveModFilesWithHistoryPayload {
            mod_root: root.to_string_lossy().to_string(),
            files: vec![
                AssociatedFileChangePayload {
                    rel_path: "mod_info.json".to_string(),
                    after_text: Some("{\"id\":\"new\"}".to_string()),
                },
                AssociatedFileChangePayload {
                    rel_path: "data/missions/demo/mission_text.txt".to_string(),
                    after_text: Some("text".to_string()),
                },
            ],
        })
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
    fn save_mod_files_with_history_rejects_path_traversal() {
        let root = temp_dir("save_mod_files_rejects_path");

        let result = save_mod_files_with_history(SaveModFilesWithHistoryPayload {
            mod_root: root.to_string_lossy().to_string(),
            files: vec![AssociatedFileChangePayload {
                rel_path: "../outside.txt".to_string(),
                after_text: Some("bad".to_string()),
            }],
        });

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
