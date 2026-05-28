import type { ConfigView, TableKey } from '@/shared/types';
import { useEditorsStore } from '@/stores/editors.store';
import { useFileHistoryStore } from '@/stores/file-history.store';
import { useProjectStore } from '@/stores/project.store';
import { useTablesStore } from '@/stores/tables.store';
import { useWorkspaceStore } from '@/stores/workspace.store';

function activateWorkspaceMod(modRoot: string) {
  const workspace = useWorkspaceStore();
  const project = useProjectStore();
  const tables = useTablesStore();
  const editors = useEditorsStore();
  const fileHistory = useFileHistoryStore();
  const manifest = project.getManifest(modRoot);

  workspace.activeModRoot = modRoot;
  project.setActiveModRoot(modRoot);
  tables.activateFor(modRoot, manifest);
  editors.activateFor(modRoot);
  fileHistory.activateFor(modRoot);
}

export function navigateToModOverview(modRoot: string) {
  const workspace = useWorkspaceStore();
  if (!workspace.mods.has(modRoot)) return;
  activateWorkspaceMod(modRoot);
  workspace.currentView = 'config';
  workspace.configView = 'mod-overview';
}

export function navigateToModTable(modRoot: string, tab: TableKey) {
  const workspace = useWorkspaceStore();
  const tables = useTablesStore();
  if (!workspace.mods.has(modRoot)) return;
  activateWorkspaceMod(modRoot);
  workspace.currentView = 'table';
  tables.switchTab(tab);
}

export function navigateToModConfig(modRoot: string, view: ConfigView) {
  const workspace = useWorkspaceStore();
  if (!workspace.mods.has(modRoot)) return;
  activateWorkspaceMod(modRoot);
  workspace.currentView = 'config';
  workspace.configView = view;
}
