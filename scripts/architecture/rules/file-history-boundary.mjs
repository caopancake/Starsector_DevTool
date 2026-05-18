import { classifyFrontendPath } from '../shared/classify.mjs';
import { frontendFile } from '../shared/files.mjs';

export const fileHistoryBoundaryRule = {
  name: 'file-history-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (frontendFile(rel) && classifyFrontendPath(rel).layer !== 'orchestrators' && /\brecordFileSave\b/.test(text)) {
        failures.push(`${rel}: recordFileSave is only allowed in orchestrators`);
      }
    }
    return failures;
  },
};
