import { describe, expect, it } from 'vitest';
import { appendFileReferenceLocation, buildModOpeningFailure, extractFileReferenceFromError } from '@/shared/lib/errors';

describe('file references in errors', () => {
  it('extracts a Windows path with serde line and column', () => {
    const reference = extractFileReferenceFromError(
      '解析 JSON 文件失败 (\\\\?\\D:\\mods\\demo\\mod_info.json): expected `,` or `}` at line 5 column 44',
    );

    expect(reference).toMatchObject({
      path: '\\\\?\\D:\\mods\\demo\\mod_info.json',
      line: 5,
      column: 44,
    });
    expect(appendFileReferenceLocation('读取失败', reference)).toBe('读取失败（第 5 行，第 44 列）');
  });

  it('extracts a physical line from a CSV record-width error', () => {
    const reference = extractFileReferenceFromError(
      '解析 CSV 失败 (D:\\mods\\demo\\data.csv): record 3 has 1 fields, but header has 2 fields; record starts at line 5',
    );

    expect(reference).toMatchObject({ path: 'D:\\mods\\demo\\data.csv', line: 5 });
  });

  it('extracts a line without a column', () => {
    const reference = extractFileReferenceFromError('读取失败 (D:\\mods\\demo\\data.csv): line: 9');

    expect(reference).toMatchObject({ path: 'D:\\mods\\demo\\data.csv', line: 9 });
    expect(reference?.column).toBeUndefined();
    expect(appendFileReferenceLocation('读取失败', reference)).toBe('读取失败（第 9 行）');
  });

  it('keeps file references without a location', () => {
    const reference = extractFileReferenceFromError('读取失败 (D:\\mods\\demo\\mod_info.json)');

    expect(reference).toMatchObject({ path: 'D:\\mods\\demo\\mod_info.json' });
    expect(reference?.line).toBeUndefined();
    expect(reference?.column).toBeUndefined();
    expect(appendFileReferenceLocation('读取失败', reference)).toBe('读取失败');
  });

  it('authorizes an error file inside an equivalent extended Mod root', () => {
    const failure = buildModOpeningFailure('\\\\?\\D:\\mods\\demo', '读取失败 (D:\\mods\\demo\\data.csv): line 9');

    expect(failure.file).toEqual({ path: 'D:\\mods\\demo\\data.csv', line: 9, column: undefined });
  });

  it('rejects an error file outside the trusted Mod root', () => {
    const failure = buildModOpeningFailure('D:\\mods\\demo', '读取失败 (D:\\mods\\other\\data.csv): line 9');

    expect(failure.file).toBeNull();
  });
});
