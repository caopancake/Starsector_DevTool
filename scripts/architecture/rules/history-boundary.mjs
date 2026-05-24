import { frontendFile } from '../shared/files.mjs';
import { classifyFrontendPath } from '../shared/classify.mjs';

export const historyBoundaryRule = {
  name: 'history-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (
        /\bpushFileSaveEntry\s*\(/.test(file.text) &&
        current.layer !== 'stores' &&
        !/\/file-save\.orchestrator(?:\.ts)?$/.test(file.rel)
      ) {
        failures.push(`${file.rel}: file history entries must be recorded through file-save orchestrator`);
      }
      if (
        /\bcommitFile(?:Undo|Redo)\s*\(/.test(file.text) &&
        current.layer !== 'stores' &&
        !/\/file-history-replay\.orchestrator(?:\.ts)?$/.test(file.rel)
      ) {
        failures.push(`${file.rel}: file history stack movement belongs to replay orchestrator`);
      }
      if (/\/file-history-replay\.orchestrator(?:\.ts)?$/.test(file.rel)) {
        const applyIndex = file.text.indexOf('applyFileChangeSet');
        const commitIndex = Math.min(
          positiveIndex(file.text.indexOf('commitFileUndo')),
          positiveIndex(file.text.indexOf('commitFileRedo')),
        );
        if (applyIndex < 0 || commitIndex < 0 || applyIndex > commitIndex) {
          failures.push(`${file.rel}: file history replay must apply Rust changeset before committing stack movement`);
        }
      }
    }
    return failures;
  },
};

function positiveIndex(value) {
  return value < 0 ? Number.MAX_SAFE_INTEGER : value;
}
