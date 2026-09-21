import { describe, expect, it } from 'vitest';
import { createEditSessionValue, createUndoStack } from './edit-session';

const identity = <T>(value: T): T => value;
const strictEquals = <T>(left: T, right: T): boolean => left === right;

describe('createEditSessionValue', () => {
  function createNumberSession(initial = 1) {
    return createEditSessionValue(initial, { clone: identity, equals: strictEquals });
  }

  it('starts clean with baseline equal to draft', () => {
    const session = createNumberSession(1);
    expect(session.baseline).toBe(1);
    expect(session.draft).toBe(1);
    expect(session.dirty).toBe(false);
    expect(session.revision).toBe(0);
    expect(session.hasPendingExternal).toBe(false);
    expect(session.pendingExternal).toBeNull();
  });

  it('derives dirty from baseline and draft', () => {
    const session = createNumberSession(1);
    session.setDraft(2);
    expect(session.dirty).toBe(true);
    session.setDraft(1);
    expect(session.dirty).toBe(false);
  });

  it('resetDraft restores the baseline', () => {
    const session = createNumberSession(1);
    session.setDraft(2);
    session.resetDraft();
    expect(session.draft).toBe(1);
    expect(session.dirty).toBe(false);
  });

  it('commitSaved promotes the draft to baseline by default', () => {
    const session = createNumberSession(1);
    session.setDraft(2);
    session.commitSaved();
    expect(session.baseline).toBe(2);
    expect(session.draft).toBe(2);
    expect(session.dirty).toBe(false);
  });

  it('commitSaved accepts an explicit saved value', () => {
    const session = createNumberSession(1);
    session.setDraft(2);
    session.commitSaved(5);
    expect(session.baseline).toBe(5);
    expect(session.draft).toBe(5);
  });

  it('loadBaseline replaces baseline and draft and bumps revision only when the draft changed', () => {
    const session = createNumberSession(1);
    session.loadBaseline(3);
    expect(session.baseline).toBe(3);
    expect(session.draft).toBe(3);
    expect(session.revision).toBe(1);
    session.loadBaseline(3);
    expect(session.revision).toBe(1);
  });

  it('applyExternal adopts the value when clean and parks it when dirty', () => {
    const session = createNumberSession(1);
    session.applyExternal(4);
    expect(session.baseline).toBe(4);
    expect(session.draft).toBe(4);
    expect(session.revision).toBe(1);

    session.setDraft(5);
    session.applyExternal(7);
    expect(session.baseline).toBe(4);
    expect(session.draft).toBe(5);
    expect(session.pendingExternal).toBe(7);
    expect(session.hasPendingExternal).toBe(true);
  });

  it('loadPendingExternal adopts the parked external value', () => {
    const session = createNumberSession(1);
    session.setDraft(5);
    session.applyExternal(7);
    session.loadPendingExternal();
    expect(session.baseline).toBe(7);
    expect(session.draft).toBe(7);
    expect(session.pendingExternal).toBeNull();
  });

  it('commitSaved clears a pending external value', () => {
    const session = createNumberSession(1);
    session.setDraft(5);
    session.applyExternal(7);
    session.commitSaved(6);
    expect(session.pendingExternal).toBeNull();
  });

  it('clear behaves like loadBaseline', () => {
    const session = createNumberSession(1);
    session.setDraft(2);
    session.clear(9);
    expect(session.baseline).toBe(9);
    expect(session.draft).toBe(9);
  });

  it('uses the injected clone and equals', () => {
    const seen: string[] = [];
    const session = createEditSessionValue('a', {
      clone: (value) => {
        seen.push(`clone:${value}`);
        return value;
      },
      equals: (left, right) => left.trim() === right.trim(),
    });
    session.setDraft('a  ');
    expect(session.dirty).toBe(false);
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe('createUndoStack', () => {
  it('push clears the redo stack', () => {
    const stack = createUndoStack<number>();
    stack.push(1);
    stack.push(2);
    stack.popUndo();
    stack.push(3);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undoStack).toEqual([1, 3]);
  });

  it('pop moves entries between stacks', () => {
    const stack = createUndoStack<number>();
    stack.push(1);
    stack.push(2);
    expect(stack.canUndo()).toBe(true);
    const undoEntry = stack.popUndo();
    expect(undoEntry).toBe(2);
    stack.pushRedo(undoEntry!);
    expect(stack.canRedo()).toBe(true);
    expect(stack.peekRedo()).toBe(2);
    const redoEntry = stack.popRedo();
    expect(redoEntry).toBe(2);
    stack.pushUndo(redoEntry!);
    expect(stack.undoStack).toEqual([1, 2]);
  });

  it('trims the undo stack to the limit', () => {
    const stack = createUndoStack<number>({ limit: 2 });
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.undoStack).toEqual([2, 3]);
    stack.setLimit(1);
    expect(stack.undoStack).toEqual([3]);
    expect(stack.limit).toBe(1);
  });

  it('generates prefixed unique ids via nextId', () => {
    const stack = createUndoStack<number>({ idPrefix: 'hist' });
    const first = stack.nextId();
    const second = stack.nextId();
    expect(first.startsWith('hist_')).toBe(true);
    expect(second.startsWith('hist_')).toBe(true);
    expect(first).not.toBe(second);
  });

  it('push assigns no id and keeps entries as provided', () => {
    const stack = createUndoStack<number>();
    stack.push(1);
    expect(stack.peekUndo()).toBe(1);
  });

  it('clear empties both stacks', () => {
    const stack = createUndoStack<number>();
    stack.push(1);
    stack.pushRedo(9);
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });
});
