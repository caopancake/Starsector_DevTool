import { frontendFile } from '../shared/files.mjs';

const allowedRecordFileSaveFiles = new Set([
  'src/features/config/config-save-orchestrator.ts',
  'src/features/editors/composables/use-sprite-upload.ts',
  'src/features/file-history/file-save-orchestrator.ts',
  'src/features/tables/table-save-orchestrator.ts',
]);

export const fileHistoryBoundaryRule = {
  name: 'file-history-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (frontendFile(rel) && !allowedRecordFileSaveFiles.has(rel) && /\brecordFileSave\b/.test(text)) {
        failures.push(`${rel}: recordFileSave is only allowed in save orchestrators or sprite upload orchestration`);
      }
    }
    return failures;
  },
};
