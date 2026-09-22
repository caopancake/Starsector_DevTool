//! Crate-level diagnostics sink. Infrastructure layers that cannot reach the
//! log service (no `AppHandle`, no settings access) record through here; the
//! Tauri setup in `lib.rs` installs the writer that lands records in the
//! application log. Without an installed sink, records are dropped — tests
//! run without Tauri and callers must never depend on delivery.

use std::sync::Mutex;

type Sink = Box<dyn Fn(&str) + Send + Sync>;

static SINK: Mutex<Option<Sink>> = Mutex::new(None);

/// Installs the process-wide diagnostics writer; later calls replace it.
pub fn install(sink: Sink) {
    if let Ok(mut guard) = SINK.lock() {
        *guard = Some(sink);
    }
}

/// Best-effort diagnostic record that preserves the original message and
/// never blocks or fails the caller.
pub fn record(message: impl Into<String>) {
    let message = message.into();
    let guard = SINK.lock().ok();
    if let Some(sink) = guard.as_ref().and_then(|sink| sink.as_ref()) {
        sink(&message);
    }
}
