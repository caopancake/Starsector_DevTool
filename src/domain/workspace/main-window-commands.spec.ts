import { describe, expect, it } from 'vitest';
import { shortcutCommandFromKeyEvent } from './main-window-commands';

function keyEvent(init: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; inInput?: boolean }): KeyboardEvent {
  const input = document.createElement(init.inInput ? 'input' : 'div');
  document.body.appendChild(input);
  const event = new KeyboardEvent('keydown', {
    key: init.key,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    metaKey: init.meta ?? false,
  });
  Object.defineProperty(event, 'target', { value: input });
  return event;
}

describe('shortcutCommandFromKeyEvent', () => {
  it('maps Ctrl+S to save even inside editable targets', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 's', ctrl: true }))).toBe('save');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 's', ctrl: true, inInput: true }))).toBe('save');
  });

  it('maps undo and redo combos outside editable targets', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true }))).toBe('undo');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, shift: true }))).toBe('redo');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'y', ctrl: true }))).toBe('redo');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'y', ctrl: true, meta: true }))).toBe('redo');
  });

  it('exempts undo/redo inside editable targets unless the surface opts in', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, inInput: true }))).toBeNull();
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, inInput: true }), { undoRedoInEditable: true })).toBe('undo');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, shift: true, inInput: true }), { undoRedoInEditable: true })).toBe(
      'redo',
    );
  });

  it('maps Escape to close regardless of modifiers', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'Escape' }))).toBe('close');
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'Escape', ctrl: true, inInput: true }))).toBe('close');
  });

  it('rejects alt-modified and modifier-less combos', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, alt: true }))).toBeNull();
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 's' }))).toBeNull();
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z' }))).toBeNull();
  });

  it('keeps unrelated ctrl combos unresolved', () => {
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'k', ctrl: true }))).toBeNull();
    expect(shortcutCommandFromKeyEvent(keyEvent({ key: 'z', ctrl: true, shift: true, alt: true }))).toBeNull();
  });
});
