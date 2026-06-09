import type { ProjectManifest, TableKey } from '@/shared/types';
import { gameCoreDirectoryPath } from '@/shared/lib/paths';
import { cell, formatModVersion, MODULE_LABELS } from '@/shared/lib/starsector';

export interface ConfigModOverviewBreakdownItem {
  label: string;
  count: number;
  category: 'table' | 'config';
}

export interface ConfigModOverviewModel {
  modName: string;
  modVersion: string;
  modRootText: string;
  coreAvailable: boolean;
  coreResourceText: string;
  tableTotal: number;
  configTotal: number;
  breakdown: ConfigModOverviewBreakdownItem[];
}

const OVERVIEW_TABLE_KEYS: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'shipSystems', 'industries', 'skills'];

export function buildConfigModOverview(manifest: ProjectManifest | null | undefined): ConfigModOverviewModel {
  const breakdown = manifest ? overviewBreakdown(manifest) : [];
  return {
    modName: cell(manifest?.modInfo?.name) || 'Mod 概览',
    modVersion: formatModVersion(manifest?.modInfo?.version),
    modRootText: manifest?.modRoot || '未加载',
    coreAvailable: Boolean(manifest?.coreAvailable),
    coreResourceText: coreResourceText(manifest),
    tableTotal: totalByCategory(breakdown, 'table'),
    configTotal: totalByCategory(breakdown, 'config'),
    breakdown,
  };
}

function overviewBreakdown(manifest: ProjectManifest): ConfigModOverviewBreakdownItem[] {
  return [
    ...OVERVIEW_TABLE_KEYS.map((key) => ({
      label: MODULE_LABELS[key],
      count: manifest.tableEntitySummaries[key],
      category: 'table' as const,
    })),
    { label: '舰船皮肤', count: manifest.entitySummaries.skins, category: 'config' },
    { label: '装配', count: manifest.entitySummaries.variants, category: 'config' },
    { label: '势力', count: manifest.entitySummaries.factions, category: 'config' },
    { label: '战役', count: manifest.entitySummaries.missions, category: 'config' },
  ];
}

function coreResourceText(manifest: ProjectManifest | null | undefined): string {
  if (!manifest?.coreAvailable) return '未找到可用于贴图、Schema 和引用回退的 starsector-core';
  return manifest.starsectorRoot ? gameCoreDirectoryPath(manifest.starsectorRoot) : '已找到 starsector-core';
}

function totalByCategory(items: ConfigModOverviewBreakdownItem[], category: ConfigModOverviewBreakdownItem['category']): number {
  return items.filter((item) => item.category === category).reduce((sum, item) => sum + item.count, 0);
}
