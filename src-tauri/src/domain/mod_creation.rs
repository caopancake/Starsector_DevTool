use crate::{
    errors::{AppError, AppResult},
    models::NewModTemplate,
};
use serde_json::{json, Value};

const MAX_MOD_ID_LENGTH: usize = 64;
const MAX_MOD_NAME_LENGTH: usize = 128;
const MAX_MOD_VERSION_LENGTH: usize = 64;
const MAX_GAME_VERSION_LENGTH: usize = 64;

#[derive(Debug)]
pub(crate) struct ValidatedNewModTemplate {
    pub id: String,
    pub name: String,
    pub version: String,
    pub game_version: String,
}

pub(crate) fn validate_new_mod_template(
    template: NewModTemplate,
) -> AppResult<ValidatedNewModTemplate> {
    let id = normalize_mod_id(template.id)?;
    Ok(ValidatedNewModTemplate {
        id,
        name: normalize_single_line_text(template.name, "Mod 名称", MAX_MOD_NAME_LENGTH)?,
        version: normalize_single_line_text(
            template.version,
            "Mod 版本号",
            MAX_MOD_VERSION_LENGTH,
        )?,
        game_version: normalize_single_line_text(
            template.game_version,
            "游戏版本",
            MAX_GAME_VERSION_LENGTH,
        )?,
    })
}

pub(crate) fn initial_mod_info(template: &ValidatedNewModTemplate) -> Value {
    json!({
        "id": template.id,
        "name": template.name,
        "version": template.version,
        "gameVersion": template.game_version,
    })
}

pub(crate) fn render_initial_mod_info(template: &ValidatedNewModTemplate) -> AppResult<String> {
    let text = serde_json::to_string_pretty(&initial_mod_info(template)).map_err(AppError::from)?;
    Ok(format!("{}\r\n", text.replace('\n', "\r\n")))
}

fn normalize_mod_id(value: String) -> AppResult<String> {
    let normalized = value.trim();
    if normalized.is_empty()
        || normalized.len() > MAX_MOD_ID_LENGTH
        || !normalized
            .bytes()
            .enumerate()
            .all(|(index, byte)| is_mod_id_byte(byte, index == 0))
    {
        return Err(AppError::message(format!(
            "Mod ID 必须以英文或数字开头，只能使用英文、数字、 .、_、-，且不超过 {MAX_MOD_ID_LENGTH} 个字符"
        )));
    }
    Ok(normalized.to_string())
}

fn is_mod_id_byte(byte: u8, first: bool) -> bool {
    byte.is_ascii_alphanumeric() || (!first && matches!(byte, b'.' | b'_' | b'-'))
}

fn normalize_single_line_text(value: String, label: &str, max_length: usize) -> AppResult<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(AppError::message(format!("{label}不能为空")));
    }
    if normalized.chars().count() > max_length {
        return Err(AppError::message(format!(
            "{label}不能超过 {max_length} 个字符"
        )));
    }
    if normalized.chars().any(char::is_control) {
        return Err(AppError::message(format!("{label}不能包含控制字符")));
    }
    Ok(normalized.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_and_normalizes_new_mod_template() {
        let validated = validate_new_mod_template(NewModTemplate {
            id: "  demo_mod  ".to_string(),
            name: "  示例 Mod  ".to_string(),
            version: "  1.0.0  ".to_string(),
            game_version: "  0.98a  ".to_string(),
        })
        .unwrap();

        assert_eq!(validated.id, "demo_mod");
        assert_eq!(validated.name, "示例 Mod");
        assert_eq!(initial_mod_info(&validated)["gameVersion"], "0.98a");
    }

    #[test]
    fn rejects_unsafe_mod_ids_and_multiline_metadata() {
        for id in ["", "../demo", "demo/mod", "demo mod", "_demo", "demo!"] {
            let error = validate_new_mod_template(NewModTemplate {
                id: id.to_string(),
                name: "Demo".to_string(),
                version: "1.0.0".to_string(),
                game_version: "0.98a".to_string(),
            })
            .unwrap_err()
            .to_string();
            assert!(error.contains("Mod ID"), "{id}");
        }

        let error = validate_new_mod_template(NewModTemplate {
            id: "demo".to_string(),
            name: "Demo\nMod".to_string(),
            version: "1.0.0".to_string(),
            game_version: "0.98a".to_string(),
        })
        .unwrap_err()
        .to_string();
        assert!(error.contains("控制字符"));
    }
}
