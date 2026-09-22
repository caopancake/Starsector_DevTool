use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

const SPRITE_MEDIA_CACHE_CAPACITY: usize = 512;
#[cfg(test)]
pub(in crate::services::project) const SPRITE_MEDIA_CACHE_CAPACITY_FOR_TEST: usize =
    SPRITE_MEDIA_CACHE_CAPACITY;

struct CachedSpriteMedia {
    resolved_path: PathBuf,
    modified: SystemTime,
    length: u64,
    data_url: String,
}

struct SpriteMediaCacheState {
    entries: HashMap<(String, String), CachedSpriteMedia>,
    order: VecDeque<(String, String)>,
}

fn sprite_media_cache() -> &'static Mutex<SpriteMediaCacheState> {
    static CACHE: LazyLock<Mutex<SpriteMediaCacheState>> = LazyLock::new(|| {
        Mutex::new(SpriteMediaCacheState {
            entries: HashMap::new(),
            order: VecDeque::new(),
        })
    });
    &CACHE
}

/// Returns the cached data URL only while the underlying file is unchanged;
/// any stat or modification mismatch is a miss so edits show up immediately.
pub(in crate::services::project) fn lookup_data_url(
    session_id: &str,
    cache_key: &str,
) -> Option<String> {
    let cache = match sprite_media_cache().lock() {
        Ok(cache) => cache,
        Err(_) => {
            crate::diagnostics::record("sprite media cache lock poisoned");
            return None;
        }
    };
    let entry = cache
        .entries
        .get(&(session_id.to_string(), cache_key.to_string()))?;
    let metadata = std::fs::metadata(&entry.resolved_path).ok()?;
    if metadata.modified().ok()? != entry.modified || metadata.len() != entry.length {
        return None;
    }
    Some(entry.data_url.clone())
}

pub(in crate::services::project) fn insert_entry(
    session_id: &str,
    cache_key: &str,
    resolved_path: PathBuf,
    modified: SystemTime,
    length: u64,
    data_url: String,
) {
    let Ok(mut cache) = sprite_media_cache().lock() else {
        crate::diagnostics::record("sprite media cache lock poisoned");
        return;
    };
    let media_key = (session_id.to_string(), cache_key.to_string());
    if !cache.entries.contains_key(&media_key) {
        cache.order.push_back(media_key.clone());
    }
    cache.entries.insert(
        media_key,
        CachedSpriteMedia {
            resolved_path,
            modified,
            length,
            data_url,
        },
    );
    while cache.entries.len() > SPRITE_MEDIA_CACHE_CAPACITY {
        let Some(oldest) = cache.order.pop_front() else {
            break;
        };
        cache.entries.remove(&oldest);
    }
}

pub(in crate::services::project) fn clear_sprite_media_for_session(session_id: &str) {
    let Ok(mut cache) = sprite_media_cache().lock() else {
        crate::diagnostics::record("sprite media cache lock poisoned");
        return;
    };
    cache.order.retain(|key| key.0 != session_id);
    cache
        .entries
        .retain(|(owner_session, _), _| owner_session != session_id);
}

#[cfg(test)]
pub(in crate::services::project) fn cached_sprite_media_contains(
    session_id: &str,
    cache_key: &str,
) -> bool {
    let Ok(cache) = sprite_media_cache().lock() else {
        crate::diagnostics::record("sprite media cache lock poisoned");
        return false;
    };
    cache
        .entries
        .contains_key(&(session_id.to_string(), cache_key.to_string()))
}
