use crate::errors::AppResult;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

static COMMENT_RE: OnceLock<Regex> = OnceLock::new();
static TRAILING_COMMA_RE: OnceLock<Regex> = OnceLock::new();
static UNQUOTED_KEY_RE: OnceLock<Regex> = OnceLock::new();
static UNQUOTED_VALUE_RE: OnceLock<Regex> = OnceLock::new();
static FLOAT_SUFFIX_RE: OnceLock<Regex> = OnceLock::new();

pub fn parse_starsector_json(text: &str) -> AppResult<Value> {
    let comment_re =
        COMMENT_RE.get_or_init(|| Regex::new(r"(?m)#[^\n]*").expect("valid comment regex"));
    let trailing_re = TRAILING_COMMA_RE
        .get_or_init(|| Regex::new(r",\s*([}\]])").expect("valid trailing comma regex"));
    let key_re = UNQUOTED_KEY_RE.get_or_init(|| {
        Regex::new(r#"(?m)(^|[\{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:"#).expect("valid key regex")
    });
    // Matches unquoted identifier values (after : or , or [ that are NOT true/false/null/numbers)
    let value_re = UNQUOTED_VALUE_RE.get_or_init(|| {
        Regex::new(r#"(?m)([:,\[]\s*)([A-Z][A-Z0-9_]*)\b"#).expect("valid unquoted value regex")
    });
    // Matches Java-style float suffix: 1f, 0.5f, 1.0f → strip the trailing 'f'
    let float_suffix_re = FLOAT_SUFFIX_RE
        .get_or_init(|| Regex::new(r"(\d+\.?\d*)f\b").expect("valid float suffix regex"));
    let mut cleaned = comment_re.replace_all(text, "").to_string();
    cleaned = trailing_re.replace_all(&cleaned, "$1").to_string();
    cleaned = key_re.replace_all(&cleaned, "$1\"$2\":").to_string();
    // Quote unquoted ALL_CAPS identifier values (enum-like values in Starsector)
    cleaned = value_re.replace_all(&cleaned, "$1\"$2\"").to_string();
    // Strip Java float suffixes (1f → 1, 0.5f → 0.5)
    cleaned = float_suffix_re.replace_all(&cleaned, "$1").to_string();
    let end = first_json_object_end(&cleaned).unwrap_or(cleaned.len());
    Ok(serde_json::from_str(&cleaned[..end])?)
}

fn first_json_object_end(text: &str) -> Option<usize> {
    let mut depth = 0i32;
    let mut in_str = false;
    let mut escape = false;
    let mut started = false;
    for (idx, ch) in text.char_indices() {
        if in_str {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        match ch {
            '"' => in_str = true,
            '{' => {
                depth += 1;
                started = true;
            }
            '}' if started => {
                depth -= 1;
                if depth == 0 {
                    return Some(idx + ch.len_utf8());
                }
            }
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_loose_json() {
        let text = r#"
        # comment
        {
          id: "abc",
          color: [1,2,3,],
        }
        trailing
        "#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "abc");
        assert_eq!(parsed["color"][2], 3);
    }

    #[test]
    fn parses_unquoted_enum_values_in_arrays() {
        let text = r#"{
            "id": "test_wpn",
            "renderHints": [RENDER_BARREL_BELOW],
            "turretSprite": "graphics/weapons/test.png"
        }"#;
        let result = parse_starsector_json(text);
        if let Ok(parsed) = result {
            assert_eq!(parsed["id"], "test_wpn");
            assert_eq!(parsed["turretSprite"], "graphics/weapons/test.png");
            assert_eq!(parsed["renderHints"][0], "RENDER_BARREL_BELOW");
        } else {
            panic!(
                "Parser cannot handle unquoted enum values in arrays: {:?}",
                result.err()
            );
        }
    }

    #[test]
    fn does_not_corrupt_quoted_values_or_booleans() {
        let text = r#"{
            "id": "TEST_WEAPON",
            "enabled": true,
            "count": 42,
            "type": "BALLISTIC",
            "hints": [RENDER_BARREL_BELOW, RENDER_LOADED_MISSILES]
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "TEST_WEAPON");
        assert_eq!(parsed["enabled"], true);
        assert_eq!(parsed["count"], 42);
        assert_eq!(parsed["type"], "BALLISTIC");
        assert_eq!(parsed["hints"][0], "RENDER_BARREL_BELOW");
        assert_eq!(parsed["hints"][1], "RENDER_LOADED_MISSILES");
    }

    #[test]
    fn handles_unquoted_value_after_colon() {
        let text = r#"{
            "id": "gun",
            "barrelMode": ALTERNATING,
            "size": "LARGE"
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "gun");
        assert_eq!(parsed["barrelMode"], "ALTERNATING");
        assert_eq!(parsed["size"], "LARGE");
    }

    #[test]
    fn strips_java_float_suffix() {
        let text = r#"{
            "id": "test",
            "probability": 1f,
            "ratio": 0.5f,
            "normal": 2.0,
            "integer": 3
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "test");
        assert_eq!(parsed["probability"], 1);
        assert_eq!(parsed["ratio"], 0.5);
        assert_eq!(parsed["normal"], 2.0);
        assert_eq!(parsed["integer"], 3);
    }

    #[test]
    fn parses_faction_file_format() {
        let text = r#"{
            id:"hegemony",
            "color":[245,150,30,255],
            "displayName":"Hegemony",
            "knownShips":{
                "tags":["heg_aux_bp", "XIV_bp", "hegemony"],
                "hulls":["cerberus", "crig"],
            },
            "voices":{
                "LOW":{
                    "soldier":10,
                    "faithful":5,
                },
            },
            "custom":{
                "offersCommissions":true,
                "AICoreValueMult":1,
                "officerSkillsShuffleProbability":1f,
            },
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "hegemony");
        assert_eq!(parsed["displayName"], "Hegemony");
        assert_eq!(parsed["color"][0], 245);
        assert_eq!(parsed["knownShips"]["tags"][0], "heg_aux_bp");
        assert_eq!(parsed["knownShips"]["tags"][1], "XIV_bp");
        assert_eq!(parsed["custom"]["offersCommissions"], true);
        assert_eq!(parsed["custom"]["AICoreValueMult"], 1);
        assert_eq!(parsed["custom"]["officerSkillsShuffleProbability"], 1);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use std::fs;

    #[test]
    fn parse_real_hegemony_faction_if_available() {
        let path = "J:/Starsector/starsector-core/data/world/factions/hegemony.faction";
        if let Ok(content) = fs::read_to_string(path) {
            let result = parse_starsector_json(&content);
            assert!(
                result.is_ok(),
                "Failed to parse hegemony.faction: {:?}",
                result.err()
            );
            let parsed = result.unwrap();
            assert_eq!(parsed["id"], "hegemony");
        }
    }

    #[test]
    fn parse_real_tritachyon_faction_if_available() {
        let path = "J:/Starsector/starsector-core/data/world/factions/tritachyon.faction";
        if let Ok(content) = fs::read_to_string(path) {
            let result = parse_starsector_json(&content);
            assert!(
                result.is_ok(),
                "Failed to parse tritachyon.faction: {:?}",
                result.err()
            );
            let parsed = result.unwrap();
            assert_eq!(parsed["id"], "tritachyon");
        }
    }
}
