import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import { h } from 'vue';
import { useFileHistoryStore } from '../file-history/file.history.store';
import { applyFileSaveHistoryEntry } from '../file-history/file.history.service';
import type { FileSaveHistoryEntry } from '../file-history/file.history.types';
import { useProjectStore } from '../project/project.store';
import { useTablesEditHistoryStore } from '../tables/tables.edit-history.store';
import { useTablesStore } from '../tables/tables.store';

export async function undoMainWindow(message: MessageApiInjection, dialog: DialogApiInjection) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const fileHistory = useFileHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canUndoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.undoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      message.error('撤销 CSV 编辑失败');
    }
    return;
  }

  const entry = fileHistory.peekFileUndo();
  if (!entry) return;
  confirmFileHistoryApply(dialog, entry, 'undo', async () => {
    try {
      await applyFileSaveHistoryEntry(entry, 'undo', project, tables);
      fileHistory.commitFileUndo(entry.id);
    } catch (error) {
      message.error(`撤销文件保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

export async function redoMainWindow(message: MessageApiInjection, dialog: DialogApiInjection) {
  const tables = useTablesStore();
  const csvEditHistory = useTablesEditHistoryStore();
  const fileHistory = useFileHistoryStore();
  const project = useProjectStore();
  const modRoot = project.activeModRoot ?? '';
  const table = tables.currentTab;

  if (csvEditHistory.canRedoCsvEdit(modRoot, table)) {
    if (!csvEditHistory.redoCsvEdit(modRoot, table, tables.getActiveModTableState())) {
      message.error('重做 CSV 编辑失败');
    }
    return;
  }

  const entry = fileHistory.peekFileRedo();
  if (!entry) return;
  confirmFileHistoryApply(dialog, entry, 'redo', async () => {
    try {
      await applyFileSaveHistoryEntry(entry, 'redo', project, tables);
      fileHistory.commitFileRedo(entry.id);
    } catch (error) {
      message.error(`重做文件保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

function confirmFileHistoryApply(
  dialog: DialogApiInjection,
  entry: FileSaveHistoryEntry,
  direction: 'undo' | 'redo',
  onConfirm: () => Promise<void>,
) {
  const action = direction === 'undo' ? '回退' : '重做';
  dialog.warning({
    title: `${action}文件级历史`,
    content: () => renderConfirmContent(entry, action),
    positiveText: action,
    negativeText: '取消',
    onPositiveClick: () => onConfirm(),
  });
}

function renderConfirmContent(entry: FileSaveHistoryEntry, action: string) {
  const paths = entry.changes.map((change) => change.path);
  return h('div', { class: 'file-history-confirm' }, [
    h('p', `${action}会直接写回磁盘。`),
    h('p', `历史记录：${entry.label}`),
    h('p', `涉及文件：${paths.length} 个`),
    h(
      'ul',
      { class: 'file-history-confirm-list' },
      paths.map((path) => h('li', { key: path }, path)),
    ),
  ]);
}
