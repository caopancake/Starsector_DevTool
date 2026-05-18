const allowedConfigComponentStoreImports = new Set([
  'src/features/config/components/ConfigWorkspace.vue',
  'src/features/config/components/FactionEditor.vue',
  'src/features/config/components/FactionEntityList.vue',
  'src/features/config/components/FileHistoryView.vue',
  'src/features/config/components/MissionEditor.vue',
  'src/features/config/components/MissionEntityList.vue',
  'src/features/config/components/ModInfoEditor.vue',
  'src/features/config/components/ModOverview.vue',
  'src/features/config/components/SkinEditor.vue',
  'src/features/config/components/SkinEntityList.vue',
  'src/features/config/components/VariantEditor.vue',
  'src/features/config/components/VariantEntityList.vue',
]);
const allowedConfigComponentStores = new Map([
  ['src/features/config/components/ConfigWorkspace.vue', ['workspace']],
  ['src/features/config/components/FactionEditor.vue', ['project', 'settings']],
  ['src/features/config/components/FactionEntityList.vue', ['project', 'settings']],
  ['src/features/config/components/FileHistoryView.vue', ['file-history', 'project', 'tables']],
  ['src/features/config/components/MissionEditor.vue', ['project', 'settings']],
  ['src/features/config/components/MissionEntityList.vue', ['project', 'settings']],
  ['src/features/config/components/ModInfoEditor.vue', ['config', 'project']],
  ['src/features/config/components/ModOverview.vue', ['project']],
  ['src/features/config/components/SkinEditor.vue', ['project']],
  ['src/features/config/components/SkinEntityList.vue', ['project']],
  ['src/features/config/components/VariantEditor.vue', ['project']],
  ['src/features/config/components/VariantEntityList.vue', ['project']],
]);

export const configComponentStoreBoundaryRule = {
  name: 'config-component-store-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (rel.startsWith('src/features/config/components/')) checkConfigComponentStoreImports(rel, text, failures);
    }
    return failures;
  },
};

function checkConfigComponentStoreImports(rel, text, failures) {
  const storeImports = [...text.matchAll(/import\s+\{[^}]*use([A-Za-z]+)Store[^}]*\}\s+from\s+['"]([^'"]+)['"]/g)];
  if (storeImports.length === 0) return;
  const allowedStores = allowedConfigComponentStores.get(rel) ?? [];
  if (!allowedConfigComponentStoreImports.has(rel)) {
    failures.push(`${rel}: config components with store imports must be explicitly listed in architecture checks`);
    return;
  }
  for (const match of storeImports) {
    const storeName = storeKey(match[1]);
    if (!allowedStores.includes(storeName)) {
      failures.push(`${rel}: config component imports unexpected ${storeName} store`);
    }
  }
}

function storeKey(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/^file-history$/i, 'file-history')
    .toLowerCase();
}
