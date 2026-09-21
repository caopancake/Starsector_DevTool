import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths, importSpecifiers } from '../shared/imports.mjs';

export const frontendLayerBoundaryRule = {
  name: 'frontend-layer-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      for (const imported of importedProjectPaths(file)) {
        const target = classifyFrontendPath(imported.resolved);
        if (target.layer === 'external' || target.layer === 'unknown') continue;
        if (!validFrontendDependency(current.layer, target.layer)) {
          failures.push(`${file.rel}: ${current.layer} must not import ${target.layer} (${imported.specifier})`);
        }
        if (!imported.typeOnly && current.layer === 'services' && target.layer === 'services') {
          if (!allowedServiceEdge(current, target)) {
            failures.push(
              `${file.rel}: services must wrap one backend capability; cross-service composition belongs to orchestrators (${imported.specifier})`,
            );
          }
        }
        if (!imported.typeOnly && target.role === 'api' && current.layer !== 'services') {
          failures.push(`${file.rel}: shared/api is a wire boundary; frontend business code must go through services`);
        }
        if (!imported.typeOnly && current.role === 'component' && target.layer === 'services') {
          failures.push(
            `${file.rel}: components must consume ViewModel/composable state/actions instead of services (${imported.specifier})`,
          );
        }
        if (!imported.typeOnly && current.role === 'component' && target.layer === 'orchestrators') {
          failures.push(
            `${file.rel}: components must consume ViewModel/composable actions instead of orchestrators (${imported.specifier})`,
          );
        }
        if (!imported.typeOnly && current.role === 'composable' && target.layer === 'shared' && target.role === 'api') {
          failures.push(`${file.rel}: ViewModel/composable code must not call shared/api directly`);
        }
      }
      for (const imported of importSpecifiers(file.text)) {
        if (imported.typeOnly) continue;
        if (imported.specifier.startsWith('@tauri-apps/') && !tauriRuntimeBoundary(current)) {
          failures.push(`${file.rel}: Tauri runtime access belongs behind shared/api or window runtime modules`);
        }
      }
      if (current.role !== 'api' && /\binvoke\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: Tauri invoke belongs to shared/api wire adapters`);
      }
      if (current.role === 'api' && /\bexport\s+(?:interface|type)\s+(?!\{)/.test(file.text)) {
        failures.push(`${file.rel}: shared/api must not define business-visible types; put them in shared/types or domain`);
      }
      if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(file.text)) {
        failures.push(`${file.rel}: browser storage is forbidden; persist app state through app config services`);
      }
    }
    failures.push(...orchestratorCycleFailures(files));
    return failures;
  },
};

// 基础设施白名单：缓存宿主/投影订阅/文件写底座允许被其它 service 依赖，
// 除此之外 services 之间禁止任何 import。
const allowedServiceEdges = new Set([
  'query -> query-cache',
  'resource-media -> resource-cache',
  'config-entity -> config-resource',
  'config-entity -> query',
  'config-resource -> query',
  'config-resource -> resource-cache',
  'csv-table -> query',
  'csv-table -> resource-cache',
  'files -> write',
  'editor -> files',
  'editor -> query',
  'editor -> resource-cache',
  'editor -> write',
]);

function allowedServiceEdge(current, target) {
  return allowedServiceEdges.has(`${normalizeServiceDomain(current)} -> ${normalizeServiceDomain(target)}`);
}

function normalizeServiceDomain(file) {
  return (file.domain ?? '').replace(/\.service$/, '');
}

function orchestratorCycleFailures(files) {
  const failures = [];
  const orchestratorFiles = files.filter(
    (file) => file.rel.startsWith('src/orchestrators/') && file.rel.endsWith('.ts') && !file.rel.endsWith('.spec.ts'),
  );
  const graph = new Map();
  for (const file of orchestratorFiles) {
    const targets = [];
    for (const imported of importedProjectPaths(file)) {
      const target = classifyFrontendPath(imported.resolved);
      if (target.layer === 'orchestrators') targets.push(imported.resolved);
    }
    graph.set(file.rel, targets);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(rel, trail) {
    if (visiting.has(rel)) {
      failures.push(`src/orchestrators: orchestrator dependency cycle detected: ${[...trail, rel].join(' -> ')}`);
      return;
    }
    if (visited.has(rel)) return;
    visiting.add(rel);
    for (const next of graph.get(rel) ?? []) visit(next, [...trail, next]);
    visiting.delete(rel);
    visited.add(rel);
  }
  for (const rel of graph.keys()) visit(rel, [rel]);
  return failures;
}

function tauriRuntimeBoundary(current) {
  return current.role === 'api' || (current.layer === 'shared' && current.domain === 'runtime') || current.layer === 'windows';
}

function validFrontendDependency(fromLayer, toLayer) {
  const rank = {
    shared: 0,
    domain: 1,
    services: 2,
    orchestrators: 3,
    stores: 3,
    windows: 4,
    app: 5,
    styles: 5,
  };
  if (!(fromLayer in rank) || !(toLayer in rank)) return true;
  if (fromLayer === 'shared') return toLayer === 'shared';
  if (fromLayer === 'domain') return toLayer === 'domain' || toLayer === 'shared';
  if (fromLayer === 'services') return toLayer === 'services' || toLayer === 'domain' || toLayer === 'shared';
  if (fromLayer === 'stores') return toLayer === 'stores' || toLayer === 'domain' || toLayer === 'shared';
  if (fromLayer === 'orchestrators') return ['orchestrators', 'services', 'stores', 'domain', 'windows', 'shared'].includes(toLayer);
  if (fromLayer === 'windows') return ['windows', 'orchestrators', 'services', 'domain', 'shared'].includes(toLayer);
  if (fromLayer === 'app') return toLayer !== 'styles';
  if (fromLayer === 'styles') return toLayer === 'styles';
  return rank[toLayer] <= rank[fromLayer];
}
