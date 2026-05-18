export const orchestratorDomainNameBoundaryRule = {
  name: 'orchestrator-domain-name-boundary',
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

function exportedFunctionNames(text) {
  return [
    ...[...text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g)].map((match) => match[1]),
  ];
}
