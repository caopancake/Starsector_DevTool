import { frontendFile } from '../shared/files.mjs';
import { classifyFrontendPath } from '../shared/classify.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

const oldDispatcherNames = /\b(?:undoMainWindow|redoMainWindow)\b/;
const oldDispatcherImport = /@\/orchestrators\/main-undo-redo\.orchestrator\b/;
const keyEventDetails = /\bevent\.(?:ctrlKey|metaKey|key)\b|\bclosest\s*\(\s*['"][^'"]*(?:input|textarea|select|contenteditable)/;
const domEventTypes = /\bKeyboardEvent\b|\bEventTarget\b|\bHTMLElement\b/;
const vueLifecycle = /\b(?:onMounted|onUnmounted)\b/;

export const mainHistoryCommandBoundaryRule = {
  name: 'main-history-command-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);

      if (oldDispatcherNames.test(file.text) || oldDispatcherImport.test(file.text)) {
        failures.push(`${file.rel}: main window history commands must use the formal dispatcher API`);
      }

      if (isMainShortcutComposable(file.text, current) && keyEventDetails.test(file.text)) {
        failures.push(`${file.rel}: main shortcut composable must delegate keyboard command parsing to domain`);
      }

      if (isHistoryDispatcher(file.text, current) && (domEventTypes.test(file.text) || vueLifecycle.test(file.text))) {
        failures.push(`${file.rel}: main history dispatcher must not own keyboard DOM event handling`);
      }

      if (isCommandDomain(file.text, current)) {
        for (const imported of importedProjectPaths(file)) {
          if (imported.typeOnly) continue;
          const target = classifyFrontendPath(imported.resolved);
          if (
            target.layer === 'app' ||
            target.layer === 'stores' ||
            target.layer === 'services' ||
            target.layer === 'orchestrators' ||
            target.role === 'api'
          ) {
            failures.push(`${file.rel}: main window command domain must stay pure and cannot import ${imported.specifier}`);
          }
        }
      }

      if (isMainShortcutComposable(file.text, current)) {
        for (const imported of importedProjectPaths(file)) {
          if (
            imported.resolved.includes('/stores/') ||
            imported.resolved.includes('/file-history') ||
            imported.resolved.includes('/csv-edit-history')
          ) {
            failures.push(`${file.rel}: main shortcut composable must call the dispatcher, not history stores directly`);
          }
        }
      }
    }
    return failures;
  },
};

function isMainShortcutComposable(text, current) {
  return current.layer === 'app' && current.role === 'composable' && /\buseMainWindowShortcuts\b/.test(text);
}

function isHistoryDispatcher(text, current) {
  return current.layer === 'orchestrators' && /\bdispatchMain(?:Undo|Redo)Command\b/.test(text);
}

function isCommandDomain(text, current) {
  return current.layer === 'domain' && current.domain === 'workspace' && /\bmainWindowCommandFromKeyEvent\b/.test(text);
}
