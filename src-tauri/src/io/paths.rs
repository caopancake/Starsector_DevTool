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

    pub fn resolve_changed_path_to_relative(
        &self,
        changed_path: &str,
        label: &str,
    ) -> AppResult<Option<String>> {
        let path = Path::new(changed_path);
        if path.is_absolute() {
            return self.resolve_absolute_change_to_relative(path, label);
        }
        let rel_path = validate_safe_relative_path(path, label)?;
        let target = self.root.join(rel_path);
        self.validate_target_path(&target, label)?;
        Ok(Some(relative_path_key(rel_path)))
    }

    fn resolve_absolute_change_to_relative(
        &self,
        path: &Path,
        label: &str,
    ) -> AppResult<Option<String>> {
        validate_safe_absolute_path(path, label)?;
        reject_existing_path_links(path, label)?;
        let Some(existing) = nearest_existing_path(path) else {
            return Ok(None);
        };
        reject_existing_path_links(&existing, label)?;
        let canonical = existing.canonicalize().map_err(|error| {
            AppError::context(
                format!("canonicalize {label} path failed ({})", existing.display()),
                error.into(),
            )
        })?;
        if !path_belongs_to_root(&canonical, &self.root) {
            return Ok(None);
        }
        let target = if path.exists() {
            canonical
        } else {
            let rel_suffix = path.strip_prefix(&existing).map_err(|error| {
                AppError::message(format!(
                    "{label} path cannot be related to existing parent ({}): {error}",
                    path.display()
                ))
            })?;
            canonical.join(rel_suffix)
        };
        let rel = target.strip_prefix(&self.root).map_err(|error| {
            AppError::message(format!(
                "{label} path is outside root: {} ({error})",
                path.display()
            ))
        })?;
        Ok(Some(relative_path_key(rel)))
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

pub fn path_belongs_to_root(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn relative_path_key(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
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

#[cfg(test)]
mod tests {
    use super::FsRootBoundary;
    use crate::io::write_utf8_no_bom;
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn changed_path_resolves_project_relative_path() {
        let root = temp_dir("changed_path_relative");
        fs::create_dir_all(root.join("data/hulls")).unwrap();

        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();
        let rel = boundary
            .resolve_changed_path_to_relative("data/hulls/demo.ship", "changed path")
            .unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(rel, Some("data/hulls/demo.ship".to_string()));
    }

    #[test]
    fn changed_path_resolves_project_absolute_path() {
        let root = temp_dir("changed_path_absolute");
        let target = root.join("data/hulls/demo.ship");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        write_utf8_no_bom(&target, "{}").unwrap();

        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();
        let rel = boundary
            .resolve_changed_path_to_relative(&target.to_string_lossy(), "changed path")
            .unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(rel, Some("data/hulls/demo.ship".to_string()));
    }

    #[test]
    fn changed_path_resolves_deleted_project_absolute_path() {
        let root = temp_dir("changed_path_deleted_absolute");
        let target = root.join("data/hulls/deleted.ship");
        fs::create_dir_all(target.parent().unwrap()).unwrap();

        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();
        let rel = boundary
            .resolve_changed_path_to_relative(&target.to_string_lossy(), "changed path")
            .unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(rel, Some("data/hulls/deleted.ship".to_string()));
    }

    #[test]
    fn changed_path_ignores_external_absolute_path() {
        let root = temp_dir("changed_path_external_root");
        let external = temp_dir("changed_path_external_other");
        let target = external.join("data/hulls/demo.ship");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        write_utf8_no_bom(&target, "{}").unwrap();

        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();
        let rel = boundary
            .resolve_changed_path_to_relative(&target.to_string_lossy(), "changed path")
            .unwrap();

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(external);
        assert_eq!(rel, None);
    }

    #[test]
    fn changed_path_rejects_parent_dir_path() {
        let root = temp_dir("changed_path_parent_dir");
        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();

        let error = boundary
            .resolve_changed_path_to_relative("data/hulls/../weapons/demo.wpn", "changed path")
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("invalid changed path path"));
    }

    #[test]
    fn changed_path_rejects_link_parent_escape() {
        let Some((root, outside, link)) = temp_linked_dir("changed_path_link_parent", "data/link")
        else {
            return;
        };
        let target = link.join("outside.ship");

        let boundary = FsRootBoundary::new(&root, "mod root").unwrap();
        let result =
            boundary.resolve_changed_path_to_relative(&target.to_string_lossy(), "changed path");

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
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

    fn temp_linked_dir(name: &str, rel_link: &str) -> Option<(PathBuf, PathBuf, PathBuf)> {
        let root = temp_dir(&format!("{name}_root"));
        let outside = temp_dir(&format!("{name}_outside"));
        let link = root.join(rel_link);
        fs::create_dir_all(link.parent().unwrap()).unwrap();
        if create_dir_link(&outside, &link).is_err() {
            let _ = fs::remove_dir_all(root);
            let _ = fs::remove_dir_all(outside);
            return None;
        }
        Some((root, outside, link))
    }

    #[cfg(windows)]
    fn create_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }

    #[cfg(unix)]
    fn create_dir_link(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(not(any(windows, unix)))]
    fn create_dir_link(_target: &Path, _link: &Path) -> std::io::Result<()> {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "directory links are unsupported on this platform",
        ))
    }
}
