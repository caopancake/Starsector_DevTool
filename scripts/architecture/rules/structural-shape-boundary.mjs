import { frontendFile, rustFile, singleFileByRel } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

const settingsFields = ['theme', 'accent', 'customAccent', 'historyLimit', 'editMode', 'starsectorRoot'];

export const structuralShapeBoundaryRule = {
  name: 'structural-shape-boundary',
  check(files) {
    const failures = [];
    const mainEntry = singleFileByRel(files, 'src/main.ts');
    checkDuplicateTypeShapes(files, failures);
    for (const file of files) {
      if (frontendFile(file.rel)) checkFrontendRuntimeContext(file, mainEntry, failures);
      if (rustFile(file.rel)) checkRustConfigTemplates(file, failures);
    }
    return failures;
  },
};

function checkDuplicateTypeShapes(files, failures) {
  const declarations = files.flatMap((file) => extractTypeShapes(file));
  const groups = new Map();
  for (const declaration of declarations) {
    const group = groups.get(declaration.shape) ?? [];
    group.push(declaration);
    groups.set(declaration.shape, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    failures.push(`Duplicate structural type shape: ${group.map((item) => `${item.rel}:${item.name}`).join(', ')}`);
  }
}

function extractTypeShapes(file) {
  if (frontendFile(file.rel)) return extractTsTypeShapes(file);
  if (rustFile(file.rel)) return extractRustStructShapes(file);
  return [];
}

function extractTsTypeShapes(file) {
  const declarations = [];
  const matches = file.text.matchAll(/export\s+interface\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g);
  for (const match of matches) {
    const fields = [...match[2].matchAll(/^\s*([A-Za-z0-9_]+)\??:\s*([^;\n]+);/gm)].map((field) => [field[1], normalizeTsType(field[2])]);
    if (fields.length >= 3) declarations.push({ rel: file.rel, name: match[1], shape: shapeKey(fields) });
  }
  return declarations;
}

function extractRustStructShapes(file) {
  const declarations = [];
  const matches = file.text.matchAll(/pub\s+struct\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g);
  for (const match of matches) {
    const fields = [...match[2].matchAll(/^\s*pub\s+([A-Za-z0-9_]+):\s*([^,\n]+),/gm)].map((field) => [
      field[1],
      normalizeRustType(field[2]),
    ]);
    if (fields.length >= 3) declarations.push({ rel: file.rel, name: match[1], shape: shapeKey(fields) });
  }
  return declarations;
}

function shapeKey(fields) {
  return fields
    .map(([name, type]) => `${name}:${type}`)
    .sort()
    .join('|');
}

function normalizeTsType(type) {
  return type.replace(/\s+/g, ' ').trim();
}

function normalizeRustType(type) {
  return type.replace(/\s+/g, ' ').trim();
}

function checkFrontendRuntimeContext(file, mainEntry, failures) {
  for (const imported of importedProjectPaths(file)) {
    if (imported.importedName === 'loadSettings' && imported.resolved === 'src/services/app-config.service' && file !== mainEntry) {
      failures.push(`${file.rel}: app settings may be loaded only by main bootstrap; windows must receive settings from opener context`);
    }
  }
  if (declaresSettingsShape(file.text) && !/export\s+interface\s+AppSettings\b/.test(file.text)) {
    failures.push(`${file.rel}: app settings shape must not be redeclared; use AppSettings directly`);
  }
  if (constructsHardcodedSettingsTemplate(file.text)) {
    failures.push(`${file.rel}: hardcoded app settings templates are forbidden; pass AppSettings from runtime context`);
  }
}

function checkRustConfigTemplates(file, failures) {
  if (!/AppSettings\s*\{\s*(?:\n\s*)?theme\s*:/.test(file.text)) return;
  failures.push(`${file.rel}: Rust AppSettings templates must not be duplicated; use AppSettings::default() or pass AppSettings through`);
}

function declaresSettingsShape(text) {
  return settingsFields.every((field) => new RegExp(`\\b${field}\\s*:\\s*(?:string|number)\\b`).test(text));
}

function constructsHardcodedSettingsTemplate(text) {
  const withoutTypeBodies = text.replace(/export\s+interface\s+AppSettings\s*\{[\s\S]*?\n\}/g, '');
  const objectTemplates = withoutTypeBodies.match(/\{[\s\S]*?\}/g) ?? [];
  return objectTemplates.some((body) => {
    if (!settingsFields.every((field) => new RegExp(`\\b${field}\\s*:`).test(body))) return false;
    return /theme\s*:\s*['"]|accent\s*:\s*['"]|customAccent\s*:\s*['"]|historyLimit\s*:\s*\d|editMode\s*:\s*['"]/.test(body);
  });
}
