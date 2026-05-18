import { frontendFile } from '../shared/files.mjs';

const allowedConfigEntityApiImportFiles = new Set([
  'src/features/config/config-save-orchestrator.ts',
  'src/features/config/config-service.ts',
  'src/shared/api/indexed-api.ts',
  'src/shared/api/skins-api.ts',
  'src/shared/api/variants-api.ts',
]);
const configEntityBypassPatterns = [/data\/variants/i, /\.variant\b/i, /data\/hulls\/skins/i, /\.skin\b/i];

export const configEntityBoundaryRule = {
  name: 'config-entity-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!frontendFile(rel)) continue;
      if (!allowedConfigEntityApiImportFiles.has(rel) && /shared\/api\/(?:indexed|variants|skins)-api/.test(text)) {
        failures.push(`${rel}: config entity APIs must be called through config-service/config-save-orchestrator`);
      }
      if (/\bsaveModFilesWithHistory\b/.test(text) && configEntityBypassPatterns.some((pattern) => pattern.test(text))) {
        failures.push(`${rel}: config entities must not be saved through saveModFilesWithHistory`);
      }
    }
    return failures;
  },
};
