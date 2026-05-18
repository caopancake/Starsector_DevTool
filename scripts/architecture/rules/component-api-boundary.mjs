import { importedProjectPaths } from '../shared/imports.mjs';

const allowedComponentApiFiles = new Set([
  'src/app/FileEditorApp.vue',
  'src/features/config/components/FactionEditor.vue',
  'src/features/config/components/FactionEntityList.vue',
  'src/features/config/components/MissionEditor.vue',
  'src/features/config/components/MissionEntityList.vue',
]);

export const componentApiBoundaryRule = {
  name: 'component-api-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!file.rel.endsWith('.vue')) continue;
      if (allowedComponentApiFiles.has(file.rel)) continue;
      if (importedProjectPaths(file).some((imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'))) {
        failures.push(`${file.rel}: components must call feature services or orchestrators instead of shared/api`);
      }
    }
    return failures;
  },
};
