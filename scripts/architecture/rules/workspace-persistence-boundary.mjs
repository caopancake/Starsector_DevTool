import { rustCommandModule } from '../../shared/files.mjs';

export const workspacePersistenceBoundaryRule = {
  name: 'workspace-persistence-boundary',
  /** @param {import('../../shared/files.mjs').RepoFile[]} files @returns {string[]} */
  check(files) {
    const failures = [];
    for (const file of files) {
      const rel = file.rel;
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

/** @param {string} text @returns {boolean} */
function hasWorkspacePersistenceCommand(text) {
  return /\b(load_workspace|save_workspace)\b/.test(text);
}
