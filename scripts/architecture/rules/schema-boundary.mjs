const allowedSchemaFeatureImports = new Set([
  'src/features/schema/composables/use-core-graphics.ts',
  'src/features/schema/composables/use-core-schema.ts',
]);

export const schemaBoundaryRule = {
  name: 'schema-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (
        rel.startsWith('src/features/schema/') &&
        !allowedSchemaFeatureImports.has(rel) &&
        /\.\.\/(?:config|tables|file-history|editors|workspace)\//.test(text)
      ) {
        failures.push(`${rel}: schema feature must not depend on business feature save/editing modules`);
      }
    }
    return failures;
  },
};
