import { describe, expect, it } from 'vitest';
import { configEntityIdInvalidMessage } from '@/domain/config/config-entities';

describe('config entity id invalid message', () => {
  it('appends the offending value when present', () => {
    expect(configEntityIdInvalidMessage('势力 ID', '我的势力')).toBe(
      '势力 ID "我的势力" 仅允许以 ASCII 字母或数字开头，只能包含 ASCII 字母、数字、下划线（_）、点（.）、连字符（-）',
    );
  });

  it('keeps the plain hint when the value is missing or empty', () => {
    const plain = '势力 ID 仅允许以 ASCII 字母或数字开头，只能包含 ASCII 字母、数字、下划线（_）、点（.）、连字符（-）';
    expect(configEntityIdInvalidMessage('势力 ID')).toBe(plain);
    expect(configEntityIdInvalidMessage('势力 ID', '')).toBe(plain);
  });
});
