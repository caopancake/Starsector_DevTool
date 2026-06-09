const ruleRelPrefix = 'scripts/architecture/rules/';

export const noNameExistenceChecksRule = {
  name: 'no-name-existence-checks',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!isArchitectureRule(file.rel)) continue;
      const findings = analyzeRuleSource(file.text);
      if (findings.functionName) {
        failures.push(`${file.rel}: architecture rules must not check whether function names exist`);
      }
      if (findings.fileName) {
        failures.push(`${file.rel}: architecture rules must not check whether file names exist`);
      }
    }
    return failures;
  },
};

function isArchitectureRule(rel) {
  return rel.startsWith(ruleRelPrefix) && rel.endsWith('.mjs') && !rel.endsWith('/index.mjs');
}

function analyzeRuleSource(source) {
  const regexUses = regexApplications(source);
  return {
    functionName: regexUses.some(isFunctionDeclarationNameCheck),
    fileName: usesConcreteSingleFileLookup(source) || regexUses.some(isConcreteFileNameCheck),
  };
}

function usesConcreteSingleFileLookup(source) {
  return /\bsingleFileByRel\s*\(\s*files\s*,\s*['"]src(?:-tauri)?\/[^'"]+['"]\s*\)/.test(source);
}

function regexApplications(source) {
  return [...regexLiteralApplications(source, 'file.text'), ...regexLiteralApplications(source, 'file.rel')];
}

function regexLiteralApplications(source, targetExpression) {
  const escapedTarget = targetExpression.replace('.', String.raw`\.`);
  return [
    ...regexBodies(source, new RegExp(String.raw`\/((?:\\.|[^/\\\n])+?)\/[dgimsuvy]*\.test\(\s*${escapedTarget}\s*\)`, 'g')).map(
      (body) => ({ target: targetExpression, body }),
    ),
    ...regexBodies(
      source,
      new RegExp(String.raw`${escapedTarget}\.(?:match|matchAll)\(\s*\/((?:\\.|[^/\\\n])+?)\/[dgimsuvy]*\s*\)`, 'g'),
    ).map((body) => ({ target: targetExpression, body })),
  ];
}

function regexBodies(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function isFunctionDeclarationNameCheck(use) {
  if (use.target !== 'file.text') return false;
  return /(?:^|[^A-Za-z0-9_])(?:function\\s\+|export\\s\+(?:\(\?:[^)]*\)|[A-Za-z0-9_*?+\\\s]){0,80}function)/.test(use.body);
}

function isConcreteFileNameCheck(use) {
  if (use.target !== 'file.rel') return false;
  return /(?:^|[^A-Za-z0-9_])(?:[A-Z][A-Za-z0-9_-]*|index|main|App|Window)\.(?:ts|vue|mjs|rs|tsx|jsx)\b/.test(use.body);
}
