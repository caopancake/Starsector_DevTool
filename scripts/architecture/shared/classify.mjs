export function classifyFrontendPath(path) {
  if (!path.startsWith('src/')) return { layer: 'external', role: 'external', domain: null };
  if (path.startsWith('src/shared/api/')) return { layer: 'shared', role: 'api', domain: 'shared' };
  if (path.startsWith('src/shared/')) return { layer: 'shared', role: 'shared', domain: 'shared' };
  if (path.startsWith('src/domain/')) return { layer: 'domain', role: roleFor(path), domain: segment(path, 2) };
  if (path.startsWith('src/services/')) return { layer: 'services', role: 'service', domain: null };
  if (path.startsWith('src/stores/')) return { layer: 'stores', role: 'store', domain: null };
  if (path.startsWith('src/orchestrators/')) return { layer: 'orchestrators', role: 'orchestrator', domain: null };
  if (path.startsWith('src/windows/')) return { layer: 'windows', role: 'window', domain: null };
  if (path.startsWith('src/app/')) return { layer: 'app', role: roleFor(path), domain: null };
  if (path.startsWith('src/styles/')) return { layer: 'styles', role: 'style', domain: null };
  return { layer: 'unknown', role: 'unknown', domain: null };
}

export function roleFor(path) {
  if (path.endsWith('.vue')) return 'component';
  if (path.endsWith('.store.ts')) return 'store';
  if (path.endsWith('.service.ts')) return 'service';
  if (path.endsWith('.orchestrator.ts')) return 'orchestrator';
  if (path.endsWith('.window.ts')) return 'window';
  if (path.endsWith('.events.ts')) return 'events';
  if (path.endsWith('.types.ts')) return 'types';
  if (path.includes('/composables/')) return 'composable';
  if (path.includes('/lib/')) return 'lib';
  return 'module';
}

function segment(path, index) {
  return path.split('/')[index] ?? null;
}
