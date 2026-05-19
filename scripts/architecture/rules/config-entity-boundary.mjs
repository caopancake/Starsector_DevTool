import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths, withTsExtension } from '../shared/imports.mjs';

export const configEntityBoundaryRule = {
  name: 'config-entity-boundary',
  check(files) {
    const failures = [];
    const configEntityApiFiles = discoverConfigEntityApiFiles(files);
    const configEntityTypeNames = discoverConfigEntityApiTypeNames(files, configEntityApiFiles);
    for (const file of files) {
      const { rel } = file;
      if (!frontendFile(rel)) continue;
      if (importsConfigEntityApi(file, configEntityApiFiles) && !isConfigEntityBoundaryOwner(rel)) {
        failures.push(`${rel}: config entity APIs must be called through config.service/config-save.orchestrator`);
      }
      if (
        importsGenericFileSaveApi(file) &&
        referencesConfigEntityTypes(file, configEntityTypeNames) &&
        !isConfigEntityBoundaryOwner(rel)
      ) {
        failures.push(`${rel}: config entity files must be saved through config.service/config-save.orchestrator`);
      }
    }
    return failures;
  },
};

function discoverConfigEntityApiFiles(files) {
  return new Set(
    files
      .filter((file) => file.rel.startsWith('src/shared/api/') && /\b[A-Za-z0-9_]*(?:EntityPayload|EntityResult)\b/.test(file.text))
      .map((file) => file.rel),
  );
}

function discoverConfigEntityApiTypeNames(files, configEntityApiFiles) {
  const names = new Set();
  for (const file of files.filter((candidate) => configEntityApiFiles.has(candidate.rel))) {
    for (const match of file.text.matchAll(/export\s+interface\s+([A-Za-z0-9_]*(?:EntityPayload|EntityResult|EntityKind))/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

function importsConfigEntityApi(file, configEntityApiFiles) {
  return importedProjectPaths(file).some((imported) => !imported.typeOnly && configEntityApiFiles.has(withTsExtension(imported.resolved)));
}

function importsGenericFileSaveApi(file) {
  return importedProjectPaths(file).some(
    (imported) => !imported.typeOnly && /^src\/shared\/api\/files-api(?:\.ts)?$/.test(imported.resolved),
  );
}

function referencesConfigEntityTypes(file, configEntityTypeNames) {
  return importedProjectPaths(file).some((imported) => imported.typeOnly && configEntityTypeNames.has(imported.importedName));
}

function isConfigEntityBoundaryOwner(rel) {
  const owner = classifyFrontendPath(rel);
  return owner.layer === 'services' || owner.layer === 'orchestrators' || rel.startsWith('src/shared/api/');
}
