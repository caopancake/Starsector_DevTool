import {
  WINDOW_EVENTS,
  type FileEditorFocusLineEvent,
  type FileEditorSavedEvent,
  type FileEditorTextAppliedEvent,
} from '@/windows/window.events';
import { emitWindowEvent, listenWindowEvent } from '@/windows/tauri.events';

export function emitFileEditorSaved(payload: FileEditorSavedEvent) {
  return emitWindowEvent(WINDOW_EVENTS.fileEditorSaved, payload);
}

export function listenFileEditorFocusLine(handler: (payload: FileEditorFocusLineEvent) => void) {
  return listenWindowEvent<FileEditorFocusLineEvent>(WINDOW_EVENTS.fileEditorFocusLine, handler);
}

export function listenFileEditorTextApplied(handler: (payload: FileEditorTextAppliedEvent) => void) {
  return listenWindowEvent<FileEditorTextAppliedEvent>(WINDOW_EVENTS.fileEditorTextApplied, handler);
}
