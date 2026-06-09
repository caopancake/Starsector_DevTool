import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

const legacyDraftTerms = [
  'useConfigDraft',
  'baseSpec',
  'draftSpec',
  'pendingExternalSpec',
  'baseText',
  'pendingExternalText',
  'setBase',
  'commitDraft',
];
const targetSessionTerms = ['currentTargetKey', 'loadTarget', 'refreshTarget', 'applyExternalForTarget', 'saveDraft'];

export const draftSessionBoundaryRule = {
  name: 'draft-session-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);

      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (target.domain === 'draft-session' && current.domain !== 'edit-target-draft-session') {
          failures.push(`${file.rel}: business editing modules must use edit target draft session, not draft session primitive`);
        }
        if (target.domain === 'config-editor-draft-session' && current.role === 'component' && current.domain === 'config') {
          failures.push(`${file.rel}: config editor components must consume editor ViewModel output, not config draft session`);
        }
        if (current.domain === 'edit-target-draft-session' && ownsBusinessDependency(target)) {
          failures.push(
            `${file.rel}: edit target draft session must receive load/save callbacks instead of importing business dependencies`,
          );
        }
      }

      if (isBusinessEditingModule(current) && legacyDraftTerms.some((term) => file.text.includes(term))) {
        failures.push(`${file.rel}: editing modules must not keep legacy manual draft state or old draft primitive methods`);
      }
      if (current.role === 'component' && current.domain === 'config' && targetSessionTerms.some((term) => file.text.includes(term))) {
        failures.push(`${file.rel}: config editor components must not own edit target draft session actions`);
      }
    }
    return failures;
  },
};

function ownsBusinessDependency(target) {
  return target.role === 'api' || target.role === 'service' || target.role === 'orchestrator' || target.role === 'store';
}

function isBusinessEditingModule(current) {
  if (current.layer !== 'app') return false;
  return (
    current.domain === 'config' ||
    current.domain === 'config-mod-info-view-model' ||
    current.domain === 'editor-window-view-model' ||
    current.domain === 'file-editor-view-model'
  );
}
