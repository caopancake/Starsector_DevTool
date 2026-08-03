use crate::{
    domain::mod_creation::{render_initial_mod_info, validate_new_mod_template},
    errors::AppResult,
    io::{mod_creation::create_new_mod, FsRootBoundary},
    models::{CreatedMod, NewModDestination, NewModTemplate},
    services::directory_opening::resolve_game_mods_directory,
};
use std::path::Path;

pub fn create_mod(
    destination: NewModDestination,
    template: NewModTemplate,
) -> AppResult<CreatedMod> {
    let template = validate_new_mod_template(template)?;
    let mod_info_text = render_initial_mod_info(&template)?;
    let (parent_directory, starsector_root) = match destination {
        NewModDestination::GameMods { starsector_root } => {
            let (root, mods_directory) = resolve_game_mods_directory(Path::new(&starsector_root))?;
            (mods_directory, Some(root))
        }
        NewModDestination::Directory { parent_directory } => {
            let parent = FsRootBoundary::new(Path::new(&parent_directory), "Mod 父目录")?
                .root()
                .to_path_buf();
            (parent, None)
        }
    };
    let mod_root = create_new_mod(&parent_directory, &template.id, &mod_info_text)?;
    Ok(CreatedMod {
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|root| root.to_string_lossy().to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NewModTemplate;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn game_destination_creates_mod_under_the_game_mods_directory() {
        let game_root = temp_dir("mod_creation_game_destination");
        fs::create_dir_all(game_root.join("starsector-core")).unwrap();
        fs::create_dir_all(game_root.join("mods")).unwrap();

        let created = create_mod(
            NewModDestination::GameMods {
                starsector_root: game_root.to_string_lossy().to_string(),
            },
            template(),
        )
        .unwrap();

        let expected_root = game_root.join("mods/demo_mod").canonicalize().unwrap();
        let expected_game_root = game_root
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let _ = fs::remove_dir_all(&game_root);
        assert_eq!(Path::new(&created.mod_root), expected_root);
        assert_eq!(
            created.starsector_root.as_deref(),
            Some(expected_game_root.as_str())
        );
    }

    #[test]
    fn game_destination_rejects_non_game_directory() {
        let directory = temp_dir("mod_creation_non_game_destination");

        let error = create_mod(
            NewModDestination::GameMods {
                starsector_root: directory.to_string_lossy().to_string(),
            },
            template(),
        )
        .unwrap_err()
        .to_string();

        let _ = fs::remove_dir_all(directory);
        assert!(error.contains("不是有效的 Starsector 游戏目录"));
    }

    fn template() -> NewModTemplate {
        NewModTemplate {
            id: "demo_mod".to_string(),
            name: "Demo Mod".to_string(),
            version: "1.0.0".to_string(),
            game_version: "0.98a".to_string(),
        }
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
