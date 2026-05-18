import { importedProjectPaths } from '../shared/imports.mjs';

const allowedFeatureImports = new Map([
  ['src/features/config/components/ConfigWorkspace.vue', ['workspace']],
  ['src/features/config/components/FactionEditor.vue', ['project', 'schema']],
  ['src/features/config/components/FactionEntityList.vue', ['project']],
  ['src/features/config/components/FileHistoryView.vue', ['file-history', 'project', 'tables']],
  ['src/features/config/components/MissionEditor.vue', ['project', 'schema']],
  ['src/features/config/components/MissionEntityList.vue', ['project']],
  ['src/features/config/components/ModInfoEditor.vue', ['project', 'schema']],
  ['src/features/config/components/ModOverview.vue', ['project']],
  ['src/features/config/components/SkinEditor.vue', ['project', 'schema']],
  ['src/features/config/components/SkinEntityList.vue', ['project', 'schema']],
  ['src/features/config/components/VariantEditor.vue', ['project', 'schema']],
  ['src/features/config/components/VariantEntityList.vue', ['project', 'schema']],
  ['src/features/config/config-save-orchestrator.ts', ['file-history']],
  ['src/features/config/config-service.ts', ['project']],
  ['src/features/editors/composables/use-sprite-upload.ts', ['file-history']],
  ['src/features/editors/editor-window.ts', ['windowing']],
  ['src/features/file-history/file-history-replay-service.ts', ['project', 'tables', 'windowing']],
  ['src/features/file-history/file-save-orchestrator.ts', ['project', 'windowing']],
  ['src/features/schema/composables/use-core-graphics.ts', ['project']],
  ['src/features/schema/composables/use-core-schema.ts', ['project']],
  ['src/features/tables/table-save-orchestrator.ts', ['file-history']],
  ['src/features/undo-redo/main-undo-redo-service.ts', ['file-history', 'project', 'tables']],
  ['src/features/windowing/window-events.ts', ['editors']],
  ['src/features/windowing/window-save-events.ts', ['editors', 'file-history']],
  ['src/features/workspace/file-editor-window.ts', ['windowing']],
  ['src/features/workspace/open-directory-service.ts', ['editors', 'file-history', 'project', 'tables']],
  ['src/features/workspace/workspace-persistence.ts', ['schema']],
  ['src/features/workspace/workspace-shell-actions.ts', ['editors', 'file-history', 'project', 'tables', 'undo-redo', 'windowing']],
]);

export const featureBoundaryRule = {
  name: 'feature-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      const owner = featureName(file.rel);
      if (!owner) continue;
      const allowed = allowedFeatureImports.get(file.rel) ?? [];
      for (const imported of importedProjectPaths(file)) {
        if (imported.typeOnly) continue;
        const target = featureName(imported.resolved);
        if (target && target !== owner && !allowed.includes(target)) {
          failures.push(`${file.rel}: feature ${owner} must not directly depend on feature ${target}`);
        }
      }
    }
    return failures;
  },
};

function featureName(path) {
  const match = path.match(/^src\/features\/([^/]+)\//);
  return match?.[1] ?? null;
}
