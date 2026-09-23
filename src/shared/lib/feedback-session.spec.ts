import { describe, expect, it } from 'vitest';
import { resolveFeedbackFileSession } from '@/shared/lib/feedback-session';

describe('feedback file session resolution', () => {
  const windowIdentity = { modRoot: 'D:\\mods\\demo', sessionId: 'session-1' };

  it('prefers the manifest session owning the path', () => {
    expect(resolveFeedbackFileSession('D:\\mods\\demo', 'session-2', windowIdentity, 'D:\\mods\\demo\\data.csv')).toEqual({
      modRoot: 'D:\\mods\\demo',
      sessionId: 'session-2',
    });
  });

  it('falls back to the child-window identity for paths inside its mod root', () => {
    expect(resolveFeedbackFileSession(null, null, windowIdentity, 'D:\\mods\\demo\\data\\faction.csv')).toEqual(windowIdentity);
  });

  it('falls back to the window identity when the matched manifest lacks a session', () => {
    expect(resolveFeedbackFileSession('D:\\mods\\demo', null, windowIdentity, 'D:\\mods\\demo\\data.csv')).toEqual(windowIdentity);
  });

  it('rejects paths outside the window mod root', () => {
    expect(resolveFeedbackFileSession(null, null, windowIdentity, 'D:\\mods\\other\\data.csv')).toBeNull();
  });

  it('returns null without a manifest match and without a window identity', () => {
    expect(resolveFeedbackFileSession(null, null, null, 'D:\\mods\\demo\\data.csv')).toBeNull();
  });
});
