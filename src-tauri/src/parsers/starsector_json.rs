use crate::errors::AppResult;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

static COMMENT_RE: OnceLock<Regex> = OnceLock::new();
static TRAILING_COMMA_RE: OnceLock<Regex> = OnceLock::new();
static UNQUOTED_KEY_RE: OnceLock<Regex> = OnceLock::new();

pub fn parse_starsector_json(text: &str) -> AppResult<Value> {
    let comment_re =
        COMMENT_RE.get_or_init(|| Regex::new(r"(?m)#[^\n]*").expect("valid comment regex"));
    let trailing_re = TRAILING_COMMA_RE
        .get_or_init(|| Regex::new(r",\s*([}\]])").expect("valid trailing comma regex"));
    let key_re = UNQUOTED_KEY_RE.get_or_init(|| {
        Regex::new(r#"(?m)(^|[\{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:"#).expect("valid key regex")
    });
    let mut cleaned = comment_re.replace_all(text, "").to_string();
    cleaned = trailing_re.replace_all(&cleaned, "$1").to_string();
    cleaned = key_re.replace_all(&cleaned, "$1\"$2\":").to_string();
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
}
