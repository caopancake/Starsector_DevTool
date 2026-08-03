use crate::{
    errors::{AppError, AppResult},
    io::{read_json_file, validate_walk_entry, write_utf8_no_bom, FsRootBoundary},
};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

const TEMPLATE_DIRECTORIES: &[&str] = &[
    "data/hulls",
    "data/weapons",
    "data/variants",
    "data/world/factions",
    "data/missions",
    "graphics/ships",
    "graphics/weapons",
    "graphics/missiles",
    "graphics/fx",
];

pub(crate) fn create_new_mod(
    parent_directory: &Path,
    id: &str,
    mod_info_text: &str,
) -> AppResult<PathBuf> {
    let parent = FsRootBoundary::new(parent_directory, "Mod 父目录")?;
    ensure_mod_id_is_available(parent.root(), id)?;
    let mod_root = parent.resolve_relative(id, "新建 Mod 目录")?;
    if mod_root.exists() {
        return Err(AppError::message(format!(
            "目标 Mod 目录已存在: {}",
            mod_root.display()
        )));
    }
    fs::create_dir(&mod_root).map_err(|error| {
        AppError::context(
            format!("创建 Mod 根目录失败 ({})", mod_root.display()),
            error.into(),
        )
    })?;

    match populate_mod_template(&mod_root, mod_info_text) {
        Ok(created_root) => Ok(created_root),
        Err(error) => {
            let _ = fs::remove_dir_all(&mod_root);
            Err(error)
        }
    }
}

fn populate_mod_template(mod_root: &Path, mod_info_text: &str) -> AppResult<PathBuf> {
    let boundary = FsRootBoundary::new(mod_root, "新建 Mod 根目录")?;
    for relative_directory in TEMPLATE_DIRECTORIES {
        let path = boundary.resolve_relative(relative_directory, "新建 Mod 模板目录")?;
        fs::create_dir_all(&path).map_err(|error| {
            AppError::context(
                format!("创建 Mod 模板目录失败 ({})", path.display()),
                error.into(),
            )
        })?;
    }
    let info_path = boundary.resolve_relative("mod_info.json", "mod_info.json")?;
    write_utf8_no_bom(&info_path, mod_info_text)?;
    Ok(boundary.root().to_path_buf())
}

fn ensure_mod_id_is_available(parent: &Path, id: &str) -> AppResult<()> {
    for entry in fs::read_dir(parent).map_err(|error| {
        AppError::context(
            format!("读取 Mod 父目录失败 ({})", parent.display()),
            error.into(),
        )
    })? {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("读取 Mod 目录项失败 ({})", parent.display()),
                error.into(),
            )
        })?;
        let path = entry.path();
        validate_walk_entry(&path, "Mod 父目录")?;
        if !path.is_dir() || path.file_name().is_some_and(|name| name == id) {
            continue;
        }
        let info_path = path.join("mod_info.json");
        if !info_path.is_file() {
            continue;
        }
        let Ok(info) = read_json_file(&info_path) else {
            continue;
        };
        if mod_id(&info).is_some_and(|candidate| candidate == id) {
            return Err(AppError::message(format!("Mod ID 已存在于父目录: {id}")));
        }
    }
    Ok(())
}

fn mod_id(info: &Value) -> Option<&str> {
    info.get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::mod_creation::{
            render_initial_mod_info, validate_new_mod_template, ValidatedNewModTemplate,
        },
        io::{read_json_file, read_text_bytes_no_bom, write_utf8_no_bom},
        models::NewModTemplate,
        services::project::{open_project_session_traced, PerformanceTrace},
    };
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn creates_loadable_minimal_mod_template_with_crlf_metadata() {
        let parent = temp_dir("mod_creation_template");
        let template = template("demo_mod");

        let mod_info_text = render_initial_mod_info(&template).unwrap();
        let mod_root = create_new_mod(&parent, &template.id, &mod_info_text).unwrap();
        let bytes = read_text_bytes_no_bom(&mod_root.join("mod_info.json")).unwrap();
        let info = read_json_file(&mod_root.join("mod_info.json")).unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, None, &mut trace).unwrap();

        assert_eq!(info["id"], "demo_mod");
        assert_eq!(info["name"], "Demo Mod");
        assert_eq!(info["version"], "1.0.0");
        assert_eq!(info["gameVersion"], "0.98a");
        assert!(!bytes.starts_with(&[0xef, 0xbb, 0xbf]));
        assert!(bytes.windows(2).any(|pair| pair == b"\r\n"));
        for relative_directory in TEMPLATE_DIRECTORIES {
            assert!(
                mod_root.join(relative_directory).is_dir(),
                "{relative_directory}"
            );
        }
        let _ = crate::services::project::close_project_session(manifest.session_id);
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn rejects_existing_target_without_overwriting_it() {
        let parent = temp_dir("mod_creation_existing_target");
        let target = parent.join("demo_mod");
        fs::create_dir(&target).unwrap();
        write_utf8_no_bom(&target.join("keep.txt"), "keep").unwrap();

        let template = template("demo_mod");
        let mod_info_text = render_initial_mod_info(&template).unwrap();
        let error = create_new_mod(&parent, &template.id, &mod_info_text)
            .unwrap_err()
            .to_string();
        let kept = crate::io::read_utf8_no_bom(&target.join("keep.txt")).unwrap();

        let _ = fs::remove_dir_all(parent);
        assert!(error.contains("已存在"));
        assert_eq!(kept, "keep");
    }

    #[test]
    fn rejects_duplicate_id_from_another_mod_directory() {
        let parent = temp_dir("mod_creation_duplicate_id");
        let existing = parent.join("other_folder");
        fs::create_dir(&existing).unwrap();
        write_utf8_no_bom(&existing.join("mod_info.json"), r#"{"id":"demo_mod"}"#).unwrap();

        let template = template("demo_mod");
        let mod_info_text = render_initial_mod_info(&template).unwrap();
        let error = create_new_mod(&parent, &template.id, &mod_info_text)
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(parent);
        assert!(error.contains("Mod ID 已存在"));
    }

    fn template(id: &str) -> ValidatedNewModTemplate {
        validate_new_mod_template(NewModTemplate {
            id: id.to_string(),
            name: "Demo Mod".to_string(),
            version: "1.0.0".to_string(),
            game_version: "0.98a".to_string(),
        })
        .unwrap()
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
