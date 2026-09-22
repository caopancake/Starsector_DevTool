export function cratePaths(text, moduleRelPath = '') {
  const moduleParts = modulePartsFromRel(moduleRelPath);
  const code = text.replace(/pub\(in\s+crate::[A-Za-z0-9_:]+\)/g, 'pub');
  const paths = [];
  for (const match of code.matchAll(/\buse\s+(crate|super|self)::([^;]+);/g)) {
    paths.push(...expandUseTree(match[2]).map((item) => resolveParts(moduleParts, [match[1], ...item])));
  }
  for (const match of code.matchAll(/\b(crate|super|self)::([A-Za-z0-9_:]+)/g)) {
    paths.push(resolveParts(moduleParts, [match[1], ...match[2].split('::').filter(Boolean)]));
  }
  return paths.filter((path) => path.length > 0);
}

export function modulePartsFromRel(rel) {
  return rel
    .replace(/^src-tauri\/src\//, '')
    .replace(/\.rs$/, '')
    .replace(/(^|\/)mod$/, '')
    .split('/')
    .filter(Boolean);
}

function resolveParts(moduleParts, parts) {
  const resolved = [...moduleParts];
  for (const part of parts) {
    if (part === 'crate') {
      resolved.length = 0;
    } else if (part === 'super') {
      resolved.pop();
    } else if (part === 'self') {
      continue;
    } else {
      resolved.push(part);
    }
  }
  return resolved;
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
    .filter((part) => part !== '*')
    .map((part) => part.replace(/\s+as\s+[A-Za-z0-9_]+$/, ''));
}
