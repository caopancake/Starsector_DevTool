use crate::errors::{AppError, AppResult};
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Clone)]
pub struct FsRootBoundary {
    root: PathBuf,
}

impl FsRootBoundary {
    pub fn new(root: &Path, label: &str) -> AppResult<Self> {
        validate_safe_absolute_path(root, label)?;
        reject_existing_path_links(root, label)?;
        let root = root.canonicalize().map_err(|error| {
            AppError::context(
                format!("canonicalize {label} path failed ({})", root.display()),
                error.into(),
            )
        })?;
        if !root.is_dir() {
            return Err(AppError::message(format!(
                "{label} path is not a directory: {}",
                root.display()
            )));
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn resolve_relative(&self, rel_path: &str, label: &str) -> AppResult<PathBuf> {
        let rel_path = validate_safe_relative_path(Path::new(rel_path), label)?;
        let target = self.root.join(rel_path);
        self.validate_target_path(&target, label)?;
        Ok(target)
    }

    pub fn resolve_absolute(&self, path: &Path, label: &str) -> AppResult<PathBuf> {
        validate_safe_absolute_path(path, label)?;
        self.validate_target_path(path, label)?;
        Ok(path.to_path_buf())
    }

    fn validate_target_path(&self, path: &Path, label: &str) -> AppResult<()> {
        reject_existing_path_links(path, label)?;
        let existing = nearest_existing_path(path).ok_or_else(|| {
            AppError::message(format!(
                "{label} path has no existing parent: {}",
                path.display()
            ))
        })?;
        reject_existing_path_links(&existing, label)?;
        let canonical = existing.canonicalize().map_err(|error| {
            AppError::context(
                format!("canonicalize {label} path failed ({})", existing.display()),
                error.into(),
            )
        })?;
        if !path_belongs_to_root(&canonical, &self.root) {
            return Err(AppError::message(format!(
                "{label} path is outside root: {}",
                path.display()
            )));
        }
        Ok(())
    }
}

pub fn validate_walk_entry(path: &Path, label: &str) -> AppResult<()> {
    reject_link_path(path, label)
}

pub fn validate_safe_absolute_path<'a>(path: &'a Path, label: &str) -> AppResult<&'a Path> {
    if !path.is_absolute() || path_uses_parent_dir(path) {
        return Err(AppError::message(format!(
            "invalid {label} path: {}",
            path.display()
        )));
    }
    Ok(path)
}

pub fn validate_safe_relative_path<'a>(path: &'a Path, label: &str) -> AppResult<&'a Path> {
    let mut components = path.components().peekable();
    if components.peek().is_none()
        || components.any(|part| !matches!(part, Component::Normal(_)))
        || !path
            .to_string_lossy()
            .split(['/', '\\'])
            .all(|part| !part.is_empty() && part != "." && part != "..")
    {
        return Err(AppError::message(format!(
            "invalid {label} path: {}",
            path.display()
        )));
    }
    Ok(path)
}

pub fn path_uses_parent_dir(path: &Path) -> bool {
    path.components()
        .any(|part| matches!(part, Component::ParentDir))
}

pub fn normalized_path_key(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

pub fn path_belongs_to_root(path: &Path, root: &Path) -> bool {
    let path = normalized_path_key(path);
    let root = normalized_path_key(root);
    path == root || path.starts_with(&format!("{root}/"))
}

fn nearest_existing_path(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|candidate| candidate.exists())
        .map(Path::to_path_buf)
}

fn reject_existing_path_links(path: &Path, label: &str) -> AppResult<()> {
    for ancestor in path.ancestors() {
        if ancestor.exists() {
            reject_link_path(ancestor, label)?;
        }
    }
    Ok(())
}

fn reject_link_path(path: &Path, label: &str) -> AppResult<()> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        AppError::context(
            format!("读取 {label} 路径元数据失败 ({})", path.display()),
            error.into(),
        )
    })?;
    let file_type = metadata.file_type();
    if file_type.is_symlink() || is_reparse_point(&metadata) {
        return Err(AppError::message(format!(
            "{label} path uses a link or reparse point: {}",
            path.display()
        )));
    }
    Ok(())
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
