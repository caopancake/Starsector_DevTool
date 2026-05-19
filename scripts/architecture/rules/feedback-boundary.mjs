import { frontendFile } from '../shared/files.mjs';
import { importSpecifiers } from '../shared/imports.mjs';

export const feedbackBoundaryRule = {
  name: 'feedback-boundary',
  check(files) {
    const failures = [];
    for (const file of files.filter((item) => frontendFile(item.rel))) {
      if (isFeedbackBoundaryImplementation(file)) continue;
      for (const imported of importSpecifiers(file.text)) {
        if (isNaiveFeedbackImport(imported)) failures.push(`${file.rel}: Naive UI feedback APIs must go through AppFeedback`);
      }
      if (/\bdialog\.(warning|error|info|success)\s*\(/.test(file.text))
        failures.push(`${file.rel}: direct dialog calls must go through AppFeedback`);
    }
    return failures;
  },
};

function isFeedbackBoundaryImplementation(file) {
  if (!file.rel.startsWith('src/app/') || (!file.rel.endsWith('.ts') && !file.rel.endsWith('.vue'))) return false;
  const imports = importSpecifiers(file.text);
  const returnsFeedbackContract = /:\s*AppFeedback\b/.test(file.text) || /\bcreateAppFeedback\b/.test(file.text);
  const importsFeedbackApi = imports.some(
    (item) => item.specifier === 'naive-ui' && ['useMessage', 'useDialog'].includes(item.importedName),
  );
  const importsFeedbackTypes = imports.some(
    (item) => item.typeOnly && item.specifier.startsWith('naive-ui/') && /(?:MessageApiInjection|DialogApiInjection)/.test(file.text),
  );
  return returnsFeedbackContract && (importsFeedbackApi || importsFeedbackTypes);
}

function isNaiveFeedbackImport(imported) {
  if (imported.specifier === 'naive-ui') {
    return ['useMessage', 'useDialog', 'createDiscreteApi'].includes(imported.importedName);
  }
  return (
    imported.typeOnly &&
    imported.specifier.startsWith('naive-ui/') &&
    /(?:MessageApiInjection|DialogApiInjection)/.test(imported.importedName)
  );
}
