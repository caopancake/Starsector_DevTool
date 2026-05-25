import {
  WINDOW_EVENTS,
  type FileEditorFocusLineEvent,
  type FileEditorSavedEvent,
  type FileEditorTextAppliedEvent,
} from '@/windows/window.events';
import { emitWindowEvent, listenWindowEvent, type WindowEventHandler } from '@/windows/tauri.events';
import { recordWindowEventHandlerError } from '@/orchestrators/window-event-errors.orchestrator';

export function emitFileEditorSaved(event: FileEditorSavedEvent) {
  return emitWindowEvent(WINDOW_EVENTS.fileEditorSaved, event);
}

export function listenFileEditorFocusLine(handler: WindowEventHandler<FileEditorFocusLineEvent>) {
  return listenWindowEvent<FileEditorFocusLineEvent>(WINDOW_EVENTS.fileEditorFocusLine, handler, recordWindowEventHandlerError);
}

export function listenFileEditorTextApplied(handler: WindowEventHandler<FileEditorTextAppliedEvent>) {
  return listenWindowEvent<FileEditorTextAppliedEvent>(WINDOW_EVENTS.fileEditorTextApplied, handler, recordWindowEventHandlerError);
}
