import { onMounted, onUnmounted } from 'vue';

export function useEditorShortcuts(handlers: { undo: () => void; redo: () => void }) {
  function onKey(event: KeyboardEvent) {
    if ((event.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return;
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      handlers.undo();
    }
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      handlers.redo();
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));

  return { onKey };
}
