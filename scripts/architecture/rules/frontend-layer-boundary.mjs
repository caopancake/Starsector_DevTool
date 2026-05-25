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
    return failures;
  },
};

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
