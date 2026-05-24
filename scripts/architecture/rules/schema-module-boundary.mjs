import { frontendFile } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const schemaModuleBoundaryRule = {
  name: 'schema-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      if (isSchemaFieldRenderer(file.rel) && !/\bsettings\.isPlainEditMode\b|\bplainMode\b/.test(file.text)) {
        failures.push(`${file.rel}: schema field rendering must cover plain text and enhanced edit modes`);
      }
      if (isSchemaRenderer(file.rel) && /\bresolveSource\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: schema sources must use session source query, not local source resolution`);
      }
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        if (isSchemaRenderer(file.rel) && /^src\/shared\/api\//.test(imported.resolved)) {
          failures.push(`${file.rel}: schema rendering must not call shared/api directly`);
        }
      }
      if (/schemas\/.*\.schema\.json/.test(file.text) && /const\s+\w+Schema\s*=/.test(file.text)) {
        failures.push(`${file.rel}: schema definitions must live in schema file assets`);
      }
    }
    return failures;
  },
};

function isSchemaRenderer(path) {
  return /^src\/app\/components\/schema\//.test(path);
}

function isSchemaFieldRenderer(path) {
  return /^src\/app\/components\/schema\/SchemaFieldRenderer\.vue$/.test(path);
}
