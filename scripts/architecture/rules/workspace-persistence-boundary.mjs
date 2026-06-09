export const workspacePersistenceBoundaryRule = {
  name: 'workspace-persistence-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const rel = normalize(file.rel);
      if (rel.startsWith('scripts/architecture/')) continue;
      if (rustCommandModule(rel) && hasWorkspacePersistenceCommand(file.text)) {
        if (!file.text.includes('services::workspace_persistence::')) {
          failures.push(`${file.rel}: workspace persistence commands must route to Workspace Persistence backend`);
        }
      }
    }
    return failures;
  },
};

function hasWorkspacePersistenceCommand(text) {
  return /\b(load_workspace|save_workspace)\b/.test(text);
}

function rustCommandModule(path) {
  return path.startsWith('src-tauri/src/commands/');
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}
