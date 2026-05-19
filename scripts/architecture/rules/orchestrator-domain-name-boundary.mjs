import { exportedFunctionNames } from '../shared/imports.mjs';

export const orchestratorDomainNameBoundaryRule = {
  name: 'action-domain-export-boundary',
  check(files) {
    const domainExports = new Map();
    for (const { rel, text } of files) {
      if (!rel.startsWith('src/domain/') || !rel.endsWith('.ts')) continue;
      for (const name of exportedFunctionNames(text)) {
        if (!domainExports.has(name)) domainExports.set(name, []);
        domainExports.get(name).push(rel);
      }
    }

    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.startsWith('src/orchestrators/') || !rel.endsWith('.ts')) continue;
      for (const name of exportedFunctionNames(text)) {
        if (domainExports.has(name)) {
          failures.push(
            `${rel}: orchestrator export ${name} conflicts with domain pure function export in ${domainExports.get(name).join(', ')}`,
          );
        }
      }
    }
    return failures;
  },
};
