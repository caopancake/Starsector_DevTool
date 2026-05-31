use crate::errors::{AppError, AppResult};
use std::path::{Component, Path};

pub fn validate_absolute_path_without_parent<'a>(
    path: &'a Path,
    label: &str,
) -> AppResult<&'a Path> {
    if !path.is_absolute() || path_uses_parent_dir(path) {
        return Err(AppError::message(format!(
            "invalid {label} path: {}",
            path.display()
        )));
    }
    Ok(path)
}

pub fn validate_relative_path_without_parent<'a>(
    path: &'a Path,
    label: &str,
) -> AppResult<&'a Path> {
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
