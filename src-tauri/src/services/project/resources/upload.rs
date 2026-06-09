use crate::{
    errors::{AppError, AppResult},
    io::FileChangeSetBuilder,
    models::{SpriteSubfolder, WriteResult},
};
use regex::Regex;
use serde_json::{json, Value};
use std::{path::Path, sync::OnceLock};

static SPRITE_FILENAME_RE: OnceLock<Regex> = OnceLock::new();

pub fn upload_sprite(
    mod_root: &str,
    filename: &str,
    data: String,
    subfolder: SpriteSubfolder,
    overwrite: bool,
) -> AppResult<WriteResult<Value>> {
    let sub = subfolder.graphics_rel_dir();
    let sprite_filename = validate_sprite_filename(filename)?;
    let mod_root = Path::new(mod_root);
    let target = mod_root.join(sub).join(sprite_filename);
    let rel = format!("{}/{}", sub, sprite_filename).replace('\\', "/");
    let exists = target.exists();
    if exists && !overwrite {
        return Ok(WriteResult::from_refreshed_entity(
            Vec::new(),
            json!({
                "ok": false,
                "exists": true,
                "path": rel,
                "overwritten": false,
                "message": format!("{sprite_filename} already exists. Overwrite?")
            }),
        ));
    }
    let mut builder = FileChangeSetBuilder::new(mod_root)?;
    builder.binary_file(&rel, Some(data))?;
    let changes = builder.apply()?;
    Ok(WriteResult::from_refreshed_entity(
        changes,
        json!({
            "ok": true,
            "exists": exists,
            "path": rel,
            "overwritten": exists,
            "message": Value::Null
        }),
    ))
}

fn validate_sprite_filename(filename: &str) -> AppResult<&str> {
    let trimmed = filename.trim();
    let filename_re = SPRITE_FILENAME_RE.get_or_init(|| {
        Regex::new(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.png$").expect("valid sprite filename regex")
    });
    if filename_re.is_match(trimmed) {
        Ok(trimmed)
    } else {
        Err(AppError::message(format!(
            "invalid sprite filename: {filename}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FileChangeReplayDirection;
    use crate::services::file_changes::apply_file_change_set;
    use base64::{engine::general_purpose, Engine as _};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn upload_sprite_create_returns_replayable_history() {
        let root = temp_dir("upload_sprite_create_history");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        )
        .unwrap();
        let path = root.join("graphics/ships/demo.png");

        assert!(result
            .refreshed_entity
            .as_ref()
            .and_then(|entity| entity.get("ok"))
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert!(!path.exists());
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
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

        let exists = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        )
        .unwrap();
        assert!(!exists
            .refreshed_entity
            .as_ref()
            .and_then(|entity| entity.get("ok"))
            .and_then(Value::as_bool)
            .unwrap_or(true));
        assert!(exists.changes.is_empty());

        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            true,
        )
        .unwrap();

        let refreshed = result.refreshed_entity.as_ref().unwrap();
        assert!(refreshed
            .get("ok")
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert!(refreshed
            .get("overwritten")
            .and_then(Value::as_bool)
            .unwrap_or(false));
        assert_eq!(fs::read(&path).unwrap(), vec![1, 2, 3]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Undo,
            result.changes.clone(),
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), vec![9, 8, 7]);
        apply_file_change_set(
            &root.to_string_lossy(),
            FileChangeReplayDirection::Redo,
            result.changes,
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_dir_all(root);
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[test]
    fn upload_sprite_invalid_data_does_not_create_target_directory() {
        let root = temp_dir("upload_sprite_invalid_data");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "demo.png",
            "not base64".to_string(),
            SpriteSubfolder::Ships,
            false,
        );

        let target_dir_exists = root.join("graphics/ships").exists();
        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(!target_dir_exists);
    }

    #[test]
    fn upload_sprite_rejects_invalid_filename_without_rewriting() {
        let root = temp_dir("upload_sprite_invalid_filename");
        let result = upload_sprite(
            &root.to_string_lossy(),
            "../bad name.png",
            general_purpose::STANDARD.encode([1, 2, 3]),
            SpriteSubfolder::Ships,
            false,
        );

        let target_dir_exists = root.join("graphics/ships").exists();
        let _ = fs::remove_dir_all(root);
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("invalid sprite filename"));
        assert!(!target_dir_exists);
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
