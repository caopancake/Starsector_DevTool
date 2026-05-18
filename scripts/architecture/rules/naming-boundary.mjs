import { importedProjectPaths } from '../shared/imports.mjs';

const layerRules = [
  { prefix: 'src/services/', pattern: /^[a-z0-9-]+\.service\.ts$/, message: 'services files must use *.service.ts' },
  { prefix: 'src/stores/', pattern: /^[a-z0-9-]+\.store\.ts$/, message: 'stores files must use *.store.ts' },
  { prefix: 'src/orchestrators/', pattern: /^[a-z0-9-]+\.orchestrator\.ts$/, message: 'orchestrator files must use *.orchestrator.ts' },
  { prefix: 'src/windows/', pattern: /^[a-z0-9-]+\.(?:window|events)\.ts$/, message: 'window files must use *.window.ts or *.events.ts' },
];
const forbiddenDomainRoleSuffix = /\.(?:service|store|orchestrator)\.ts$/;

export const namingBoundaryRule = {
  name: 'naming-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const { rel, text } = file;
      const name = rel.split('/').at(-1) ?? rel;
      for (const rule of layerRules) {
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
      if (rel.startsWith('src/domain/') && forbiddenDomainRoleSuffix.test(name)) {
        failures.push(`${rel}: domain files must not use service/store/orchestrator role suffixes`);
      }
      if (rel.startsWith('src/domain/') && importsSharedApi(file)) {
        failures.push(`${rel}: domain files must not import shared/api`);
      }
      if (rel.startsWith('src/app/composables/') && importsSharedApi(file)) {
        failures.push(`${rel}: app composables must use services or orchestrators instead of shared/api`);
      }
      if (rel.startsWith('src/shared/types/') && !/^(?:index|workspace|[a-z0-9-]+\.types)\.ts$/.test(name)) {
        failures.push(`${rel}: shared type files must use *.types.ts, index.ts, or workspace.ts`);
      }
      if (rel.startsWith('src/app/components/config/') && rel.endsWith('.vue') && !/^Config[A-Z].+\.vue$/.test(name)) {
        failures.push(`${rel}: config components must use Config* prefix`);
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

function importsSharedApi(file) {
  return importedProjectPaths(file).some((imported) => !imported.typeOnly && imported.resolved.startsWith('src/shared/api/'));
}
