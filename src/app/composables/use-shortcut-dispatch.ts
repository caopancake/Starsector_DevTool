import { onMounted, onUnmounted } from 'vue';
import { isEditableKeyTarget, shortcutCommandFromKeyEvent, type ShortcutCommand } from '@/domain/workspace/main-window-commands';

export interface ShortcutDispatchHandlers {
  commands: Partial<Record<ShortcutCommand, () => void>>;
  // 纯键（无 Ctrl/Alt/Meta）表：输入框、文本域、下拉与可编辑元素内不触发；命中即阻止默认行为。
  keys?: Record<string, (event: KeyboardEvent) => void>;
  undoRedoInEditable?: boolean;
}

// 全仓唯一快捷键分发入口：命令解析在 domain（shortcutCommandFromKeyEvent），
// 本 composable 只做 window 监听、命令路由与纯键表分发。
export function useShortcutDispatch(handlers: ShortcutDispatchHandlers) {
  function onKeyDown(event: KeyboardEvent) {
    const command = shortcutCommandFromKeyEvent(event, { undoRedoInEditable: handlers.undoRedoInEditable });
    if (command) {
      const commandHandler = handlers.commands[command];
      if (commandHandler) {
        event.preventDefault();
        commandHandler();
      }
      return;
    }
    if (!handlers.keys || event.ctrlKey || event.altKey || event.metaKey) return;
    if (isEditableKeyTarget(event.target)) return;
    const keyHandler = handlers.keys[event.key.toLowerCase()];
    if (keyHandler) {
      event.preventDefault();
      keyHandler(event);
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
}
