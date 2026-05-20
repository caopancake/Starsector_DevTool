import { WINDOW_EVENTS, type EditorSpecSavedEvent } from '@/windows/window.events';
import { emitWindowEvent, listenWindowEvent } from '@/windows/tauri.events';

export function emitEditorSpecSaved(payload: EditorSpecSavedEvent) {
  return emitWindowEvent(WINDOW_EVENTS.editorSpecSaved, payload);
}

export function listenEditorSpecApplied(handler: (payload: EditorSpecSavedEvent) => void) {
  return listenWindowEvent<EditorSpecSavedEvent>(WINDOW_EVENTS.editorSpecApplied, handler);
}
