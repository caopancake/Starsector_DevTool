import { exportedFunctionNames } from '../shared/imports.mjs';

const fileNamingRules = [
  { prefix: 'src/services/', pattern: /^[a-z0-9-]+\.service\.ts$/, message: 'services files must use *.service.ts' },
  { prefix: 'src/stores/', pattern: /^[a-z0-9-]+\.store\.ts$/, message: 'stores files must use *.store.ts' },
  { prefix: 'src/orchestrators/', pattern: /^[a-z0-9-]+\.orchestrator\.ts$/, message: 'orchestrator files must use *.orchestrator.ts' },
  { prefix: 'src/windows/', pattern: /^[a-z0-9-]+\.(?:window|events)\.ts$/, message: 'window files must use *.window.ts or *.events.ts' },
];
const domainFileNamePattern = /^(?!.*\.(?:service|store|orchestrator)\.ts$).+\.ts$/;

export const namingBoundaryRule = {
  name: 'naming-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const { rel, text } = file;
      const name = rel.split('/').at(-1) ?? rel;
      for (const rule of fileNamingRules) {
        if (rel.startsWith(rule.prefix) && !rule.pattern.test(name)) failures.push(`${rel}: ${rule.message}`);
      }
      for (const exported of exportedFunctionNames(text)) {
        if (rel.startsWith('src/services/') && exported.startsWith('use')) {
          failures.push(`${rel}: service exports must not use use* composable names`);
        }
        if (rel.startsWith('src/services/') && /WithHistory|Data$/.test(exported)) {
          failures.push(`${rel}: service exports must not expose WithHistory or Data suffixes`);
        }
        if (rel.startsWith('src/orchestrators/') && exported.startsWith('use')) {
          failures.push(`${rel}: orchestrator exports must not use use* composable names`);
        }
        if (rel.startsWith('src/domain/') && /WithHistory/.test(exported)) {
          failures.push(`${rel}: domain exports must not expose history semantics`);
        }
        if (exported.startsWith('use') && !rel.startsWith('src/app/composables/use-')) {
          failures.push(`${rel}: use* exports belong in src/app/composables/use-*.ts`);
        }
      }
      if (rel.startsWith('src/domain/') && !domainFileNamePattern.test(name)) {
        failures.push(`${rel}: domain files must not use service/store/orchestrator role suffixes`);
      }
      if (rel.startsWith('src/shared/types/') && !/^(?:index|[a-z0-9-]+\.types)\.ts$/.test(name)) {
        failures.push(`${rel}: shared type files must use *.types.ts or index.ts`);
      }
      if (rel.startsWith('src/app/components/config/') && rel.endsWith('.vue') && !/^Config[A-Z].+\.vue$/.test(name)) {
        failures.push(`${rel}: config components must use Config* prefix`);
      }
    }
    return failures;
  },
};
