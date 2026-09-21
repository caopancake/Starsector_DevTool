export type ShortcutCommand = 'undo' | 'redo' | 'save' | 'close';

export interface ShortcutKeyOptions {
  // 文本编辑表面需要在输入框内继续响应撤销/重做；其余表面默认豁免输入焦点。
  undoRedoInEditable?: boolean;
}

export function shortcutCommandFromKeyEvent(event: KeyboardEvent, options: ShortcutKeyOptions = {}): ShortcutCommand | null {
  if (event.key === 'Escape') return 'close';
  if (event.altKey) return null;
  if (!event.ctrlKey && !event.metaKey) return null;

  const key = event.key.toLowerCase();
  if (key === 's') return 'save';
  if (isEditableKeyTarget(event.target) && !options.undoRedoInEditable) return null;
  if (key === 'z' && !event.shiftKey) return 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  if (key === 'z' && event.shiftKey) return 'redo';
  return null;
}

export function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}
