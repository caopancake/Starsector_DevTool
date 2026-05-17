import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { EditorSpecSavedEvent } from '../editors/editor-window';
import { recordEditorSpecSaved, recordFileEditorSaved } from '../file-history/file-save-orchestrator';
import { WINDOW_EVENTS, type FileEditorSavedEvent } from './window-events';

interface WindowSaveEventHandlers {
  onEditorSpecSaved?: (payload: EditorSpecSavedEvent) => void;
}

export async function listenWindowSaveEvents(handlers: WindowSaveEventHandlers = {}) {
  const unlisteners: UnlistenFn[] = [];
  unlisteners.push(
    await listen<EditorSpecSavedEvent>(WINDOW_EVENTS.editorSpecSaved, (event) => {
      if (recordEditorSpecSaved(event.payload)) {
        handlers.onEditorSpecSaved?.(event.payload);
      }
    }),
  );
  unlisteners.push(
    await listen<FileEditorSavedEvent>(WINDOW_EVENTS.fileEditorSaved, (event) => {
      recordFileEditorSaved(event.payload);
    }),
  );
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
