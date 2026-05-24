import { frontendFile } from '../shared/files.mjs';
import { importSpecifiers } from '../shared/imports.mjs';

export const feedbackBoundaryRule = {
  name: 'feedback-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      for (const imported of importSpecifiers(file.text)) {
        if (imported.typeOnly || imported.specifier !== 'naive-ui') continue;
        if (/\b(useMessage|useDialog|createDiscreteApi)\b/.test(imported.importedName ?? '') && !isFeedbackBoundary(file.rel)) {
          failures.push(`${file.rel}: message/dialog/discrete feedback must use the unified feedback boundary`);
        }
      }
      if (/\b(?:useMessage|useDialog|createDiscreteApi)\s*\(/.test(file.text) && !isFeedbackBoundary(file.rel)) {
        failures.push(`${file.rel}: business code must not create feedback APIs directly`);
      }
    }
    return failures;
  },
};

function isFeedbackBoundary(path) {
  return /^src\/app\/(?:app-feedback|composables\/use-app-feedback)(?:\.ts)?$/.test(path);
}
