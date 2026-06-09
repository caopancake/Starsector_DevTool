export const projectResourcesBoundaryRule = {
  name: 'project-resources-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const rel = normalize(file.rel);
      if (rel.startsWith('scripts/architecture/')) continue;
      if (
        rel.startsWith('src-tauri/src/services/editor_config/') &&
        /\b(upload_sprite|scan_core_graphics|resource_data_url|ResourceRef)\b/.test(file.text)
      ) {
        failures.push(`${file.rel}: editor/config backend must not own project resource behavior`);
      }
      if (rustCommandModule(rel)) {
        for (const body of commandBodies(file.text, ['upload_sprite', 'scan_core_graphics'])) {
          if (!body.includes('services::project::')) {
            failures.push(`${file.rel}: project resource commands must route to Project Resources`);
          }
          if (body.includes('services::schema::')) {
            failures.push(`${file.rel}: project resource commands must not route through Schema backend`);
          }
        }
        for (const body of commandBodies(file.text, ['scan_core_fields'])) {
          if (!body.includes('services::schema::')) {
            failures.push(`${file.rel}: schema core field commands must route to Schema backend`);
          }
        }
      }
    }
    return failures;
  },
};

function commandBodies(text, commandNames) {
  return commandNames.flatMap((commandName) => {
    const signatureIndex = text.indexOf(`pub fn ${commandName}`);
    if (signatureIndex < 0) return [];
    const bodyStart = text.indexOf('{', signatureIndex);
    if (bodyStart < 0) return [];
    const bodyEnd = matchingBraceIndex(text, bodyStart);
    if (bodyEnd < 0) return [];
    return [text.slice(bodyStart, bodyEnd + 1)];
  });
}

function matchingBraceIndex(text, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function rustCommandModule(path) {
  return path.startsWith('src-tauri/src/commands/');
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}
