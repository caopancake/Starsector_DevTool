import { h } from 'vue';
import type { AppFeedback } from '@/shared/types';
import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';
import type { FileChangeReplayDirection } from '@/shared/types';
import { createFileReplayPlan, executeFileReplayPlan, type FileHistoryReplayPlan } from '@/orchestrators/file-history-session.orchestrator';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
export type FileHistoryReplayDirection = FileChangeReplayDirection;

export function replayNextFileUndo(project: ProjectStore, tables: TablesStore, feedback: AppFeedback) {
  return replayNextFileHistoryEntry('undo', project, tables, feedback);
}

export function replayNextFileRedo(project: ProjectStore, tables: TablesStore, feedback: AppFeedback) {
  return replayNextFileHistoryEntry('redo', project, tables, feedback);
}

function replayNextFileHistoryEntry(
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
  feedback: AppFeedback,
) {
  const plan = createFileReplayPlan(project, direction);
  if (!plan) return false;
  confirmFileHistoryReplay(feedback, plan, async () => {
    try {
      await executeFileReplayPlan(plan, project, tables);
      feedback.success(`文件历史已${plan.actionText}`);
    } catch (error) {
      feedback.error(error, `${plan.actionText}文件历史失败`);
    }
  });
  return true;
}

function confirmFileHistoryReplay(feedback: AppFeedback, plan: FileHistoryReplayPlan, onConfirm: () => Promise<void>) {
  feedback.confirmWarning({
    title: `${plan.actionText}文件历史`,
    content: () => renderConfirmContent(plan.entry, plan.actionText),
    actionText: plan.actionText,
    onConfirm,
  });
}

function renderConfirmContent(entry: FileSaveHistoryEntry, action: string) {
  const paths = historyEntryPaths(entry);
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

function historyEntryPaths(entry: FileSaveHistoryEntry): string[] {
  return entry.changes.map((change) => change.path);
}
