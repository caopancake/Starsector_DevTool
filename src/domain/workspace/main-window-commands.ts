export type MainWindowHistoryCommand = 'undo' | 'redo';

export function mainWindowCommandFromKeyEvent(event: KeyboardEvent): MainWindowHistoryCommand | null {
  if (isEditableKeyTarget(event.target)) return null;
  if (event.altKey) return null;
  if (!event.ctrlKey && !event.metaKey) return null;

  const key = event.key.toLowerCase();
  if (key === 'z' && !event.shiftKey) return 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  if (key === 'z' && event.shiftKey) return 'redo';
  return null;
}

export function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}
