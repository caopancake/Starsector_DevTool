export function classifyFrontendPath(path) {
  if (!path.startsWith('src/')) return { layer: 'external', role: 'external', domain: null };
  if (path.startsWith('src/shared/api/')) return { layer: 'shared', role: 'api', domain: 'shared' };
  if (path.startsWith('src/shared/')) return { layer: 'shared', role: 'shared', domain: sharedDomain(path) };
  if (path.startsWith('src/domain/')) return { layer: 'domain', role: roleFor(path), domain: segment(path, 2) };
  if (path.startsWith('src/services/')) return { layer: 'services', role: 'service', domain: serviceDomain(path) };
  if (path.startsWith('src/stores/')) return { layer: 'stores', role: 'store', domain: suffixDomain(path, '.store.ts') };
  if (path.startsWith('src/orchestrators/'))
    return { layer: 'orchestrators', role: 'orchestrator', domain: suffixDomain(path, '.orchestrator.ts') };
  if (path.startsWith('src/windows/')) return { layer: 'windows', role: 'window', domain: windowDomain(path) };
  if (path.startsWith('src/app/')) return { layer: 'app', role: roleFor(path), domain: appDomain(path) };
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

function appDomain(path) {
  const parts = path.split('/');
  if (parts[2] === 'components') return parts[3] ?? null;
  if (parts[2] === 'composables') return composableDomain(parts[3] ?? '');
  if ((parts[2] ?? '').startsWith('EditorWindow')) return 'editor-window';
  if ((parts[2] ?? '').endsWith('Window.vue')) return 'window-root';
  return parts[2]?.replace(/\.(?:ts|vue)$/, '') ?? null;
}

function composableDomain(fileName) {
  if (!fileName.startsWith('use-')) return fileName.replace(/\.ts$/, '') || null;
  return fileName.replace(/^use-/, '').replace(/\.ts$/, '');
}

function serviceDomain(path) {
  return suffixDomain(path, '.service.ts');
}

function sharedDomain(path) {
  return path.split('/')[2] ?? 'shared';
}

function windowDomain(path) {
  const fileName = path.split('/').at(-1) ?? '';
  if (fileName.endsWith('.events.ts')) return fileName.replace(/\.events\.ts$/, '');
  return suffixDomain(path, '.window.ts');
}

function suffixDomain(path, suffix) {
  return path.split('/').at(-1)?.replace(suffix, '') ?? null;
}
