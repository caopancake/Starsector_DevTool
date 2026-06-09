import { watch } from 'vue';
import { cell, formatModVersion } from '@/shared/lib/starsector';
import type { PersistedMod, ProjectManifest } from '@/shared/types';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { formatLoadWarnings } from '@/domain/project/load-warnings';
import { hydrateOpenedModRuntime, openModProjectManifest } from '@/orchestrators/directory-opening.orchestrator';
import { measurePerformance } from '@/services/performance.service';
import { scanDirectoryGameOverview } from '@/services/session.service';
import { loadPersistedWorkspace, savePersistedWorkspace } from '@/services/workspace-state.service';

interface RestoreWorkspaceOptions {
  knownStarsectorRoot: string | null;
  loadCoreFields?: () => void | Promise<void>;
  onModRestoreError: (modRoot: string, displayName: string, error: unknown) => void | Promise<void>;
  onModRestoreWarnings?: (displayName: string, warnings: string[]) => void;
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
      saveTimer = window.setTimeout(() => void savePersistedWorkspace(state), 500);
    },
    { deep: true },
  );

  return {
    beginRestore() {
      restoring = true;
    },
    async finishRestore(persist = true) {
      restoring = false;
      if (persist) await savePersistedWorkspace(workspace.toPersistedState());
    },
    stop() {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      stop();
    },
  };
}

export async function restorePersistedWorkspace(options: RestoreWorkspaceOptions) {
  const workspace = useWorkspaceStore();
  const persisted = await loadPersistedWorkspace();
  if (persisted.mods.length === 0 && !persisted.starsectorRoot) return;

  workspace.applyPersistedWorkspaceSnapshot(persisted);
  if (persisted.starsectorRoot) {
    const overview = await scanDirectoryGameOverview(persisted.starsectorRoot);
    workspace.setGameOverview(overview);
  }

  for (const mod of persisted.mods) {
    try {
      const loaded = await restorePersistedModProject(mod, persisted.starsectorRoot ?? options.knownStarsectorRoot);
      const name = cell(loaded.modInfo?.name) || mod.displayName;
      const version = formatModVersion(loaded.modInfo?.version) || mod.version;
      workspace.updateModInfo(mod.modRoot, name, version);
      workspace.updateModStatus(mod.modRoot, 'ready');
      const warnings = formatLoadWarnings(loaded);
      if (warnings.length > 0) {
        options.onModRestoreWarnings?.(name, warnings);
      }
    } catch (error) {
      await options.onModRestoreError(mod.modRoot, mod.displayName || mod.modRoot, error);
    }
  }

  workspace.showOverview();
  await options.loadCoreFields?.();
}

export type WorkspacePersistenceWatcher = ReturnType<typeof watchWorkspacePersistence>;

async function restorePersistedModProject(mod: PersistedMod, starsectorRoot: string | null): Promise<ProjectManifest> {
  const loaded = await openModProjectManifest(mod.modRoot, starsectorRoot);
  measurePerformance('frontend.hydrateDirectoryOpenedModRuntime', { modRoot: mod.modRoot, activate: false }, () =>
    hydrateOpenedModRuntime(mod.modRoot, loaded, false),
  );
  return loaded;
}
