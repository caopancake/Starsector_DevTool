use crate::{
    errors::{AppError, AppResult},
    io::{FsRootBoundary, validate_walk_entry},
};
use std::path::Path;
use walkdir::WalkDir;

use super::sprites::image_mime_type;

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
        let entry = entry.map_err(|error| {
            AppError::message("io.walk_failed", format!("遍历原版图片目录失败: {error}"))
        })?;
        validate_walk_entry(entry.path(), "core graphics")?;
        if !entry.file_type().is_file() {
            continue;
        }
        let extension = entry
            .path()
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if image_mime_type(extension).is_none() {
            continue;
        }
        let rel = entry.path().strip_prefix(&core_dir).map_err(|error| {
            AppError::message(
                "path.outside_root",
                format!(
                    "原版图片路径不在 starsector-core 内 ({}): {error}",
                    entry.path().display()
                ),
            )
        })?;
        paths.push(rel.to_string_lossy().replace('\\', "/"));
    }
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testutil::{temp_dir, temp_linked_dir};
    use std::fs;

    #[test]
    fn core_graphics_scan_returns_relative_paths() {
        let root = temp_dir("core_graphics_scan_paths");
        fs::create_dir_all(root.join("starsector-core/graphics/ships")).unwrap();
        fs::write(
            root.join("starsector-core/graphics/ships/demo.png"),
            [1, 2, 3],
        )
        .unwrap();
        fs::write(
            root.join("starsector-core/graphics/ships/demo.jpg"),
            [4, 5, 6],
        )
        .unwrap();
        fs::write(
            root.join("starsector-core/graphics/ships/demo.bmp"),
            [7, 8, 9],
        )
        .unwrap();

        let mut paths = scan_core_graphics(&root.to_string_lossy()).unwrap();
        paths.sort();

        let _ = fs::remove_dir_all(root);
        assert_eq!(
            paths,
            vec![
                "graphics/ships/demo.jpg".to_string(),
                "graphics/ships/demo.png".to_string(),
            ]
        );
    }

    #[test]
    fn core_graphics_scan_rejects_link_entry() {
        let Some((root, outside, _linked)) = temp_linked_dir(
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
}
