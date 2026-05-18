export const rustServiceBoundaryRule = {
  name: 'rust-service-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.startsWith('src-tauri/src/services/') || !rel.endsWith('.rs')) continue;
      if (/\bcommands::/.test(text) || /#\[tauri::command\]/.test(text)) {
        failures.push(`${rel}: services must not depend on command layer`);
      }
      if (/\b[A-Za-z0-9_]*WithHistoryPayload\b/.test(text)) {
        failures.push(`${rel}: services must not expose command history payload types`);
      }
      for (const match of text.matchAll(/\bpub\s+fn\s+([A-Za-z0-9_]+)/g)) {
        const name = match[1];
        if (name.endsWith('_with_history')) {
          failures.push(`${rel}: service public functions must not expose _with_history naming`);
        }
        if (/_from_(?:path|payload)$/.test(name)) {
          failures.push(`${rel}: command-facing service wrappers must use *_for_command naming`);
        }
      }
    }
    return failures;
  },
};
