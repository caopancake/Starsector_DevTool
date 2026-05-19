export const csvColumnSchemaBoundaryRule = {
  name: 'csv-column-schema-boundary',
  check(files) {
    const failures = [];
    const store = files.find((file) => file.rel === 'src/stores/tables.store.ts');
    const schema = files.find((file) => file.rel === 'src/domain/tables/csv-column-schema.ts');
    if (!store || !schema) return failures;

    const tableKeys = stringArrayFromConst(store.text, 'TABLE_KEYS');
    const schemaAssets = new Set(
      files
        .map((file) => file.rel)
        .filter((rel) => rel.startsWith('schemas/csv/') && rel.endsWith('.columns.json'))
        .map((rel) => rel.slice('schemas/csv/'.length, -'.columns.json'.length)),
    );
    const registeredAssets = registeredCsvSchemaKeys(schema.text);
    for (const key of tableKeys) {
      if (!schemaAssets.has(key)) {
        failures.push(`schemas/csv/${key}.columns.json: missing CSV column schema asset for table ${key}`);
      }
      if (!registeredAssets.has(key)) {
        failures.push(`src/domain/tables/csv-column-schema.ts: missing CSV column schema registration for table ${key}`);
      }
    }
    for (const key of schemaAssets) {
      if (!tableKeys.includes(key)) {
        failures.push(`schemas/csv/${key}.columns.json: CSV column schema asset has no TABLE_KEYS entry`);
      }
    }
    return failures;
  },
};

function stringArrayFromConst(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

function registeredCsvSchemaKeys(text) {
  const match = text.match(/const\s+CSV_COLUMN_SCHEMAS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!match) return new Set();
  return new Set([...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((item) => item[1]));
}
