const ruleRelPrefix = 'scripts/architecture/rules/';

/** @typedef {{ target: string, body: string }} RegexUse */

export const noNameExistenceChecksRule = {
  name: 'no-name-existence-checks',
  /** @param {import('../shared/files.mjs').RepoFile[]} files @returns {string[]} */
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

/** @param {string} rel @returns {boolean} */
function isArchitectureRule(rel) {
  return rel.startsWith(ruleRelPrefix) && rel.endsWith('.mjs') && !rel.endsWith('/index.mjs');
}

/** @param {string} source @returns {{ functionName: boolean, fileName: boolean }} */
function analyzeRuleSource(source) {
  const regexUses = regexApplications(source);
  return {
    functionName: regexUses.some(isFunctionDeclarationNameCheck),
    fileName: usesConcreteSingleFileLookup(source) || regexUses.some(isConcreteFileNameCheck),
  };
}

/** @param {string} source @returns {boolean} */
function usesConcreteSingleFileLookup(source) {
  return /\bsingleFileByRel\s*\(\s*files\s*,\s*['"]src(?:-tauri)?\/[^'"]+['"]\s*\)/.test(source);
}

/** @param {string} source @returns {RegexUse[]} */
function regexApplications(source) {
  return [...regexLiteralApplications(source, 'file.text'), ...regexLiteralApplications(source, 'file.rel')];
}

/** @param {string} source @param {string} targetExpression @returns {RegexUse[]} */
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

/** @param {string} source @param {RegExp} pattern @returns {string[]} */
function regexBodies(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

/** @param {RegexUse} use @returns {boolean} */
function isFunctionDeclarationNameCheck(use) {
  if (use.target !== 'file.text') return false;
  return /(?:^|[^A-Za-z0-9_])(?:function\\s\+|export\\s\+(?:\(\?:[^)]*\)|[A-Za-z0-9_*?+\\\s]){0,80}function)/.test(use.body);
}

/** @param {RegexUse} use @returns {boolean} */
function isConcreteFileNameCheck(use) {
  if (use.target !== 'file.rel') return false;
  return /(?:^|[^A-Za-z0-9_])(?:[A-Z][A-Za-z0-9_-]*|index|main|App|Window)\.(?:ts|vue|mjs|rs|tsx|jsx)\b/.test(use.body);
}
