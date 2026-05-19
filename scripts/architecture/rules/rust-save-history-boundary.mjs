import { rustFile } from '../shared/files.mjs';

export const rustSaveHistoryBoundaryRule = {
  name: 'rust-save-history-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rustFile(rel) || !rel.startsWith('src-tauri/src/services/')) continue;
      const productionText = stripRustTests(text);
      if (!isModFileChangeService(text)) continue;
      if (rel !== 'src-tauri/src/services/file_changes.rs' && writesFilesystemDirectly(productionText)) {
        failures.push(`${rel}: save services must write through FileChangeSetBuilder/file_changes`);
      }
      if (
        !text.includes('FileChangeSetBuilder') &&
        !text.includes('save_mod_files') &&
        !text.includes('save_text_file') &&
        !text.includes('save_json_spec')
      ) {
        failures.push(`${rel}: save services returning file changes must use the unified file history changeset path`);
      }
    }
    return failures;
  },
};

function isModFileChangeService(text) {
  return /FileChangeRecord|FileChangeSetBuilder/.test(text);
}

function writesFilesystemDirectly(text) {
  return /\bfs::write\s*\(|\bstd::fs::write\s*\(|\bwrite_utf8_no_bom\s*\(/.test(text);
}

function stripRustTests(text) {
  return text.replace(/#\[cfg\(test\)\][\s\S]*$/m, '');
}
