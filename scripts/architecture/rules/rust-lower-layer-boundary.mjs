export const rustLowerLayerBoundaryRule = {
  name: 'rust-lower-layer-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.endsWith('.rs')) continue;
      if (!rel.startsWith('src-tauri/src/filesystem/') && !rel.startsWith('src-tauri/src/parsers/')) continue;
      if (/\bservices::/.test(text) || /\bcommands::/.test(text) || /\bmodels::payloads\b/.test(text)) {
        failures.push(`${rel}: filesystem and parser layers must not depend on service, command, or command payload layers`);
      }
    }
    return failures;
  },
};
