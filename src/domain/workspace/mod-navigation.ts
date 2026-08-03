import type { ConfigView, ProjectManifest, TableKey, WorkspaceView } from '@/shared/types';
import { MODULE_LABELS } from '@/shared/lib/starsector';

export type ModNavigationTarget = { type: 'config'; view: ConfigView } | { type: 'table'; table: TableKey };

export interface ModNavigationItem {
  id: string;
  label: string;
  count: number | null;
  target: ModNavigationTarget;
}

export interface ModNavigationSection {
  id: string;
  items: ModNavigationItem[];
}

const PRIMARY_TABLE_KEYS: TableKey[] = ['ships', 'weapons', 'wings', 'hullmods', 'shipSystems'];
const SECONDARY_TABLE_KEYS: TableKey[] = [
  'industries',
  'skills',
  'abilities',
  'commodities',
  'specialItems',
  'submarkets',
  'marketConditions',
];

export function buildModNavigationSections(manifest: ProjectManifest | null | undefined): ModNavigationSection[] {
  return [
    {
      id: 'workspace',
      items: [configItem('mod-overview', 'Mod 概览'), configItem('file-history', '文件历史')],
    },
    {
      id: 'mod-info',
      items: [configItem('mod-info', 'Mod 信息')],
    },
    {
      id: 'combat',
      items: [
        ...PRIMARY_TABLE_KEYS.map((key) => tableItem(key, manifest)),
        configItem('skins', '舰船皮肤', manifest?.entitySummaries.skins ?? 0),
        configItem('variants', '装配', manifest?.entitySummaries.variants ?? 0),
        tableItem('simOpponents', manifest),
        tableItem('descriptions', manifest),
      ],
    },
    {
      id: 'campaign',
      items: [
        configItem('factions', '势力', manifest?.entitySummaries.factions ?? 0),
        ...SECONDARY_TABLE_KEYS.map((key) => tableItem(key, manifest)),
        configItem('mission', '战役', manifest?.entitySummaries.missions ?? 0),
      ],
    },
  ];
}

export function isModNavigationItemActive(
  item: ModNavigationItem,
  currentView: WorkspaceView,
  configView: ConfigView,
  currentTable: TableKey,
): boolean {
  if (item.target.type === 'config') return currentView === 'config' && configView === item.target.view;
  return currentView === 'table' && currentTable === item.target.table;
}

function configItem(view: ConfigView, label: string, count: number | null = null): ModNavigationItem {
  return {
    id: `config:${view}`,
    label,
    count,
    target: { type: 'config', view },
  };
}

function tableItem(table: TableKey, manifest: ProjectManifest | null | undefined): ModNavigationItem {
  return {
    id: `table:${table}`,
    label: MODULE_LABELS[table],
    count: manifest?.tableEntitySummaries[table] ?? 0,
    target: { type: 'table', table },
  };
}
