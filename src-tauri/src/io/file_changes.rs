use crate::{
    errors::{AppError, AppResult},
    io::{read_utf8_no_bom, validate_relative_path_without_parent, write_utf8_no_bom},
    models::{FileChangeKind, FileChangeRecord, FileSnapshot},
};
use base64::{engine::general_purpose, Engine as _};
use std::{fs, path::Path};
use walkdir::WalkDir;

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
        self.file(rel_path, after_text, None)
    }

    pub fn binary_file(
        &mut self,
        rel_path: impl AsRef<str>,
        after_data_base64: Option<String>,
    ) -> AppResult<&mut Self> {
        self.file(rel_path, None, after_data_base64)
    }

    pub fn file(
        &mut self,
        rel_path: impl AsRef<str>,
        after_text: Option<String>,
        after_data_base64: Option<String>,
    ) -> AppResult<&mut Self> {
        let rel_path = validate_relative_path(rel_path.as_ref())?;
        self.changes.push(build_file_change(
            &self.root.join(rel_path),
            after_text,
            after_data_base64,
        )?);
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

    pub fn copy_directory(
        &mut self,
        source_rel_path: impl AsRef<str>,
        target_rel_path: impl AsRef<str>,
    ) -> AppResult<&mut Self> {
        let source_rel_path = validate_relative_path(source_rel_path.as_ref())?;
        let target_rel_path = validate_relative_path(target_rel_path.as_ref())?;
        let source = self.root.join(source_rel_path);
        let target = self.root.join(target_rel_path);
        let after_files = if source.exists() {
            snapshot_directory(&source)?
        } else {
            vec![]
        };
        self.changes
            .push(build_directory_replace_change(&target, after_files)?);
        Ok(self)
    }

    pub fn apply(self) -> AppResult<Vec<FileChangeRecord>> {
        apply_changes(&self.changes, ChangeDirection::Redo)?;
        Ok(self.changes)
    }
}

#[derive(Clone, Copy)]
pub enum ChangeDirection {
    Undo,
    Redo,
}

pub fn build_text_change(path: &Path, after_text: Option<String>) -> AppResult<FileChangeRecord> {
    build_file_change(path, after_text, None)
}

pub fn build_file_change(
    path: &Path,
    after_text: Option<String>,
    after_data_base64: Option<String>,
) -> AppResult<FileChangeRecord> {
    let before_exists = path.exists();
    let (before_text, before_data_base64) = if before_exists {
        snapshot_file_content(path)?
    } else {
        (None, None)
    };
    if let Some(data) = &after_data_base64 {
        general_purpose::STANDARD.decode(data)?;
    }
    Ok(FileChangeRecord {
        kind: FileChangeKind::File,
        path: path.to_string_lossy().to_string(),
        before_exists,
        before_text,
        before_data_base64,
        before_files: vec![],
        after_exists: after_text.is_some() || after_data_base64.is_some(),
        after_text,
        after_data_base64,
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
        before_data_base64: None,
        before_files,
        after_exists: false,
        after_text: None,
        after_data_base64: None,
        after_files: vec![],
    })
}

pub fn build_directory_replace_change(
    path: &Path,
    after_files: Vec<FileSnapshot>,
) -> AppResult<FileChangeRecord> {
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
        before_data_base64: None,
        before_files,
        after_exists: true,
        after_text: None,
        after_data_base64: None,
        after_files,
    })
}

pub fn apply_changes(changes: &[FileChangeRecord], direction: ChangeDirection) -> AppResult<()> {
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

pub fn invalidated_paths_for_changes(changes: &[FileChangeRecord]) -> Vec<String> {
    let mut paths = Vec::new();
    for change in changes {
        push_unique_path(&mut paths, change.path.clone());
        for file in change.before_files.iter().chain(change.after_files.iter()) {
            push_unique_path(
                &mut paths,
                Path::new(&change.path)
                    .join(&file.rel_path)
                    .to_string_lossy()
                    .to_string(),
            );
        }
    }
    paths
}

fn push_unique_path(paths: &mut Vec<String>, path: String) {
    if !paths.iter().any(|candidate| candidate == &path) {
        paths.push(path);
    }
}

fn validate_relative_path(path: &str) -> AppResult<&Path> {
    validate_relative_path_without_parent(Path::new(path), "relative file")
}

fn apply_one(change: &FileChangeRecord, direction: ChangeDirection) -> AppResult<()> {
    match change.kind {
        FileChangeKind::File => apply_file_change(change, direction),
        FileChangeKind::Directory => apply_directory_change(change, direction),
    }
}

fn apply_file_change(change: &FileChangeRecord, direction: ChangeDirection) -> AppResult<()> {
    let (exists, text, data_base64) = match direction {
        ChangeDirection::Undo => (
            change.before_exists,
            change.before_text.as_deref(),
            change.before_data_base64.as_deref(),
        ),
        ChangeDirection::Redo => (
            change.after_exists,
            change.after_text.as_deref(),
            change.after_data_base64.as_deref(),
        ),
    };
    let path = Path::new(&change.path);
    if exists {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        if let Some(text) = text {
            write_utf8_no_bom(path, text)?;
        } else if let Some(data) = data_base64 {
            let bytes = general_purpose::STANDARD.decode(data)?;
            fs::write(path, bytes)?;
        } else {
            return Err(AppError::message("changeset missing file content"));
        }
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
            before_data_base64: None,
            before_files: snapshot_directory(path)?,
            after_exists: true,
            after_text: None,
            after_data_base64: None,
            after_files: snapshot_directory(path)?,
        });
    }
    let exists = path.exists();
    let (text, data_base64) = if exists {
        snapshot_file_content(path)?
    } else {
        (None, None)
    };
    Ok(FileChangeRecord {
        kind: FileChangeKind::File,
        path: path.to_string_lossy().to_string(),
        before_exists: exists,
        before_text: text.clone(),
        before_data_base64: data_base64.clone(),
        before_files: vec![],
        after_exists: exists,
        after_text: text,
        after_data_base64: data_base64,
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
    let (text, data_base64) = snapshot_file_content(path)?;
    Ok(FileSnapshot {
        rel_path,
        text,
        data_base64,
    })
}

fn snapshot_file_content(path: &Path) -> AppResult<(Option<String>, Option<String>)> {
    match read_utf8_no_bom(path) {
        Ok(text) => Ok((Some(text), None)),
        Err(_) => {
            let bytes = fs::read(path)?;
            Ok((None, Some(general_purpose::STANDARD.encode(bytes))))
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
