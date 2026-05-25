use crate::errors::AppResult;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

static TRAILING_COMMA_RE: OnceLock<Regex> = OnceLock::new();
static UNQUOTED_KEY_RE: OnceLock<Regex> = OnceLock::new();
static UNQUOTED_VALUE_RE: OnceLock<Regex> = OnceLock::new();
static BOOL_LITERAL_RE: OnceLock<Regex> = OnceLock::new();
static LEADING_DOT_NUMBER_RE: OnceLock<Regex> = OnceLock::new();
static FLOAT_SUFFIX_RE: OnceLock<Regex> = OnceLock::new();
static LEADING_ZERO_INT_RE: OnceLock<Regex> = OnceLock::new();

pub fn parse_starsector_json(text: &str) -> AppResult<Value> {
    let trailing_re = TRAILING_COMMA_RE
        .get_or_init(|| Regex::new(r",\s*([}\]])").expect("valid trailing comma regex"));
    let key_re = UNQUOTED_KEY_RE.get_or_init(|| {
        Regex::new(r#"(?m)(^|[\{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:"#).expect("valid key regex")
    });

    // Matches unquoted identifier values (after : or , or [ that are NOT true/false/null/numbers)
    let value_re = UNQUOTED_VALUE_RE.get_or_init(|| {
        Regex::new(r#"(?m)([:,\[]\s*)([A-Z][A-Z0-9_]*)\b"#).expect("valid unquoted value regex")
    });
    let bool_literal_re = BOOL_LITERAL_RE.get_or_init(|| {
        Regex::new(r#"(?m)([:,\[]\s*)(True|TRUE|False|FALSE)\b"#).expect("valid bool literal regex")
    });

    // Matches Starsector-style leading-dot decimals after JSON separators: .5, -.5, .0f.
    let leading_dot_number_re = LEADING_DOT_NUMBER_RE.get_or_init(|| {
        Regex::new(r"(^|[:,\[]\s*)(-?)\.(\d+)").expect("valid leading-dot number regex")
    });

    // Matches Java-style float suffix: 1f, 0.5f, 1.0f → strip the trailing 'f'
    let float_suffix_re = FLOAT_SUFFIX_RE
        .get_or_init(|| Regex::new(r"(\d+\.?\d*)f\b").expect("valid float suffix regex"));

    // Matches leading-zero integers (000, 007, 01) that Java/Starsector parsers accept.
    let leading_zero_int_re = LEADING_ZERO_INT_RE.get_or_init(|| {
        Regex::new(r"(^|[:,\[]\s*)(-?)0+(\d+)").expect("valid leading-zero int regex")
    });

    // Starsector data files commonly use shell-style `#` comments; strip from `#` to line end, but only outside quoted strings.
    let mut cleaned = strip_hash_comments(text);

    // Some files use `;` where JSON would require `,`; normalize those entry separators.
    cleaned = normalize_entry_semicolons(&cleaned);

    // Some mod_info files use JavaScript-style single quoted strings, for example `"major": '1'`.
    cleaned = normalize_single_quoted_strings(&cleaned);

    // Vanilla and mods often leave a final comma before `}` or `]`; strict JSON rejects that.
    cleaned = replace_outside_strings(&cleaned, |segment| {
        trailing_re.replace_all(segment, "$1").to_string()
    });

    // Faction and spec files may omit quotes around object keys, for example `id:"hegemony"`.
    cleaned = replace_outside_strings(&cleaned, |segment| {
        key_re.replace_all(segment, "$1\"$2\":").to_string()
    });

    // Some weapon specs use Python/Java-like boolean spelling; strict JSON only accepts lowercase.
    cleaned = replace_outside_strings(&cleaned, |segment| {
        bool_literal_re
            .replace_all(segment, |captures: &regex::Captures| {
                format!("{}{}", &captures[1], captures[2].to_ascii_lowercase())
            })
            .to_string()
    });

    // Quote unquoted ALL_CAPS identifier values (enum-like values in Starsector)
    cleaned = replace_outside_strings(&cleaned, |segment| {
        value_re.replace_all(segment, "$1\"$2\"").to_string()
    });

    // Normalize leading-dot decimals (.5 → 0.5, -.5 → -0.5) before strict JSON parsing.
    cleaned = replace_outside_strings(&cleaned, |segment| {
        leading_dot_number_re
            .replace_all(segment, "$1${2}0.$3")
            .to_string()
    });

    // Strip Java float suffixes (1f → 1, 0.5f → 0.5)
    cleaned = replace_outside_strings(&cleaned, |segment| {
        float_suffix_re.replace_all(segment, "$1").to_string()
    });

    // Normalize leading-zero integers (000 → 0, 007 → 7) that Java parsers accept.
    cleaned = replace_outside_strings(&cleaned, |segment| {
        leading_zero_int_re
            .replace_all(segment, "$1${2}$3")
            .to_string()
    });

    let end = first_json_object_end(&cleaned).unwrap_or(cleaned.len());
    Ok(serde_json::from_str(&cleaned[..end])?)
}

fn strip_hash_comments(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_str = false;
    let mut escape = false;
    let mut in_comment = false;

    for ch in text.chars() {
        if in_comment {
            if ch == '\n' || ch == '\r' {
                in_comment = false;
                result.push(ch);
            }
            continue;
        }

        if in_str {
            result.push(ch);
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
            '"' => {
                in_str = true;
                result.push(ch);
            }
            '#' => in_comment = true,
            _ => result.push(ch),
        }
    }

    result
}

fn normalize_single_quoted_strings(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_double = false;
    let mut double_escape = false;
    let mut in_single = false;
    let mut single_escape = false;
    let mut single_content = String::new();

    for ch in text.chars() {
        if in_single {
            if single_escape {
                single_content.push(ch);
                single_escape = false;
            } else if ch == '\\' {
                single_escape = true;
            } else if ch == '\'' {
                result.push_str(
                    &serde_json::to_string(&single_content)
                        .expect("serializing string content should not fail"),
                );
                single_content.clear();
                in_single = false;
            } else {
                single_content.push(ch);
            }
            continue;
        }

        if in_double {
            result.push(ch);
            if double_escape {
                double_escape = false;
            } else if ch == '\\' {
                double_escape = true;
            } else if ch == '"' {
                in_double = false;
            }
            continue;
        }

        match ch {
            '"' => {
                in_double = true;
                result.push(ch);
            }
            '\'' => in_single = true,
            _ => result.push(ch),
        }
    }

    if in_single {
        result.push('\'');
        result.push_str(&single_content);
    }

    result
}

fn replace_outside_strings<F>(text: &str, mut replace: F) -> String
where
    F: FnMut(&str) -> String,
{
    let mut result = String::with_capacity(text.len());
    let mut outside_start = 0usize;
    let mut string_start = 0usize;
    let mut in_str = false;
    let mut escape = false;

    for (idx, ch) in text.char_indices() {
        if in_str {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                let end = idx + ch.len_utf8();
                result.push_str(&text[string_start..end]);
                outside_start = end;
                in_str = false;
            }
            continue;
        }

        if ch == '"' {
            result.push_str(&replace(&text[outside_start..idx]));
            string_start = idx;
            in_str = true;
        }
    }

    if in_str {
        result.push_str(&text[string_start..]);
    } else {
        result.push_str(&replace(&text[outside_start..]));
    }

    result
}

fn normalize_entry_semicolons(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_str = false;
    let mut escape = false;

    for ch in text.chars() {
        if in_str {
            result.push(ch);
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
            '"' => {
                in_str = true;
                result.push(ch);
            }
            ';' => result.push(','),
            _ => result.push(ch),
        }
    }

    result
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
    fn strips_hash_comments_that_contain_quotes() {
        let text = r#"{
            "weaponGroups": [
                #{
                #   "autofire": true,
                #   "mode": "LINKED",
                #},
                {"mode": "LINKED"}
            ],
            "description": "literal # stays"
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["weaponGroups"][0]["mode"], "LINKED");
        assert_eq!(parsed["description"], "literal # stays");
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
            "decorative": TRUE,
            "visible": True,
            "disabled": FALSE,
            "hidden": False,
            "count": 42,
            "type": "BALLISTIC",
            "name": "重生[UNGP]",
            "description": "literal # and .5f are text",
            "hints": [RENDER_BARREL_BELOW, RENDER_LOADED_MISSILES]
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "TEST_WEAPON");
        assert_eq!(parsed["enabled"], true);
        assert_eq!(parsed["decorative"], true);
        assert_eq!(parsed["visible"], true);
        assert_eq!(parsed["disabled"], false);
        assert_eq!(parsed["hidden"], false);
        assert_eq!(parsed["count"], 42);
        assert_eq!(parsed["type"], "BALLISTIC");
        assert_eq!(parsed["name"], "重生[UNGP]");
        assert_eq!(parsed["description"], "literal # and .5f are text");
        assert_eq!(parsed["hints"][0], "RENDER_BARREL_BELOW");
        assert_eq!(parsed["hints"][1], "RENDER_LOADED_MISSILES");
    }

    #[test]
    fn parses_mod_info_with_uppercase_text_inside_brackets() {
        let text = r#"{
          "id": "ungp",
          "name": "重生[UNGP]",
          "version": {"major": 2, "minor": 5, "patch": 0},
          "jars": ["jars/ungp.jar"],
          "modPlugin": "ungp.scripts.UNGP_modPlugin",
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "ungp");
        assert_eq!(parsed["name"], "重生[UNGP]");
        assert_eq!(parsed["version"]["minor"], 5);
        assert_eq!(parsed["jars"][0], "jars/ungp.jar");
    }

    #[test]
    fn handles_unquoted_value_after_colon() {
        let text = r#"{
            "id": "gun",
            "barrelMode": ALTERNATING,
            "textureType": ROUGH,
            "size": "LARGE"
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "gun");
        assert_eq!(parsed["barrelMode"], "ALTERNATING");
        assert_eq!(parsed["textureType"], "ROUGH");
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
    fn normalizes_leading_dot_decimals() {
        let text = r#"{
            "id": "test",
            "contrailMaxSpeedMult": .0f,
            "contrailSpawnDistMult": .5,
            "negative": -.25f,
            "values": [.125, -.75f, 1f]
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["contrailMaxSpeedMult"], 0.0);
        assert_eq!(parsed["contrailSpawnDistMult"], 0.5);
        assert_eq!(parsed["negative"], -0.25);
        assert_eq!(parsed["values"][0], 0.125);
        assert_eq!(parsed["values"][1], -0.75);
        assert_eq!(parsed["values"][2], 1);
    }

    #[test]
    fn accepts_semicolon_entry_separators() {
        let text = r#"{
            "id": "test";
            "description": "semicolon; inside string";
            "fadeOutEngineWhenFiring": false;
            "values": [1; 2; 3;];
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "test");
        assert_eq!(parsed["description"], "semicolon; inside string");
        assert_eq!(parsed["fadeOutEngineWhenFiring"], false);
        assert_eq!(parsed["values"][0], 1);
        assert_eq!(parsed["values"][1], 2);
        assert_eq!(parsed["values"][2], 3);
    }

    #[test]
    fn accepts_single_quoted_strings() {
        let text = r#"{
            "id": 'MagicLib',
            "version": { "major": '1', "minor": '5', "patch": '1' },
            "description": 'It\'s useful',
            "doubleQuoted": "single ' quote stays"
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["id"], "MagicLib");
        assert_eq!(parsed["version"]["major"], "1");
        assert_eq!(parsed["description"], "It's useful");
        assert_eq!(parsed["doubleQuoted"], "single ' quote stays");
    }

    #[test]
    fn normalizes_leading_zero_integers() {
        let text = r#"{
            "id": "test",
            "fringeColor": [255, 0, 000, 100],
            "coreColor": [007, 01, 0, 255],
            "value": 00042,
            "zero": 0,
            "decimal": 0.5
        }"#;
        let parsed = parse_starsector_json(text).unwrap();
        assert_eq!(parsed["fringeColor"][2], 0);
        assert_eq!(parsed["coreColor"][0], 7);
        assert_eq!(parsed["coreColor"][1], 1);
        assert_eq!(parsed["coreColor"][2], 0);
        assert_eq!(parsed["value"], 42);
        assert_eq!(parsed["zero"], 0);
        assert_eq!(parsed["decimal"], 0.5);
    }

    #[test]
    fn rejects_overly_loose_json_forms() {
        let invalid_cases = [
            (
                "missing comma between fields",
                r#"{"id": "test" "name": "No comma"}"#,
            ),
            ("unterminated single quoted string", r#"{"id": 'test}"#),
            ("lowercase bare value", r#"{"id": test}"#),
            ("mixed case bare value", r#"{"size": Large}"#),
            ("number-prefixed bare key", r#"{1id: "test"}"#),
            ("double decimal point", r#"{"ratio": 0..5}"#),
            ("field without value", r#"{"enabled": ;}"#),
            ("unterminated string", r#"{"id": "test}"#),
        ];

        for (label, text) in invalid_cases {
            assert!(
                parse_starsector_json(text).is_err(),
                "{label} should not be accepted"
            );
        }
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
    use crate::io::read_utf8_no_bom;

    #[test]
    fn parse_real_hegemony_faction_if_available() {
        let path = "J:/Starsector/starsector-core/data/world/factions/hegemony.faction";
        if let Ok(content) = read_utf8_no_bom(std::path::Path::new(path)) {
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
        if let Ok(content) = read_utf8_no_bom(std::path::Path::new(path)) {
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

    #[test]
    fn parse_real_armaa_proj_if_available() {
        let path =
            "J:/Starsector/mods/ArmaArmatura_V3.2.5/data/weapons/proj/armaa_flamer_shot2.proj";
        if let Ok(content) = read_utf8_no_bom(std::path::Path::new(path)) {
            let result = parse_starsector_json(&content);
            assert!(
                result.is_ok(),
                "Failed to parse armaa_flamer_shot2.proj: {:?}",
                result.err()
            );
            let parsed = result.unwrap();
            assert_eq!(parsed["id"], "armaa_flamer_shot2");
        }
    }
}
