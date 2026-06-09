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
      if (current.layer === 'shared' && current.domain === 'types' && /\bSchemaRuntimeContext\b/.test(file.text)) {
        failures.push(`${file.rel}: SchemaRuntimeContext belongs to schema runtime domain, not shared wire types`);
      }
      if (isSchemaFieldRenderer(file.text, current)) {
        for (const token of [
          'querySourceOptions',
          'subscribeSourceOptionInvalidation',
          'sourceOptionsRequestId',
          'pickFileDialog',
          'pathBelongsToRoot',
          'relativePathFromRoot',
        ]) {
          if (new RegExp(`\\b${token}\\b`).test(file.text)) {
            failures.push(`${file.rel}: schema field renderer must delegate ${token} to schema runtime composables`);
          }
        }
      }
      if (isSchemaAssetRegistry(file.text, current)) {
        for (const name of exportedNames(file.text)) {
          if (name !== 'getSchema') {
            failures.push(`${file.rel}: schema registry must only export registry entry getSchema, found ${name}`);
          }
        }
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
        if (current.layer === 'domain' && current.domain === 'schema') {
          if (target.layer === 'app' || target.layer === 'stores' || target.layer === 'services' || target.role === 'api') {
            failures.push(`${file.rel}: schema domain must stay pure and cannot import ${imported.specifier}`);
          }
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

function isSchemaAssetRegistry(text, current) {
  return current.layer === 'domain' && current.domain === 'schema' && /schemas\/.*\.schema\.json/.test(text) && /\bgetSchema\b/.test(text);
}

function exportedNames(text) {
  const names = [];
  const pattern = /\bexport\s+(?:function|const|class|interface|type)\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) names.push(match[1]);
  return names;
}
