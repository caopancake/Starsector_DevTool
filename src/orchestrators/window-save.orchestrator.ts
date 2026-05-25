import { handleEditorSpecSaved, handleFileEditorSaved } from '@/orchestrators/file-save.orchestrator';
import type { EditorSpecSavedEvent } from '@/windows/editor.window';
import { WINDOW_EVENTS, type FileEditorSavedEvent } from '@/windows/window.events';
import { listenWindowEvent, type UnlistenFn, type WindowEventHandler } from '@/windows/tauri.events';
import { recordWindowEventHandlerError } from '@/orchestrators/window-event-errors.orchestrator';

interface WindowSaveEventHandlers {
  onEditorSpecSaved?: WindowEventHandler<EditorSpecSavedEvent>;
}

export async function listenWindowSaveEvents(handlers: WindowSaveEventHandlers = {}) {
  const unlisteners: UnlistenFn[] = [];
  unlisteners.push(
    await listenWindowEvent<EditorSpecSavedEvent>(
      WINDOW_EVENTS.editorSpecSaved,
      async (event) => {
        if (await handleEditorSpecSaved(event)) {
          await handlers.onEditorSpecSaved?.(event);
        }
      },
      recordWindowEventHandlerError,
    ),
  );
  unlisteners.push(
    await listenWindowEvent<FileEditorSavedEvent>(
      WINDOW_EVENTS.fileEditorSaved,
      async (event) => {
        await handleFileEditorSaved(event);
      },
      recordWindowEventHandlerError,
    ),
  );
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
