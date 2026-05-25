import type { ConfigView, ProjectManifest, TableKey, WorkspaceView } from '@/shared/types';
import { MODULE_LABELS } from '@/shared/lib/starsector';

export type ModTreeTarget = { type: 'config'; view: ConfigView } | { type: 'table'; table: TableKey };

export interface ModTreeModuleItem {
  id: string;
  label: string;
  count: number | null;
  target: ModTreeTarget;
}

export interface ModTreeModuleSection {
  id: string;
  items: ModTreeModuleItem[];
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

export function buildModTreeModuleSections(manifest: ProjectManifest | null | undefined): ModTreeModuleSection[] {
  return [
    {
      id: 'workspace',
      items: [configModule('mod-overview', 'Mod 概览'), configModule('file-history', '文件历史')],
    },
    {
      id: 'mod-info',
      items: [configModule('mod-info', 'Mod 信息')],
    },
    {
      id: 'combat',
      items: [
        ...PRIMARY_TABLE_KEYS.map((key) => tableModule(key, manifest)),
        configModule('skins', '舰船皮肤', manifest?.entitySummaries.skins ?? 0),
        configModule('variants', '装配', manifest?.entitySummaries.variants ?? 0),
        tableModule('simOpponents', manifest),
        tableModule('descriptions', manifest),
      ],
    },
    {
      id: 'campaign',
      items: [
        configModule('factions', '势力', manifest?.entitySummaries.factions ?? 0),
        ...SECONDARY_TABLE_KEYS.map((key) => tableModule(key, manifest)),
        configModule('mission', '战役', manifest?.entitySummaries.missions ?? 0),
      ],
    },
  ];
}

export function isModTreeModuleActive(
  item: ModTreeModuleItem,
  currentView: WorkspaceView,
  configView: ConfigView,
  currentTable: TableKey,
): boolean {
  if (item.target.type === 'config') return currentView === 'config' && configView === item.target.view;
  return currentView === 'table' && currentTable === item.target.table;
}

function configModule(view: ConfigView, label: string, count: number | null = null): ModTreeModuleItem {
  return {
    id: `config:${view}`,
    label,
    count,
    target: { type: 'config', view },
  };
}

function tableModule(table: TableKey, manifest: ProjectManifest | null | undefined): ModTreeModuleItem {
  return {
    id: `table:${table}`,
    label: MODULE_LABELS[table],
    count: manifest?.tableEntitySummaries[table] ?? 0,
    target: { type: 'table', table },
  };
}
