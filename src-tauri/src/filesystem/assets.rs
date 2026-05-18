use crate::{
    errors::AppResult,
    models::{UploadSpritePayload, UploadSpriteResult},
    services::file_changes::FileChangeSetBuilder,
};
use regex::Regex;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;
use walkdir::WalkDir;

static SAFE_FILENAME_RE: OnceLock<Regex> = OnceLock::new();

pub fn list_sprites(mod_root: &Path, dirs: &[&str]) -> Vec<String> {
    let mut sprites = Vec::new();
    for dir in dirs {
        let base = mod_root.join(dir);
        if !base.exists() {
            continue;
        }
        for entry in WalkDir::new(base).into_iter().flatten() {
            if entry
                .path()
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|s| s.eq_ignore_ascii_case("png"))
            {
                if let Ok(rel) = entry.path().strip_prefix(mod_root) {
                    sprites.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    sprites.sort();
    sprites
}

pub fn upload_sprite(payload: UploadSpritePayload) -> AppResult<UploadSpriteResult> {
    let sub = match payload.subfolder.as_deref() {
        Some("weapons") => "graphics/weapons",
        Some("missiles") | Some("proj") => "graphics/missiles",
        Some("fx") => "graphics/fx",
        _ => "graphics/ships",
    };
    let safe_re = SAFE_FILENAME_RE
        .get_or_init(|| Regex::new(r"[^\w\-.]").expect("valid safe filename regex"));
    let mut safe_name = safe_re.replace_all(&payload.filename, "_").to_string();
    if !safe_name.to_ascii_lowercase().ends_with(".png") {
        safe_name.push_str(".png");
    }
    let mod_root = Path::new(&payload.mod_root);
    let target_dir = mod_root.join(sub);
    fs::create_dir_all(&target_dir)?;
    let target = target_dir.join(&safe_name);
    let rel = format!("{}/{}", sub, safe_name).replace('\\', "/");
    let exists = target.exists();
    if exists && !payload.overwrite {
        return Ok(UploadSpriteResult {
            ok: false,
            exists: true,
            path: rel,
            overwritten: false,
            message: Some(format!("{safe_name} already exists. Overwrite?")),
            changes: vec![],
        });
    }
    let mut builder = FileChangeSetBuilder::new(mod_root);
    builder.binary_file(&rel, Some(payload.data))?;
    let changes = builder.apply()?;
    Ok(UploadSpriteResult {
        ok: true,
        exists,
        path: rel,
        overwritten: exists,
        message: None,
        changes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::ApplyFileChangeSetPayload, services::file_changes::apply_file_change_set};
    use base64::{engine::general_purpose, Engine as _};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn upload_sprite_create_returns_replayable_history() {
        let root = temp_dir("upload_sprite_create_history");
        let result = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: false,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();
        let path = root.join("graphics/ships/demo.png");

        assert!(result.ok);
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert!(!path.exists());
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn upload_sprite_overwrite_returns_replayable_history() {
        let root = temp_dir("upload_sprite_overwrite_history");
        let path = root.join("graphics/ships/demo.png");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, [9, 8, 7]).unwrap();

        let exists = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: false,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();
        assert!(!exists.ok);
        assert!(exists.changes.is_empty());

        let result = upload_sprite(UploadSpritePayload {
            mod_root: root.to_string_lossy().to_string(),
            filename: "demo.png".to_string(),
            data: general_purpose::STANDARD.encode([1, 2, 3]),
            overwrite: true,
            subfolder: Some("ships".to_string()),
        })
        .unwrap();

        assert!(result.ok);
        assert!(result.overwritten);
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "undo".to_string(),
            changes: result.changes.clone(),
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);
        apply_file_change_set(ApplyFileChangeSetPayload {
            direction: "redo".to_string(),
            changes: result.changes,
        })
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
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
