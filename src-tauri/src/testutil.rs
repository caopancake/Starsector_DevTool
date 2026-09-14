use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_suffix() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos()
}

pub(crate) fn temp_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("starsector_devtool_{name}_{}", unique_suffix()))
}

pub(crate) fn temp_dir(name: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!("starsector_devtool_{name}_{}", unique_suffix()));
    std::fs::create_dir_all(&path).unwrap();
    path
}
