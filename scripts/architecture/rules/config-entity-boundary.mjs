import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

const configEntityBypassPatterns = [/data\/variants/i, /\.variant\b/i, /data\/hulls\/skins/i, /\.skin\b/i];

export const configEntityBoundaryRule = {
  name: 'config-entity-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const { rel, text } = file;
      if (!frontendFile(rel)) continue;
      if (importsConfigEntityApi(file) && !canUseConfigEntityApi(rel)) {
        failures.push(`${rel}: config entity APIs must be called through config.service/config-save.orchestrator`);
      }
      if (/\bsaveModFilesWithHistory\b/.test(text) && configEntityBypassPatterns.some((pattern) => pattern.test(text))) {
        failures.push(`${rel}: config entities must not be saved through saveModFilesWithHistory`);
      }
    }
    return failures;
  },
};

function importsConfigEntityApi(file) {
  return importedProjectPaths(file).some(
    (imported) => !imported.typeOnly && /^src\/shared\/api\/(?:indexed|variants|skins)-api(?:\.ts)?$/.test(imported.resolved),
  );
}

function canUseConfigEntityApi(rel) {
  const owner = classifyFrontendPath(rel);
  return owner.layer === 'services' || owner.layer === 'orchestrators' || rel.startsWith('src/shared/api/');
}
