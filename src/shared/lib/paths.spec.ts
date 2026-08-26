import { describe, expect, it } from 'vitest';
import { pathBelongsToRoot } from '@/shared/lib/paths';

describe('Windows path ownership', () => {
  it('treats extended and drive paths as the same root', () => {
    expect(pathBelongsToRoot('D:\\game\\mods\\demo\\data.csv', '\\\\?\\D:\\game\\mods\\demo')).toBe(true);
    expect(pathBelongsToRoot('\\\\?\\D:\\game\\mods\\demo\\data.csv', 'D:\\game\\mods\\demo')).toBe(true);
  });

  it('rejects paths outside the extended root', () => {
    expect(pathBelongsToRoot('D:\\game\\mods\\other\\data.csv', '\\\\?\\D:\\game\\mods\\demo')).toBe(false);
  });
});
