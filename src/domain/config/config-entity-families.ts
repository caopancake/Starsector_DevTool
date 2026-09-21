import { configVariantListTitle } from '@/domain/config/config-entities';
import type { RowData } from '@/shared/types';

/**
 * 配置实体族的参数化定义：Skin/Variant 两族共享同一组件与视图模型，
 * 族间差异（文案、字段名、图标、排序、水合需求）只存在于本定义。
 */
export interface ConfigEntityFamilyDefinition {
  id: 'variant' | 'skin';
  displayName: string;
  schemaId: 'variant' | 'skin';
  entityKind: 'variant' | 'skin';
  idField: string;
  companionField: string;
  companionLabel: string;
  directoryHint: string;
  selectConfirmTitle: string;
  selectConfirmContent: string;
  createLabel: string;
  deleteConfirmTitle: string;
  listIconPaths: string[];
  mediaSurface: string;
  usesHullNames: boolean;
}

export interface ConfigFamilyFile {
  data: RowData;
  relPath: string;
}

export function familyFileId(family: ConfigEntityFamilyDefinition, file: ConfigFamilyFile): string {
  return String((file as unknown as Record<string, unknown>)[family.idField] ?? '');
}

export function familyFileTitle(family: ConfigEntityFamilyDefinition, file: ConfigFamilyFile, hullNames: Record<string, string>): string {
  if (family.usesHullNames) {
    return configVariantListTitle(file as unknown as Parameters<typeof configVariantListTitle>[0], hullNames);
  }
  return String((file as unknown as Record<string, unknown>)[family.idField] ?? '');
}

export function familyFileCompanion(family: ConfigEntityFamilyDefinition, file: ConfigFamilyFile): string {
  return String((file as unknown as Record<string, unknown>)[family.companionField] ?? '');
}

export const variantFamily: ConfigEntityFamilyDefinition = {
  id: 'variant',
  displayName: '装配',
  schemaId: 'variant',
  entityKind: 'variant',
  idField: 'variantId',
  companionField: 'hullId',
  companionLabel: 'hullId',
  directoryHint: '未找到 data/variants 下的 .variant 文件。',
  selectConfirmTitle: '切换装配？',
  selectConfirmContent: '当前装配有未保存修改，切换后这些修改将丢失。确认继续？',
  createLabel: '新建装配',
  deleteConfirmTitle: '删除装配',
  listIconPaths: ['M12 3 5 18l7 3 7-3-7-15z', 'M12 3v18M7 15l5 2 5-2'],
  mediaSurface: 'config-variant-list',
  usesHullNames: true,
};

export const skinFamily: ConfigEntityFamilyDefinition = {
  id: 'skin',
  displayName: '舰船皮肤',
  schemaId: 'skin',
  entityKind: 'skin',
  idField: 'skinHullId',
  companionField: 'baseHullId',
  companionLabel: 'baseHullId',
  directoryHint: '未找到 data/hulls/skins 下的 .skin 文件。',
  selectConfirmTitle: '切换舰船皮肤？',
  selectConfirmContent: '当前舰船皮肤有未保存修改，切换后这些修改将丢失。确认继续？',
  createLabel: '新建舰船皮肤',
  deleteConfirmTitle: '删除舰船皮肤',
  listIconPaths: ['M12 3 5 18l7 3 7-3-7-15z', 'M8 16h8M9 12h6'],
  mediaSurface: 'config-skin-list',
  usesHullNames: false,
};
