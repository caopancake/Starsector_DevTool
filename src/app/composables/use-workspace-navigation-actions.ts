import * as workspaceNavigation from '@/orchestrators/workspace-navigation.orchestrator';
import { useDraftTransitionConfirmation } from '@/app/composables/use-draft-transition-confirmation';
import { useWorkspaceStore } from '@/stores/workspace.store';
import type { ConfigView, TableKey } from '@/shared/types';

export function useWorkspaceNavigationActions() {
  const workspace = useWorkspaceStore();
  const { confirmDraftTransition } = useDraftTransitionConfirmation();

  function navigateToModOverview(modRoot: string): void {
    confirmNavigation(() => workspaceNavigation.navigateToModOverview(modRoot));
  }

  function navigateToModTable(modRoot: string, table: TableKey): void {
    confirmNavigation(() => workspaceNavigation.navigateToModTable(modRoot, table));
  }

  function navigateToModConfig(modRoot: string, configView: ConfigView): void {
    if (workspace.activeModRoot === modRoot && workspace.currentView === 'config' && workspace.configView === configView) return;
    confirmNavigation(() => workspaceNavigation.navigateToModConfig(modRoot, configView));
  }

  function activateModTab(modRoot: string): void {
    if (workspace.activeModRoot === modRoot && workspace.isModView) return;
    confirmNavigation(() => workspaceNavigation.activateModTab(modRoot));
  }

  function showOverview(): void {
    confirmNavigation(() => workspace.showOverview());
  }

  function showSettings(): void {
    confirmNavigation(() => workspace.showSettings());
  }

  function showAbout(): void {
    confirmNavigation(() => workspace.showAbout());
  }

  function confirmNavigation(action: () => void) {
    confirmDraftTransition(workspace.activeModRoot, {
      title: '放弃未保存配置修改？',
      content: '当前配置有未保存修改，切换后这些修改将丢失。确认继续？',
      action,
    });
  }

  return {
    activateModTab,
    navigateToModConfig,
    navigateToModOverview,
    navigateToModTable,
    showAbout,
    showOverview,
    showSettings,
  };
}
