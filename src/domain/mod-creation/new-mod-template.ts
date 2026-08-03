import { getSchema } from '@/domain/schema/schema-registry';
import type { NewModTemplate } from '@/shared/types';

const MOD_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const MAX_MOD_ID_LENGTH = 64;
const MAX_MOD_NAME_LENGTH = 128;
const MAX_MOD_VERSION_LENGTH = 64;
const MAX_GAME_VERSION_LENGTH = 64;

export function createDefaultNewModTemplate(): NewModTemplate {
  return {
    id: '',
    name: '',
    version: requiredModInfoStringDefault('file.version'),
    gameVersion: requiredModInfoStringDefault('file.gameVersion'),
  };
}

export function validateNewModTemplate(template: NewModTemplate): string | null {
  const id = template.id.trim();
  if (!MOD_ID_RE.test(id) || id.length > MAX_MOD_ID_LENGTH) {
    return `Mod ID 必须以英文或数字开头，只能使用英文、数字、 .、_、-，且不超过 ${MAX_MOD_ID_LENGTH} 个字符`;
  }
  return (
    validateSingleLineText(template.name, 'Mod 名称', MAX_MOD_NAME_LENGTH) ??
    validateSingleLineText(template.version, 'Mod 版本号', MAX_MOD_VERSION_LENGTH) ??
    validateSingleLineText(template.gameVersion, '游戏版本', MAX_GAME_VERSION_LENGTH)
  );
}

function requiredModInfoStringDefault(key: string): string {
  const field = getSchema('mod-info')?.fields?.find((candidate) => candidate.key === key);
  if (typeof field?.default !== 'string' || !field.default.trim()) {
    throw new Error(`mod-info schema 缺少 ${key} 的字符串默认值`);
  }
  return field.default;
}

function validateSingleLineText(value: string, label: string, maxLength: number): string | null {
  const normalized = value.trim();
  if (!normalized) return `${label}不能为空`;
  if (normalized.length > maxLength) return `${label}不能超过 ${maxLength} 个字符`;
  if ([...normalized].some((character) => character <= '\u001f' || character === '\u007f')) {
    return `${label}不能包含控制字符`;
  }
  return null;
}
