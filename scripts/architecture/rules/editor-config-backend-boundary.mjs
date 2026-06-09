export const editorConfigBackendBoundaryRule = {
  name: 'editor-config-backend-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const rel = normalize(file.rel);
      if (rel.startsWith('scripts/architecture/')) continue;
      if (rustCommandModule(rel) && hasEditorConfigCommand(file.text)) {
        if (!file.text.includes('services::editor_config::')) {
          failures.push(`${file.rel}: editor/config commands must route to Editor/Config backend`);
        }
        if (file.text.includes('services::file_editor::') || file.text.includes('services::file_changes::')) {
          failures.push(`${file.rel}: editor/config commands must not route through file editor or file changes backends`);
        }
      }
      if (rel.startsWith('src-tauri/src/services/editor_config/') && file.text.includes('services::project::entity_definitions')) {
        failures.push(`${file.rel}: editor/config backend must consume domain definitions, not ProjectSession internals`);
      }
      if (projectEntityDefinitions(rel) && file.text.includes('struct ProjectEntitySpecDefinition')) {
        failures.push(`${file.rel}: spec metadata belongs in domain/editor_config_definitions.rs`);
      }
    }
    return failures;
  },
};

function hasEditorConfigCommand(text) {
  return /\b(save_editor_spec|load_imported_editor_spec_file|save_indexed_config_entity|save_variant_entity|save_skin_entity)\b/.test(text);
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function rustCommandModule(path) {
  return path.startsWith('src-tauri/src/commands/');
}

function projectEntityDefinitions(path) {
  return path.endsWith('/project/entity_definitions.rs');
}
