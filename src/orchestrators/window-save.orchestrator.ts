import { recordEditorSpecSaved, recordFileEditorSaved } from '@/orchestrators/file-save.orchestrator';
import type { EditorSpecSavedEvent } from '@/windows/editor.window';
import { WINDOW_EVENTS, type FileEditorSavedEvent } from '@/windows/window.events';
import { listenWindowEvent, type UnlistenFn } from '@/windows/tauri.events';

interface WindowSaveEventHandlers {
  onEditorSpecSaved?: (payload: EditorSpecSavedEvent) => void;
}

export async function listenWindowSaveEvents(handlers: WindowSaveEventHandlers = {}) {
  const unlisteners: UnlistenFn[] = [];
  unlisteners.push(
    await listenWindowEvent<EditorSpecSavedEvent>(WINDOW_EVENTS.editorSpecSaved, (payload) => {
      if (recordEditorSpecSaved(payload)) {
        handlers.onEditorSpecSaved?.(payload);
      }
    }),
  );
  unlisteners.push(
    await listenWindowEvent<FileEditorSavedEvent>(WINDOW_EVENTS.fileEditorSaved, (payload) => {
      recordFileEditorSaved(payload);
    }),
  );
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
