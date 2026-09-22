import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { collectRepoPaths } from './shared/files.mjs';
import { productionRustSource, splitTopLevel } from './shared/rust-source.mjs';

const maxIdentifierLength = 35;
const sourceExtensions = new Set(['.ts', '.vue', '.rs']);

const root = process.cwd();
const files = await collectRepoPaths(
  root,
  (rel, extension) => sourceExtensions.has(extension) && (rel.startsWith('src/') || rel.startsWith('src-tauri/src/')),
);
/** @type {string[]} */
const failures = [];

for (const file of files) {
  if (isTestPath(file.rel)) continue;
  const text = await readFile(file.path, 'utf8');
  if (file.rel.endsWith('.rs')) {
    checkRustFile(file.rel, text, failures);
  } else if (file.rel.endsWith('.vue')) {
    for (const block of vueScriptBlocks(text)) checkTypeScript(file.rel, block, failures);
  } else {
    checkTypeScript(file.rel, text, failures);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}

console.log(`Identifier length check passed: variables and functions <= ${maxIdentifierLength} characters.`);

/** @param {string} rel @returns {boolean} */
function isTestPath(rel) {
  return /(^|\/)(?:__tests__|tests)(?:\/|$)|[.-](?:test|spec)\.(?:ts|vue|rs)$|_test\.rs$/.test(rel);
}

/** @param {string} text @returns {string[]} */
function vueScriptBlocks(text) {
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

/** @param {string} rel @param {string} text @param {string[]} output @returns {void} */
function checkTypeScript(rel, text, output) {
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  visit(source);

  /** @param {import('typescript').Node} node */
  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      checkBindingName(rel, node.name, 'variable', output);
    } else if (ts.isParameter(node)) {
      checkBindingName(rel, node.name, 'variable', output);
    } else if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
      checkIdentifier(rel, node.name.text, 'function', output);
    } else if (
      (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) &&
      ts.isIdentifier(node.name)
    ) {
      checkIdentifier(rel, node.name.text, 'function', output);
    }
    ts.forEachChild(node, visit);
  }
}

/** @param {string} rel @param {import('typescript').BindingName} name @param {string} kind @param {string[]} output @returns {void} */
function checkBindingName(rel, name, kind, output) {
  if (ts.isIdentifier(name)) {
    checkIdentifier(rel, name.text, kind, output);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) checkBindingName(rel, element.name, kind, output);
  }
}

/** @param {string} rel @param {string} text @param {string[]} output @returns {void} */
function checkRustFile(rel, text, output) {
  const clean = productionRustSource(text);
  for (const match of clean.matchAll(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    checkIdentifier(rel, match[1], 'function', output);
  }
  for (const match of clean.matchAll(/\blet\s+(?:mut\s+)?([^=;]+?)(?::|=|;)/g)) {
    for (const name of rustPatternIdentifiers(match[1])) checkIdentifier(rel, name, 'variable', output);
  }
  for (const params of rustFunctionParamLists(clean)) {
    for (const name of rustParamIdentifiers(params)) checkIdentifier(rel, name, 'variable', output);
  }
}

/** @param {string} pattern @returns {string[]} */
function rustPatternIdentifiers(pattern) {
  return identifiers(pattern).filter((name) => !rustIgnoredNames().has(name));
}

/** @param {string} text @returns {string[]} */
function rustFunctionParamLists(text) {
  const lists = [];
  for (const match of text.matchAll(/\bfn\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*<[^>{;]*>)?\s*\(/g)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    const end = matchingParenIndex(text, start);
    if (end > start) lists.push(text.slice(start + 1, end));
  }
  return lists;
}

/** @param {string} params @returns {string[]} */
function rustParamIdentifiers(params) {
  const names = [];
  for (const param of splitTopLevel(params)) {
    const colon = param.indexOf(':');
    if (colon <= 0) continue;
    for (const name of identifiers(param.slice(0, colon))) {
      if (!rustIgnoredNames().has(name) && name !== 'self') names.push(name);
    }
  }
  return names;
}

/** @param {string} text @param {number} openIndex @returns {number} */
function matchingParenIndex(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** @param {string} text @returns {string[]} */
function identifiers(text) {
  return [...text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)].map((match) => match[0]);
}

/** @returns {Set<string>} */
function rustIgnoredNames() {
  return new Set(['mut', 'ref', 'self', 'Self', '_']);
}

/** @param {string} rel @param {string} name @param {string} kind @param {string[]} output @returns {void} */
function checkIdentifier(rel, name, kind, output) {
  const normalized = name.replace(/^_+/, '');
  if (normalized.length > maxIdentifierLength) {
    output.push(`${rel}: ${kind} "${name}" exceeds ${maxIdentifierLength} characters`);
  }
}
