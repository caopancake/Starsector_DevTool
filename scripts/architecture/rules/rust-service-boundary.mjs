export const rustServiceBoundaryRule = {
  name: 'rust-service-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.startsWith('src-tauri/src/services/') || !rel.endsWith('.rs')) continue;
      if (/\bcommands::/.test(text) || /#\[tauri::command\]/.test(text)) {
        failures.push(`${rel}: services must not depend on command layer`);
      }
    }
    return failures;
  },
};
