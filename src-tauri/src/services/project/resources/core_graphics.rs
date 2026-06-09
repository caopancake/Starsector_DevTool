use crate::{
    errors::{AppError, AppResult},
    io::{validate_walk_entry, FsRootBoundary},
};
use std::path::Path;
use walkdir::WalkDir;

pub fn scan_core_graphics(starsector_root: &str) -> AppResult<Vec<String>> {
    let starsector_root = FsRootBoundary::new(Path::new(starsector_root), "starsector root")?;
    let dir = starsector_root
        .root()
        .join("starsector-core")
        .join("graphics");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let core_dir = starsector_root.root().join("starsector-core");
    let mut paths = Vec::new();
    for entry in WalkDir::new(&dir) {
        let entry =
            entry.map_err(|error| AppError::message(format!("遍历原版图片目录失败: {error}")))?;
        validate_walk_entry(entry.path(), "core graphics")?;
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if !matches!(ext, "png" | "jpg" | "jpeg" | "gif") {
            continue;
        }
        let rel = entry.path().strip_prefix(&core_dir).map_err(|error| {
            AppError::message(format!(
                "原版图片路径不在 starsector-core 内 ({}): {error}",
                entry.path().display()
            ))
        })?;
        paths.push(rel.to_string_lossy().replace('\\', "/"));
    }
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn core_graphics_scan_returns_relative_paths() {
        let root = temp_dir("core_graphics_scan_paths");
        fs::create_dir_all(root.join("starsector-core/graphics/ships")).unwrap();
        fs::write(
            root.join("starsector-core/graphics/ships/demo.png"),
            [1, 2, 3],
        )
        .unwrap();

        let paths = scan_core_graphics(&root.to_string_lossy()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(paths, vec!["graphics/ships/demo.png".to_string()]);
    }

    #[test]
    fn core_graphics_scan_rejects_link_entry() {
        let Some((root, outside, _linked)) = temp_core_linked_dir(
            "core_graphics_link_entry",
            "starsector-core/graphics/linked",
        ) else {
            return;
        };
        fs::write(outside.join("outside.png"), [1, 2, 3]).unwrap();

        let result = scan_core_graphics(&root.to_string_lossy());

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

    fn temp_core_linked_dir(name: &str, rel_link: &str) -> Option<(PathBuf, PathBuf, PathBuf)> {
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
