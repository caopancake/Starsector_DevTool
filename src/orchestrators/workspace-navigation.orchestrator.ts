import type { ConfigView, TableKey } from '@/shared/types';
import { useEditorsStore } from '@/stores/editors.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';

function syncActiveModRuntime(modRoot: string) {
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  const manifest = project.getManifest(modRoot);

  project.setActiveModRoot(modRoot);
  tables.activateFor(modRoot, manifest);
  editors.activateFor(modRoot);
  fileHistory.activateFor(modRoot);
}

export function navigateToModOverview(modRoot: string) {
  const workspace = useWorkspaceStore();
  if (!workspace.mods.has(modRoot)) return;
  syncActiveModRuntime(modRoot);
  workspace.activateModOverview(modRoot);
}

export function navigateToModTable(modRoot: string, tab: TableKey) {
  const workspace = useWorkspaceStore();
  const tables = useTablesStore();
  if (!workspace.mods.has(modRoot)) return;
  if (isActiveTableTarget(modRoot, tab)) return;
  syncActiveModRuntime(modRoot);
  tables.switchTab(tab);
  workspace.activateModTable(modRoot);
}

export function navigateToModConfig(modRoot: string, view: ConfigView) {
  const workspace = useWorkspaceStore();
  if (!workspace.mods.has(modRoot)) return;
  syncActiveModRuntime(modRoot);
  workspace.activateModConfig(modRoot, view);
}

export function activateModTab(modRoot: string) {
  const workspace = useWorkspaceStore();
  if (!workspace.mods.has(modRoot)) return;
  syncActiveModRuntime(modRoot);
  workspace.activateModTab(modRoot);
}

function isActiveTableTarget(modRoot: string, tab: TableKey): boolean {
  const workspace = useWorkspaceStore();
  const project = useProjectStore();
  const tables = useTablesStore();
  return (
    workspace.activeModRoot === modRoot &&
    workspace.currentView === 'table' &&
    project.activeModRoot === modRoot &&
    tables.activeModRoot === modRoot &&
    tables.currentTab === tab
  );
}
