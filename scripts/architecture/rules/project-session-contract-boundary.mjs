import { frontendFile, rustFile } from '../shared/files.mjs';

export const projectSessionContractBoundaryRule = {
  name: 'project-session-contract-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (frontendFile(file.rel) && usesRetiredProjectContract(file.text)) {
        failures.push(`${file.rel}: frontend project state must use ProjectSession query models, not full project data bundles`);
      }
      if (rustFile(file.rel) && declaresRetiredProjectContract(file.text)) {
        failures.push(`${file.rel}: Rust project models must stay session/query scoped, not full project data bundle scoped`);
      }
    }
    return failures;
  },
};

function usesRetiredProjectContract(text) {
  const retiredNames = [`${'App'}${'Data'}`, `${'Core'}${'References'}`, `${'core'}${'References'}`];
  return new RegExp(String.raw`\b(?:${retiredNames.join('|')})\b`).test(text);
}

function declaresRetiredProjectContract(text) {
  const retiredStructs = [`${'App'}${'Data'}`, `${'Core'}${'References'}`];
  return new RegExp(String.raw`struct\s+(?:${retiredStructs.join('|')})\b`).test(text);
}
