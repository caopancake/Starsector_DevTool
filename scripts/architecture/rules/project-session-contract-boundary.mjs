import { frontendFile, rustFile } from '../shared/files.mjs';

export const projectSessionContractBoundaryRule = {
  name: 'project-session-contract-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (frontendFile(file.rel) && /\b(?:AppData|CoreReferences|coreReferences)\b/.test(file.text)) {
        failures.push(`${file.rel}: frontend project state must use ProjectSession query models, not full project payloads`);
      }
      if (rustFile(file.rel) && /struct\s+(?:AppData|CoreReferences)\b/.test(file.text)) {
        failures.push(`${file.rel}: Rust project models must stay session/query scoped, not full project payload scoped`);
      }
    }
    return failures;
  },
};
