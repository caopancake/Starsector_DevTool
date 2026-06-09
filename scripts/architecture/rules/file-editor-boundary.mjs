export const fileEditorBoundaryRule = {
  name: 'file-editor-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const rel = normalize(file.rel);
      if (rel.startsWith('scripts/architecture/')) continue;
      if (rel.endsWith('/services/file_changes.rs') && /\b(load_editable_file|save_text_file|EditableFileData)\b/.test(file.text)) {
        failures.push(`${file.rel}: Mod text editing belongs in services/file_editor.rs`);
      }
      if (rustCommandModule(rel) && hasTextFileEditorCommand(file.text)) {
        if (!file.text.includes('services::file_editor::')) {
          failures.push(`${file.rel}: text file editor commands must route to File Editor backend`);
        }
        if (file.text.includes('services::file_changes::') || file.text.includes('services::editor_config::')) {
          failures.push(`${file.rel}: text file editor commands must not route through file changes or editor/config backends`);
        }
      }
      if (rustCommandModule(rel) && hasFileChangesCommand(file.text)) {
        if (!file.text.includes('services::file_changes::')) {
          failures.push(`${file.rel}: file changes commands must route to File Changes backend`);
        }
        if (file.text.includes('services::file_editor::') || file.text.includes('services::editor_config::')) {
          failures.push(`${file.rel}: file changes commands must not route through file editor or editor/config backends`);
        }
      }
    }
    return failures;
  },
};

function hasTextFileEditorCommand(text) {
  return /\b(load_editable_file|save_text_file)\b/.test(text);
}

function hasFileChangesCommand(text) {
  return /\b(save_mod_files|apply_file_change_set)\b/.test(text);
}

function rustCommandModule(path) {
  return path.startsWith('src-tauri/src/commands/');
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}
