import type { FileChangeRecord } from '../../shared/api/tauri';
import type { AppData, RowData, TableKey } from '../../shared/types';
import type { EditorSpecSavedEvent } from '../windowing/window-events';

export function textForFileHistoryDirection(change: FileChangeRecord, direction: 'undo' | 'redo'): string | null {
  return direction === 'undo' ? (change.beforeText ?? null) : (change.afterText ?? null);
}

export function parseJsonSpecFileChange(modsData: Map<string, AppData>, path: string, text: string | null): EditorSpecSavedEvent | null {
  if (!text) return null;
  const modRoot = resolveLoadedModRootForPath(modsData, path);
  if (!modRoot) return null;
  const rel = normalizePath(path).slice(normalizePath(modRoot).length + 1);
  const kind = kindForRelPath(rel);
  if (!kind) return null;
  try {
    const spec = JSON.parse(text) as RowData;
    const id = idForSpec(kind, spec, path);
    if (!id) return null;
    return { kind, modRoot, id, spec };
  } catch {
    return null;
  }
}

export function tableForCsvFileChange(modsData: Map<string, AppData>, path: string): { modRoot: string; table: TableKey } | null {
  const modRoot = resolveLoadedModRootForPath(modsData, path);
  if (!modRoot) return null;
  const modData = modsData.get(modRoot);
  if (!modData) return null;
  const normalizedPath = normalizePath(path);
  for (const [table, relPath] of Object.entries(modData.csvPaths)) {
    if (normalizedPath === `${normalizePath(modRoot)}/${normalizePath(relPath)}`) {
      return { modRoot, table: table as TableKey };
    }
  }
  return null;
}

export function syncConfigFileChange(modsData: Map<string, AppData>, change: FileChangeRecord, direction: 'undo' | 'redo') {
  const modRoot = resolveLoadedModRootForPath(modsData, change.path);
  if (!modRoot) return;
  const modData = modsData.get(modRoot);
  if (!modData) return;
  const rel = normalizeRelPath(modRoot, change.path);
  const text = textForFileHistoryDirection(change, direction);
  if (rel === 'mod_info.json') {
    if (text) {
      try {
        modData.modInfo = JSON.parse(text) as RowData;
      } catch {
        // Disk write already succeeded; cache will recover on reload.
      }
    }
    return;
  }
  const faction = rel.match(/^data\/world\/factions\/([^/]+)\.faction$/);
  if (faction) {
    const id = faction[1];
    if (text) {
      try {
        modData.factionFiles[id] = JSON.parse(text) as RowData;
      } catch {
        // Keep current cache if the applied file is not strict JSON.
      }
    } else {
      delete modData.factionFiles[id];
      delete modData.factionMeta[id];
    }
    return;
  }
  if (rel === 'data/world/factions/factions.csv') {
    return;
  }
  if (rel === 'data/missions/mission_list.csv') {
    modData.missionCount = countMissionRows(text);
  }
}

export function resolveLoadedModRootForPath(modsData: Map<string, AppData>, path: string): string | null {
  const normalizedPath = normalizePath(path);
  const matches = [...modsData.keys()].filter((modRoot) => {
    const normalizedRoot = normalizePath(modRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  });
  matches.sort((a, b) => normalizePath(b).length - normalizePath(a).length);
  return matches[0] ?? null;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function normalizeRelPath(modRoot: string, path: string): string {
  return normalizePath(path).slice(normalizePath(modRoot).length + 1);
}

function countMissionRows(text: string | null): number {
  if (!text) return 0;
  const lines = text.split(/\r?\n/).slice(1);
  return lines.filter((line) => line.split(',')[0]?.trim()).length;
}

function kindForRelPath(relPath: string): EditorSpecSavedEvent['kind'] | null {
  if (relPath.startsWith('data/hulls/') && relPath.endsWith('.ship')) return 'ship';
  if (relPath.startsWith('data/weapons/proj/') && relPath.endsWith('.proj')) return 'projectile';
  if (relPath.startsWith('data/weapons/') && relPath.endsWith('.wpn')) return 'weapon';
  return null;
}

function idForSpec(kind: EditorSpecSavedEvent['kind'], spec: RowData, path: string): string {
  const value = kind === 'ship' ? spec.hullId : spec.id;
  return typeof value === 'string' && value ? value : fileStem(path);
}

function fileStem(path: string): string {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? '';
  return name.replace(/\.[^.]+$/, '');
}
