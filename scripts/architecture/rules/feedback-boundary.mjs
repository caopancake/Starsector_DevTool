import { frontendFile } from '../shared/files.mjs';

const FEEDBACK_ENTRY = 'src/app/app-feedback.ts';
const FEEDBACK_COMPOSABLE = 'src/app/composables/use-app-feedback.ts';
const forbiddenPatterns = [
  { pattern: /\bcreateDiscreteApi\b/, label: 'createDiscreteApi' },
  { pattern: /\buseMessage\s*\(/, label: 'useMessage()' },
  { pattern: /\buseDialog\s*\(/, label: 'useDialog()' },
  { pattern: /\bMessageApiInjection\b/, label: 'MessageApiInjection' },
  { pattern: /\bDialogApiInjection\b/, label: 'DialogApiInjection' },
  { pattern: /\bdialog\.(warning|error|info|success)\s*\(/, label: 'direct dialog call' },
];

export const feedbackBoundaryRule = {
  name: 'feedback-boundary',
  check(files) {
    const failures = [];
    for (const file of files.filter((item) => frontendFile(item.rel))) {
      if (file.rel === FEEDBACK_ENTRY || file.rel === FEEDBACK_COMPOSABLE) continue;
      for (const rule of forbiddenPatterns) {
        if (rule.pattern.test(file.text)) {
          failures.push(`${file.rel}: ${rule.label} must go through AppFeedback`);
        }
      }
    }
    return failures;
  },
};
