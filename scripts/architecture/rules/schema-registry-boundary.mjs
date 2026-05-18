const schemaImportPattern = /import\s+([A-Za-z0-9_]+)\s+from\s+['"][^'"]*\/schemas\/([^'"]+\.schema\.json)['"]/g;
const schemaRegistryEntryPattern = /(?:['"][^'"]+['"]|[A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_]+)\s+as\s+unknown\s+as\s+FileSchema/g;

export const schemaRegistryBoundaryRule = {
  name: 'schema-registry-boundary',
  check(files) {
    const failures = [];
    const schemaFiles = files
      .map((file) => file.rel)
      .filter((rel) => rel.startsWith('schemas/') && rel.endsWith('.schema.json'))
      .map((rel) => rel.slice('schemas/'.length));
    const service = files.find((file) => file.rel === 'src/domain/schema/schema-registry.ts');
    if (!service) {
      failures.push('src/domain/schema/schema-registry.ts: schema registry file is missing');
      return failures;
    }
    const imports = new Map([...service.text.matchAll(schemaImportPattern)].map((match) => [match[2], match[1]]));
    const registeredImportNames = new Set([...service.text.matchAll(schemaRegistryEntryPattern)].map((match) => match[1]));

    for (const schemaFile of schemaFiles) {
      const importName = imports.get(schemaFile);
      if (!importName) {
        failures.push(`schemas/${schemaFile}: schema file must be imported by schema registry`);
      } else if (!registeredImportNames.has(importName)) {
        failures.push(`schemas/${schemaFile}: schema file import must be registered in SCHEMAS`);
      }
    }
    for (const schemaFile of imports.keys()) {
      if (!schemaFiles.includes(schemaFile)) {
        failures.push(`src/domain/schema/schema-registry.ts: registered schema file schemas/${schemaFile} does not exist`);
      }
    }
    return failures;
  },
};
