const requiredProjectStoreFields = new Set(['variantFiles', 'skinFiles']);

export const appDataSyncBoundaryRule = {
  name: 'app-data-sync-boundary',
  check(files) {
    const failures = [];
    const typeFile = files.find((file) => file.rel === 'src/shared/types/index.ts');
    const projectStore = files.find((file) => file.rel === 'src/features/project/project-store.ts');
    const replayService = files.find((file) => file.rel === 'src/features/file-history/file-history-replay-service.ts');
    if (!typeFile || !projectStore || !replayService) return failures;

    const fields = appDataFields(typeFile.text);
    for (const field of fields) {
      if (!requiredProjectStoreFields.has(field)) continue;
      if (!new RegExp(`\\b${field}\\b`).test(projectStore.text)) {
        failures.push(`src/features/project/project-store.ts: AppData field ${field} must be handled by project cache`);
      }
      if (!new RegExp(`\\b${field}\\b`).test(replayService.text)) {
        failures.push(
          `src/features/file-history/file-history-replay-service.ts: AppData field ${field} must be considered by file replay sync`,
        );
      }
    }
    return failures;
  },
};

function appDataFields(text) {
  const match = text.match(/export\s+interface\s+AppData\s+\{([\s\S]*?)\n\}/);
  if (!match) return [];
  return [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)[?:]?:/gm)].map((fieldMatch) => fieldMatch[1]);
}
