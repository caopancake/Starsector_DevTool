import { frontendFile, singleFileByRel } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const schemaEditingBoundaryRule = {
  name: 'schema-editing-boundary',
  check(files) {
    const failures = [];
    const schemaFormRenderer = singleFileByRel(files, 'src/app/components/schema/SchemaFormRenderer.vue');
    if (!schemaFormRenderer) return failures;
    if (!importsJsonEditor(schemaFormRenderer) || !schemaFormRenderer.text.includes('extraKeys')) {
      failures.push(`${schemaFormRenderer.rel}: schema forms must preserve editable extra fields`);
    }
    for (const file of files) {
      if (!frontendFile(file.rel) || !importsSchemaRenderer(file, schemaFormRenderer.rel)) continue;
      if (containsSchemaSaveHandler(file.text) && !usesSchemaSourceSplit(file.text)) {
        failures.push(`${file.rel}: schema save flows must split/aggregate schema sources before saving`);
      }
    }
    return failures;
  },
};

function usesSchemaSourceSplit(text) {
  return text.includes('splitSchemaSources') || text.includes('aggregateSchemaSources') || text.includes('getSchema(');
}

function importsSchemaRenderer(file, rendererRel) {
  return importedProjectPaths(file).some((imported) => imported.resolved === rendererRel);
}

function importsJsonEditor(file) {
  return importedProjectPaths(file).some((imported) => imported.resolved === 'src/shared/ui/JsonFieldEditor.vue');
}

function containsSchemaSaveHandler(text) {
  return importedProjectPaths({ rel: 'src/app/schema-host.vue', text }).some(
    (imported) =>
      !imported.typeOnly &&
      (imported.resolved.includes('config-save.orchestrator') ||
        imported.resolved.includes('config.service') ||
        imported.resolved.includes('variants-api') ||
        imported.resolved.includes('skins-api')),
  );
}
