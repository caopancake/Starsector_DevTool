import { frontendFile } from '../shared/files.mjs';
import { classifyFrontendPath } from '../shared/classify.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const schemaModuleBoundaryRule = {
  name: 'schema-module-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (isSchemaFieldRenderer(file.text, current) && !/\bsettings\.isPlainEditMode\b|\bplainMode\b/.test(file.text)) {
        failures.push(`${file.rel}: schema field rendering must cover plain text and enhanced edit modes`);
      }
      if (isSchemaComponent(current) && /\bresolveSource\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: schema sources must use session source query, not local source resolution`);
      }
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = classifyFrontendPath(imported.resolved);
        if (isSchemaComponent(current) && target.role === 'api') {
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

function isSchemaComponent(current) {
  return current.layer === 'app' && current.role === 'component' && current.domain === 'schema';
}

function isSchemaFieldRenderer(text, current) {
  return isSchemaComponent(current) && /\bfield\s*:\s*FieldSchema\b/.test(text);
}
