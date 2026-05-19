export const architectureRulesSelfBoundaryRule = {
  name: 'architecture-rules-self-boundary',
  check(files) {
    const failures = [];
    const ruleFiles = files.filter((file) => file.rel.startsWith('scripts/architecture/rules/') && file.rel.endsWith('.mjs'));

    for (const file of ruleFiles) {
      if (file.rel.endsWith('/index.mjs')) continue;
      if (usesConcreteSourcePathEquality(file.text)) {
        failures.push(`${file.rel}: architecture rules must use singleFileByRel() for single-file checks, not raw source path equality`);
      }
      if (usesConcretePathIdentity(file.text)) {
        failures.push(`${file.rel}: architecture rules must not authorize or branch by raw file path identity`);
      }
      if (usesTooManySingleFileAnchors(file.text)) {
        failures.push(`${file.rel}: each architecture rule may use singleFileByRel() at most once; split the rule or re-audit it`);
      }
      if (misusesSingleFileByRel(file.text)) {
        failures.push(`${file.rel}: singleFileByRel() is only for one check(files) anchor, not authorization helpers or file sets`);
      }
      if (usesBoundaryDriftVocabulary(file.text)) {
        failures.push(`${file.rel}: architecture rules must not use whitelist or exception vocabulary for boundaries`);
      }
      if (usesDirectoryPrefixAuthorization(file.text)) {
        failures.push(`${file.rel}: boundary helpers must not authorize by broad source directory prefix`);
      }
      if (usesContentIdentityBoundary(file.text)) {
        failures.push(`${file.rel}: architecture rules must not authorize by component or file identity strings in text matching`);
      }
    }

    return failures;
  },
};

function usesConcreteSourcePathEquality(text) {
  return /\b\w+\.rel\s*={2,3}\s*['"]src\/[^'"]+['"]|\brel\s*={2,3}\s*['"]src\/[^'"]+['"]/.test(text);
}

function usesConcretePathIdentity(text) {
  return (
    /\b(?:file\.)?rel\s*!={1,2}\s*[^;\n]*\??\.rel\b/.test(text) ||
    /\b(?:file\.)?rel\s*={2,3}\s*[A-Za-z0-9_]+Rel\b/.test(text) ||
    /\bwith(?:Ts|Vue|Rust)?Extension\([^)]*\)\s*={2,3}\s*[A-Za-z0-9_]+Rel\b/.test(text) ||
    /\b[A-Za-z0-9_]+Rel\s*=\s*singleFileByRel\([^)]*\)\?\.[A-Za-z0-9_]+/.test(text)
  );
}

function usesTooManySingleFileAnchors(text) {
  return countSingleFileByRelCalls(text) > 1;
}

function misusesSingleFileByRel(text) {
  if (singleFileInAuthorizationHelper(text)) return true;
  if (/\b(?:providerFiles|runtimeFiles)[A-Za-z0-9_]*\s*=\s*[^;\n]*singleFileByRel\s*\(/.test(text)) return true;
  if (/singleFileByRel\s*\(\s*files\s*,\s*[A-Za-z0-9_]+/.test(text)) return true;
  if (/new\s+Set\s*\([^)]*singleFileByRel\s*\(/s.test(text)) return true;
  return false;
}

function countSingleFileByRelCalls(text) {
  return [...text.matchAll(/(?<!function\s)singleFileByRel\s*\(/g)].length;
}

function singleFileInAuthorizationHelper(text) {
  const helperMatches = text.matchAll(
    /\b(?:mayUse|canUse|allow|allows|isAllowed|isTrusted|isException)[A-Za-z0-9_]*\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g,
  );
  return [...helperMatches].some((match) => match[1].includes('singleFileByRel('));
}

function usesDirectoryPrefixAuthorization(text) {
  const helperMatches = text.matchAll(/\b(?:mayUse|canUse|allow|allows)[A-Za-z0-9_]*\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g);
  return [...helperMatches].some((match) =>
    /rel\.startsWith\(\s*['"]src\/(?!shared\/api\/|windows\/|shared\/runtime\/)[^'"]+['"]\s*\)/.test(match[1]),
  );
}

function usesBoundaryDriftVocabulary(text) {
  return /\b(?:allowList|allowedFiles|allowedFile|whitelist|whiteList|exception|exceptions|exempt|exempts)\b/i.test(text);
}

function usesContentIdentityBoundary(text) {
  return /\.text\.includes\(\s*['"][A-Za-z0-9_./-]*(?:App|View|Editor|Window|Content|\.vue)[A-Za-z0-9_./-]*['"]\s*\)/.test(text);
}
