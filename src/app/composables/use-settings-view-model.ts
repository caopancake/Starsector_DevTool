import { computed, ref } from 'vue';
import { pickDirectoryDialog } from '@/shared/runtime/dialog.runtime';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { clearConfig, clearLog, loadLogStatus, openConfigFolder, openLogFile } from '@/services/app-config.service';
import { reloadCurrentWebviewWindow } from '@/windows/current.window';
import { useSettingsStore } from '@/stores/settings.store';

export function useSettingsViewModel() {
  const settings = useSettingsStore();
  const feedback = useAppFeedback();
  const logSizeBytes = ref(0);
  const logPath = ref('');
  const formattedLogSize = computed(() => formatBytes(logSizeBytes.value));
  const logPathHint = computed(() => (logPath.value ? `Log 文件: ${logPath.value}` : 'Log 文件尚未创建。'));

  async function pickStarsectorRoot() {
    const selected = await pickDirectoryDialog('选择 Starsector 安装目录');
    if (selected && typeof selected === 'string') {
      settings.setStarsectorRoot(selected);
    }
  }

  async function refreshLogStatus() {
    try {
      const status = await loadLogStatus();
      logSizeBytes.value = status.sizeBytes;
      logPath.value = status.path;
    } catch (error) {
      feedback.error(error, '读取 log 状态失败');
    }
  }

  async function openConfigFolderAction() {
    try {
      await openConfigFolder();
    } catch (error) {
      feedback.error(error, '打开配置文件夹失败');
    }
  }

  async function openLogFileAction() {
    try {
      await openLogFile();
      await refreshLogStatus();
    } catch (error) {
      feedback.error(error, '打开 log 文件失败');
    }
  }

  function confirmClearConfig() {
    feedback.confirmDanger({
      title: '清空配置文件',
      content: '将删除配置目录内除 log 文件外的工具配置文件。确认清空？',
      actionText: '清空',
      onConfirm: async () => {
        try {
          await clearConfig();
          await refreshLogStatus();
          feedback.success('配置文件已清空');
          await reloadCurrentWebviewWindow();
        } catch (error) {
          feedback.error(error, '清空配置文件失败');
        }
      },
    });
  }

  function confirmClearLog() {
    feedback.confirmDanger({
      title: '清除 log 文件',
      content: '将清空当前 log 文件内容。确认清除？',
      actionText: '清除',
      onConfirm: async () => {
        try {
          const status = await clearLog();
          logSizeBytes.value = status.sizeBytes;
          logPath.value = status.path;
          feedback.success('log 文件已清除');
        } catch (error) {
          feedback.error(error, '清除 log 文件失败');
        }
      },
    });
  }

  return {
    formattedLogSize,
    logPathHint,
    pickStarsectorRoot,
    refreshLogStatus,
    openConfigFolderAction,
    openLogFileAction,
    confirmClearConfig,
    confirmClearLog,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
