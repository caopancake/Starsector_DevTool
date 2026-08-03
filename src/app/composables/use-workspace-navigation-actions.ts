import * as workspaceNavigation from '@/orchestrators/workspace-navigation.orchestrator';
import { useDraftTransitionConfirmation } from '@/app/composables/use-draft-transition-confirmation';
import { useWorkspaceStore } from '@/stores/workspace.store';
import type { ConfigView, TableKey } from '@/shared/types';

export function useWorkspaceNavigationActions() {
  const workspace = useWorkspaceStore();
  const { confirmDraftTransition } = useDraftTransitionConfirmation();

  function navigateToModOverview(modRoot: string): void {
    confirmNavigation({ modRoot, view: 'overview' }, () => workspaceNavigation.navigateToModOverview(modRoot));
  }

  function navigateToModTable(modRoot: string, table: TableKey): void {
    confirmNavigation({ modRoot, view: 'table' }, () => workspaceNavigation.navigateToModTable(modRoot, table));
  }

  function navigateToModConfig(modRoot: string, configView: ConfigView): void {
    if (workspace.activeModRoot === modRoot && workspace.currentView === 'config' && workspace.configView === configView) return;
    confirmNavigation({ modRoot, view: 'config', configView }, () => workspaceNavigation.navigateToModConfig(modRoot, configView));
  }

  function showOverview(): void {
    confirmNavigation({ modRoot: null, view: 'overview' }, () => workspace.showOverview());
  }

  function showSettings(): void {
    confirmNavigation({ modRoot: null, view: 'settings' }, () => workspace.showSettings());
  }

  function showAbout(): void {
    confirmNavigation({ modRoot: null, view: 'about' }, () => workspace.showAbout());
  }

  function confirmNavigation(
    target: { configView?: ConfigView; modRoot: string | null; view: 'overview' | 'table' | 'config' | 'settings' | 'about' },
    action: () => void,
  ) {
    const activeModRoot = workspace.activeModRoot;
    const keepsActiveConfig =
      workspace.currentView === 'config' &&
      target.view === 'config' &&
      target.modRoot === activeModRoot &&
      target.configView === workspace.configView;
    if (keepsActiveConfig) {
      action();
      return;
    }
    confirmDraftTransition(activeModRoot, {
      title: '放弃未保存配置修改？',
      content: '当前配置有未保存修改，切换后这些修改将丢失。确认继续？',
      action,
    });
  }

  return {
    navigateToModConfig,
    navigateToModOverview,
    navigateToModTable,
    showAbout,
    showOverview,
    showSettings,
  };
}
