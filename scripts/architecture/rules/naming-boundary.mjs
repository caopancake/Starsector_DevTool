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
      if (/\bimport\s+(?:type\s+)?\{[\s\S]*?\bas\b[\s\S]*?\}\s+from\b/.test(file.text)) {
        failures.push(`${file.rel}: import aliasing is forbidden`);
      }
      for (const name of exportedFunctionNames(file.text)) {
        if (/^(?:save|create|delete|upload)(?!FileEditor|TextFile|ModFiles)[A-Za-z0-9_]*File$/.test(name)) {
          failures.push(`${file.rel}: business action ${name} must not use File to describe a save effect`);
        }
      }
    }
    return failures;
  },
};

function exportedFunctionNames(text) {
  return [
    ...[...text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g)].map((match) => match[1]),
  ];
}
