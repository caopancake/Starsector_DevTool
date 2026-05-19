export function cratePaths(text) {
  const paths = [];
  for (const match of text.matchAll(/\buse\s+crate::([^;]+);/g)) {
    paths.push(...expandUseTree(match[1]));
  }
  for (const match of text.matchAll(/\bcrate::([A-Za-z0-9_:]+)/g)) {
    paths.push(match[1].split('::').filter(Boolean));
  }
  return paths.filter((path) => path.length > 0);
}

export function rustLayerForPath(rel) {
  if (rel.startsWith('src-tauri/src/commands/')) return 'commands';
  if (rel.startsWith('src-tauri/src/services/')) return 'services';
  if (rel.startsWith('src-tauri/src/domain/')) return 'domain';
  if (rel.startsWith('src-tauri/src/io/')) return 'io';
  if (rel.startsWith('src-tauri/src/parsers/')) return 'parsers';
  if (rel.startsWith('src-tauri/src/models/')) return 'models';
  return 'other';
}

export function rustLayerForCratePath(path) {
  const root = path[0] ?? '';
  if (root === 'commands') return 'commands';
  if (root === 'services') return 'services';
  if (root === 'domain') return 'domain';
  if (root === 'io') return 'io';
  if (root === 'parsers') return 'parsers';
  if (root === 'models') return 'models';
  return 'other';
}

function expandUseTree(source) {
  return splitTopLevel(source).flatMap((item) => expandUseItem(item.trim(), []));
}

function expandUseItem(item, prefix) {
  if (!item) return [];
  const brace = item.indexOf('{');
  if (brace < 0) return [pathParts([...prefix, item])];
  const before = item.slice(0, brace).replace(/::$/, '');
  const inner = item.slice(brace + 1, matchingBraceIndex(item, brace));
  const nextPrefix = before ? [...prefix, ...pathParts([before])] : prefix;
  return splitTopLevel(inner).flatMap((child) => expandUseItem(child.trim(), nextPrefix));
}

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function matchingBraceIndex(value, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    if (value[index] === '{') depth += 1;
    if (value[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return value.length;
}

function pathParts(parts) {
  return parts
    .join('::')
    .split('::')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== 'self' && part !== 'super')
    .map((part) => part.replace(/\s+as\s+[A-Za-z0-9_]+$/, ''));
}
