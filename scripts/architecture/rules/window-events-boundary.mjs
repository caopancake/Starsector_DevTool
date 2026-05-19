import { frontendFile, singleFileByRel } from '../shared/files.mjs';
import { importedProjectPaths, withTsExtension } from '../shared/imports.mjs';
import { isWindowRootComponent } from '../shared/rule-helpers.mjs';

export const windowEventsBoundaryRule = {
  name: 'window-events-boundary',
  check(files) {
    const failures = [];
    const eventRuntime = singleFileByRel(files, 'src/windows/tauri.events.ts');
    const eventCatalog = files.find(isWindowEventCatalog);
    const runtimeOwner = eventRuntime ? windowRuntimeSignature(eventRuntime.text) : null;
    const catalogOwner = eventCatalog ? windowCatalogSignature(eventCatalog.text) : null;
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const imports = importedProjectPaths(file);
      const importsEventRuntime = imports.some(
        (imported) => !imported.typeOnly && withTsExtension(imported.resolved) === eventRuntime?.rel,
      );
      if (
        importsEventRuntime &&
        !file.rel.startsWith('src/orchestrators/') &&
        windowRuntimeSignature(file.text) !== runtimeOwner &&
        !isWindowRootComponent(file)
      ) {
        failures.push(`${file.rel}: window event emit/listen must be coordinated through orchestrators or window root components`);
      }
      const importsEventCatalog = imports.some((imported) => withTsExtension(imported.resolved) === eventCatalog?.rel);
      if (!importsEventCatalog && !importsWindowEventOrchestrator(imports) && definesWindowEventString(file, catalogOwner)) {
        failures.push(`${file.rel}: window event names must be defined only in the window event catalog`);
      }
    }
    return failures;
  },
};

function definesWindowEventString(file, eventCatalogRel) {
  if (windowCatalogSignature(file.text) === eventCatalogRel) return false;
  return /['"](?:editor-spec|file-editor)-[a-z-]+['"]/.test(file.text);
}

function importsWindowEventOrchestrator(imports) {
  return imports.some((imported) => imported.resolved.startsWith('src/orchestrators/') && imported.resolved.includes('window'));
}

function isWindowEventCatalog(file) {
  return file.rel.startsWith('src/windows/') && file.rel.endsWith('.events.ts') && file.text.includes('WINDOW_EVENTS');
}

function windowRuntimeSignature(text) {
  return text.includes('@tauri-apps/api/event') && text.includes('emitWindowEvent') && text.includes('listenWindowEvent')
    ? 'window-event-runtime'
    : null;
}

function windowCatalogSignature(text) {
  return text.includes('WINDOW_EVENTS') && text.includes('editor-spec') && text.includes('file-editor') ? 'window-event-catalog' : null;
}
