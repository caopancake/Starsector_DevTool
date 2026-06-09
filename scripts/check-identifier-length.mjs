import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import ts from 'typescript';

const maxIdentifierLength = 35;
const ignoredDirs = new Set(['.git', 'dist', 'node_modules', 'release', 'target']);
const sourceExtensions = new Set(['.ts', '.vue', '.rs']);

const root = process.cwd();
const files = await collectSourceFiles(root, root);
const failures = [];

for (const filePath of files) {
  const rel = normalizePath(relative(root, filePath));
  if (isTestPath(rel)) continue;
  const text = await readFile(filePath, 'utf8');
  if (rel.endsWith('.rs')) {
    checkRustFile(rel, text, failures);
  } else if (rel.endsWith('.vue')) {
    for (const block of vueScriptBlocks(text)) checkTypeScript(rel, block, failures);
  } else {
    checkTypeScript(rel, text, failures);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Identifier length check passed: variables and functions <= ${maxIdentifierLength} characters.`);

async function collectSourceFiles(rootDir, dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...(await collectSourceFiles(rootDir, path)));
      continue;
    }
    const extension = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    const rel = normalizePath(relative(rootDir, path));
    if (sourceExtensions.has(extension) && (rel.startsWith('src/') || rel.startsWith('src-tauri/src/'))) files.push(path);
  }
  return files;
}

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function isTestPath(rel) {
  return /(^|\/)(?:__tests__|tests)(?:\/|$)|[.-](?:test|spec)\.(?:ts|vue|rs)$|_test\.rs$/.test(rel);
}

function vueScriptBlocks(text) {
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

function checkTypeScript(rel, text, output) {
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  visit(source);

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

function checkBindingName(rel, name, kind, output) {
  if (ts.isIdentifier(name)) {
    checkIdentifier(rel, name.text, kind, output);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) checkBindingName(rel, element.name, kind, output);
  }
}

function checkRustFile(rel, text, output) {
  const production = stripRustTestBlocks(text);
  const clean = stripCommentsAndStrings(production);
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

function stripRustTestBlocks(text) {
  let output = text;
  const marker = '#[cfg(test)]';
  let index = output.indexOf(marker);
  while (index !== -1) {
    const blockStart = output.indexOf('{', index);
    if (blockStart === -1) break;
    let depth = 0;
    let end = blockStart;
    for (; end < output.length; end += 1) {
      const char = output[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    output = `${output.slice(0, index)}${output.slice(end)}`;
    index = output.indexOf(marker);
  }
  return output;
}

function stripCommentsAndStrings(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n\r]*/g, ' ')
    .replace(/r#*"[\s\S]*?"#*/g, '""')
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''");
}

function rustPatternIdentifiers(pattern) {
  return identifiers(pattern).filter((name) => !rustIgnoredNames().has(name));
}

function rustFunctionParamLists(text) {
  const lists = [];
  for (const match of text.matchAll(/\bfn\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*<[^>{;]*>)?\s*\(/g)) {
    const start = match.index + match[0].length - 1;
    const end = matchingParenIndex(text, start);
    if (end > start) lists.push(text.slice(start + 1, end));
  }
  return lists;
}

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

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ('([{<'.includes(char)) depth += 1;
    if (')]}>'.includes(char)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

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

function identifiers(text) {
  return [...text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)].map((match) => match[0]);
}

function rustIgnoredNames() {
  return new Set(['mut', 'ref', 'self', 'Self', '_']);
}

function checkIdentifier(rel, name, kind, output) {
  const normalized = name.replace(/^_+/, '');
  if (normalized.length > maxIdentifierLength) {
    output.push(`${rel}: ${kind} "${name}" exceeds ${maxIdentifierLength} characters`);
  }
}
