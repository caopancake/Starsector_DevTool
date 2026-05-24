import { frontendFile } from '../shared/files.mjs';

export const namingBoundaryRule = {
  name: 'naming-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      if (file.rel.startsWith('src/services/') && !file.rel.endsWith('.service.ts')) {
        failures.push(`${file.rel}: service files must use .service.ts`);
      }
      if (file.rel.startsWith('src/stores/') && !file.rel.endsWith('.store.ts')) {
        failures.push(`${file.rel}: store files must use .store.ts`);
      }
      if (file.rel.startsWith('src/orchestrators/') && !file.rel.endsWith('.orchestrator.ts')) {
        failures.push(`${file.rel}: orchestrator files must use .orchestrator.ts`);
      }
      if (file.rel.startsWith('src/windows/') && !file.rel.endsWith('.window.ts') && !file.rel.endsWith('.events.ts')) {
        failures.push(`${file.rel}: window files must use .window.ts or .events.ts`);
      }
      if (file.rel.startsWith('src/app/composables/use-') && !file.rel.endsWith('.ts')) {
        failures.push(`${file.rel}: ViewModel/composable files must be TypeScript modules`);
      }
      if (file.rel.startsWith('src/app/components/config/') && file.rel.endsWith('.vue') && !/\/Config[A-Za-z0-9]+\.vue$/.test(file.rel)) {
        failures.push(`${file.rel}: config components must use Config* names`);
      }
      if (file.rel.startsWith('src/domain/') && /\.(service|store|orchestrator)\.ts$/.test(file.rel)) {
        failures.push(`${file.rel}: domain files must not use responsibility suffixes`);
      }
    }
    return failures;
  },
};
