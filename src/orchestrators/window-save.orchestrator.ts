import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { recordEditorSpecSaved, recordFileEditorSaved } from '@/orchestrators/file-save.orchestrator';
import type { EditorSpecSavedEvent } from '@/windows/editor.window';
import { WINDOW_EVENTS, type FileEditorSavedEvent } from '@/windows/window.events';

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
