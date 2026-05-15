import { onMounted, onUnmounted, type Ref } from 'vue';

type ShortcutHandlers = {
  redo: () => void;
  undo: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  scope?: Ref<HTMLElement | undefined>;
};

function shouldIgnoreShortcut(event: KeyboardEvent, scope?: HTMLElement) {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (scope && !scope.contains(target)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  return Boolean(target.closest('input, textarea, select'));
}

export function useEditorShortcuts(handlers: ShortcutHandlers) {
  function onKey(event: KeyboardEvent) {
    if (shouldIgnoreShortcut(event, handlers.scope?.value)) return;
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      handlers.undo();
      return;
    }
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      handlers.redo();
      return;
    }
    if (!event.ctrlKey && !event.altKey && !event.metaKey) handlers.onKeyDown?.(event);
  }

  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));

  return { onKey };
}
