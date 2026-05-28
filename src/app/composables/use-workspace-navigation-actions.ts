import { navigateToModConfig, navigateToModOverview, navigateToModTable } from '@/orchestrators/workspace-navigation.orchestrator';

export function useWorkspaceNavigationActions() {
  return {
    navigateToModConfig,
    navigateToModOverview,
    navigateToModTable,
  };
}
