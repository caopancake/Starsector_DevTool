import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import { replayNextFileHistoryEntry } from '@/orchestrators/file-history-replay.orchestrator';
import { useProjectStore } from '@/stores/project.store';
import { useTablesEditHistoryStore } from '@/stores/tables-edit-history.store';
import { useTablesStore } from '@/stores/tables.store';

export async function undoMainWindow(message: MessageApiInjection, dialog: DialogApiInjection) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canUndoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.undoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      message.error('撤销 CSV 编辑失败');
    }
    return;
  }

  replayNextFileHistoryEntry('undo', project, tables, message, dialog);
}

export async function redoMainWindow(message: MessageApiInjection, dialog: DialogApiInjection) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canRedoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.redoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      message.error('重做 CSV 编辑失败');
    }
    return;
  }

  replayNextFileHistoryEntry('redo', project, tables, message, dialog);
}
