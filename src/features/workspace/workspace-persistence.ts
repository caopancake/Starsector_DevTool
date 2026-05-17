import { watch } from 'vue';
import { scanGameOverview } from '../../shared/api/project-api';
import { loadWorkspace, saveWorkspace } from '../../shared/api/workspace-api';
import { cell, formatModVersion } from '../../shared/lib/starsector';
import { useCoreSchema } from '../schema/composables/use-core-schema';
import { useWorkspaceStore } from './workspace-store';
import { restoreWorkspaceMod } from './open-directory-service';

interface RestoreWorkspaceOptions {
  fallbackStarsectorRoot: string | null;
  onModRestoreError: (modRoot: string, displayName: string, error: unknown) => void;
}

export function watchWorkspacePersistence() {
  const workspace = useWorkspaceStore();
  let saveTimer: number | null = null;
  let restoring = false;

  const stop = watch(
    () => workspace.toPersistedState(),
    (state) => {
      if (restoring) return;
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void saveWorkspace(state), 500);
    },
    { deep: true },
  );

  return {
    setRestoring(value: boolean) {
      restoring = value;
    },
    stop() {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      stop();
    },
  };
}

export async function restorePersistedWorkspace(options: RestoreWorkspaceOptions) {
  const workspace = useWorkspaceStore();
  const { loadCoreFields } = useCoreSchema();
  const persisted = await loadWorkspace();
  if (persisted.mods.length === 0 && !persisted.starsectorRoot) return;

  workspace.restoreFrom(persisted);
  if (persisted.starsectorRoot) {
    const overview = await scanGameOverview(persisted.starsectorRoot);
    workspace.setGameOverview(overview);
  }

  for (const mod of persisted.mods) {
    try {
      const loaded = await restoreWorkspaceMod(mod, persisted.starsectorRoot ?? options.fallbackStarsectorRoot);
      const name = cell(loaded.modInfo?.name) || mod.displayName;
      const version = formatModVersion(loaded.modInfo?.version) || mod.version;
      workspace.updateModInfo(mod.modRoot, name, version);
      workspace.updateModStatus(mod.modRoot, 'ready');
    } catch (error) {
      options.onModRestoreError(mod.modRoot, mod.displayName || mod.modRoot, error);
    }
  }

  if (persisted.activeModRoot && workspace.isModImported(persisted.activeModRoot)) {
    const activeMod = workspace.mods.get(persisted.activeModRoot);
    if (activeMod?.status === 'ready') {
      workspace.activeModRoot = persisted.activeModRoot;
    }
  }
  workspace.navigateTo('overview');
  loadCoreFields();
}

export type WorkspacePersistenceWatcher = ReturnType<typeof watchWorkspacePersistence>;
