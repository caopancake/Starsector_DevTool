use crate::models::CSV_DEFAULT_FACTION_ID;
use std::collections::HashMap;

/// Resolves the faction a row belongs to from its blueprint tags; the first
/// tag mapped by the mod's tag map wins, otherwise the default faction.
pub fn detect_faction(tags: &str, tag_map: &HashMap<String, String>) -> String {
    for tag in faction_blueprint_tags(tags) {
        if let Some(faction) = tag_map.get(tag) {
            return faction.clone();
        }
    }
    CSV_DEFAULT_FACTION_ID.to_string()
}

fn faction_blueprint_tags(tags: &str) -> impl Iterator<Item = &str> {
    tags.split(|ch: char| ch == ',' || ch == ';' || ch == '|' || ch.is_whitespace())
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_faction_from_blueprint_tag() {
        let mut tag_map = HashMap::new();
        tag_map.insert("demo_bp".to_string(), "demo".to_string());

        assert_eq!(detect_faction("rare,demo_bp", &tag_map), "demo");
    }

    #[test]
    fn detects_faction_from_exact_blueprint_tag_tokens_only() {
        let mut tag_map = HashMap::new();
        tag_map.insert("demo_bp".to_string(), "demo".to_string());

        assert_eq!(
            detect_faction("rare,not_demo_bp_extra", &tag_map),
            CSV_DEFAULT_FACTION_ID
        );
        assert_eq!(detect_faction("rare; demo_bp | other", &tag_map), "demo");
    }
}
