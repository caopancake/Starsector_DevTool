mod detection;
mod overview;
mod session_opening;

pub use detection::detect_directory;
pub use overview::{infer_starsector_root, resolve_game_mods_directory, scan_game_overview};
pub use session_opening::open_project_session_with_root;
