use crate::{
    errors::AppResult,
    io::{apply_changes, build_text_change, read_utf8_no_bom, ChangeDirection, FsRootBoundary},
    models::{EditableFileData, WriteResult},
};
use std::path::Path;

pub fn save_text_file(mod_root: &str, path: &str, text: String) -> AppResult<WriteResult> {
    let path = Path::new(path);
    let boundary = FsRootBoundary::new(Path::new(mod_root), "mod root")?;
    let path = boundary.resolve_absolute(path, "file path")?;
    let change = build_text_change(&path, Some(text))?;
    apply_changes(std::slice::from_ref(&change), ChangeDirection::Redo)?;
    Ok(WriteResult::from_changes(vec![change]))
}

pub fn load_editable_file(mod_root: &str, path: String) -> AppResult<EditableFileData> {
    let target = Path::new(&path);
    let boundary = FsRootBoundary::new(Path::new(mod_root), "mod root")?;
    let target = boundary.resolve_absolute(target, "file path")?;
    read_utf8_no_bom(&target).map(|text| EditableFileData {
        path: target.display().to_string(),
        text,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

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
    fn save_text_file_rejects_link_parent_escape() {
        let Some((root, outside, linked)) = temp_linked_dir("save_text_link_escape") else {
            return;
        };

        let result = save_text_file(
            &root.to_string_lossy(),
            &linked.join("outside.txt").to_string_lossy(),
            "bad".to_string(),
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn load_editable_file_rejects_link_parent_escape() {
        let Some((root, outside, linked)) = temp_linked_dir("load_text_link_escape") else {
            return;
        };
        write_utf8_no_bom(&outside.join("outside.txt"), "bad").unwrap();

        let result = load_editable_file(
            &root.to_string_lossy(),
            linked.join("outside.txt").to_string_lossy().to_string(),
        );

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

    fn temp_linked_dir(name: &str) -> Option<(PathBuf, PathBuf, PathBuf)> {
        let root = temp_dir(&format!("{name}_root"));
        let outside = temp_dir(&format!("{name}_outside"));
        let link = root.join("linked");
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
