export const rustLowerLayerBoundaryRule = {
  name: 'rust-lower-layer-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.endsWith('.rs')) continue;
      const isLowerLayer = rel.startsWith('src-tauri/src/io/') || rel.startsWith('src-tauri/src/parsers/');
      const isDomainLayer = rel.startsWith('src-tauri/src/domain/');
      if (!isLowerLayer && !isDomainLayer) continue;
      if (/\bservices::/.test(text) || /\bcommands::/.test(text) || /\bmodels::payloads\b/.test(text)) {
        failures.push(`${rel}: lower domain, filesystem, and parser layers must not depend on service, command, or command payload layers`);
      }
      if (isDomainLayer && (/\bio::/.test(text) || /\bparsers::/.test(text))) {
        failures.push(`${rel}: domain layer must not depend on io or parser layers`);
      }
    }
    return failures;
  },
};
