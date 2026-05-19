import type { AppFeedback } from '@/shared/types';
import { replayNextFileHistoryEntry } from '@/orchestrators/file-history-replay.orchestrator';
import { useProjectStore } from '@/stores/project.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';

export async function undoMainWindow(feedback: AppFeedback) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canUndoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.undoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      feedback.error('撤销 CSV 编辑失败');
    }
    return;
  }

  replayNextFileHistoryEntry('undo', project, tables, feedback);
}

export async function redoMainWindow(feedback: AppFeedback) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canRedoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.redoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      feedback.error('重做 CSV 编辑失败');
    }
    return;
  }

  replayNextFileHistoryEntry('redo', project, tables, feedback);
}
