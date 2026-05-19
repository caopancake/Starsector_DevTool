import { singleFileByRel } from '../shared/files.mjs';

export const appDataSyncBoundaryRule = {
  name: 'app-data-sync-boundary',
  check(files) {
    const failures = [];
    const typeFile = singleFileByRel(files, 'src/shared/types/index.ts');
    if (!typeFile) return failures;
    const projectStore = files.find(isProjectCacheStore);
    const replayService = files.find(isFileHistoryReplayOrchestrator);
    if (!projectStore || !replayService) return failures;

    const fields = appDataFields(typeFile.text);
    for (const field of fields) {
      if (!isFileBackedEntityArray(typeFile.text, field)) continue;
      if (!new RegExp(`\\b${field}\\b`).test(projectStore.text)) {
        failures.push(`${projectStore.rel}: AppData field ${field} must be handled by project cache`);
      }
      if (!new RegExp(`\\b${field}\\b`).test(replayService.text)) {
        failures.push(`${replayService.rel}: AppData field ${field} must be considered by file replay sync`);
      }
    }
    return failures;
  },
};

function isProjectCacheStore(file) {
  return file.rel.startsWith('src/stores/') && file.rel.endsWith('.store.ts') && /defineStore\(\s*['"]project['"]/.test(file.text);
}

function isFileHistoryReplayOrchestrator(file) {
  return (
    file.rel.startsWith('src/orchestrators/') &&
    file.rel.endsWith('.orchestrator.ts') &&
    file.text.includes('applyFileChangeSet') &&
    file.text.includes('FileHistoryReplayDirection')
  );
}

function appDataFields(text) {
  const match = text.match(/export\s+interface\s+AppData\s+\{([\s\S]*?)\n\}/);
  if (!match) return [];
  return [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)[?:]?:/gm)].map((fieldMatch) => fieldMatch[1]);
}

function isFileBackedEntityArray(text, field) {
  const appDataMatch = text.match(/export\s+interface\s+AppData\s+\{([\s\S]*?)\n\}/);
  if (!appDataMatch) return false;
  const fieldTypeMatch = appDataMatch[1].match(new RegExp(`^\\s*${field}[?:]?:\\s*([A-Za-z0-9_]+)\\[\\];`, 'm'));
  if (!fieldTypeMatch) return false;
  return isFileBackedEntityType(text, fieldTypeMatch[1]);
}

function isFileBackedEntityType(text, typeName) {
  const match = text.match(new RegExp(`export\\s+interface\\s+${typeName}\\s+\\{([\\s\\S]*?)\\n\\}`));
  if (!match) return false;
  const body = match[1];
  return /\bpath:\s*string;/.test(body) && /\brelPath:\s*string;/.test(body) && /\bdata:\s*RowData;/.test(body);
}
