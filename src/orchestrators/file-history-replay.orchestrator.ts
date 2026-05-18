import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { h } from 'vue';
import { emit } from '@tauri-apps/api/event';
import { applyFileChangeSet, type FileChangeRecord } from '@/shared/api/files-api';
import { normalizeFsPath, pathStem, relativePathFromRoot } from '@/shared/lib/paths';
import type { AppData, RowData, SkinFile, TableKey, VariantFile } from '@/shared/types';
import type { useProjectStore } from '@/stores/project.store';
import type { useTablesStore } from '@/stores/tables.store';
import { loadTableRows } from '@/services/table.service';
import { WINDOW_EVENTS } from '@/windows/window.events';
import type { EditorSpecSavedEvent } from '@/windows/window.events';
import { useFileHistoryStore } from '@/stores/file-history.store';
import type { FileSaveHistoryEntry } from '@/shared/types/file-history.types';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;
export type FileHistoryReplayDirection = 'undo' | 'redo';

export function replayNextFileHistoryEntry(
  direction: FileHistoryReplayDirection,
  project: ProjectStore,
  tables: TablesStore,
  message: MessageApiInjection,
  dialog: DialogApiInjection,
) {
  const fileHistory = useFileHistoryStore();
  const entry = direction === 'undo' ? fileHistory.peekFileUndo() : fileHistory.peekFileRedo();
  if (!entry) return false;
  confirmFileHistoryReplay(dialog, entry, direction, async () => {
    try {
      await applyFileSaveHistoryEntry(entry, direction, project, tables);
      const committed = direction === 'undo' ? fileHistory.commitFileUndo(entry.id) : fileHistory.commitFileRedo(entry.id);
      if (!committed) {
        message.error(`${fileHistoryAction(direction)}文件历史失败：历史栈状态已变化`);
        return;
      }
      message.success(`已${fileHistoryAction(direction)}`);
    } catch (error) {
      message.error(`${fileHistoryAction(direction)}文件历史失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return true;
}

function confirmFileHistoryReplay(
  dialog: DialogApiInjection,
  entry: FileSaveHistoryEntry,
  direction: FileHistoryReplayDirection,
  onConfirm: () => Promise<void>,
) {
  const action = fileHistoryAction(direction);
  dialog.warning({
    title: `${action}文件历史`,
    content: () => renderConfirmContent(entry, action),
    positiveText: action,
    negativeText: '取消',
    onPositiveClick: () => onConfirm(),
  });
}

function renderConfirmContent(entry: FileSaveHistoryEntry, action: string) {
  const paths = entry.changes.map((change) => change.path);
  return h('div', { class: 'file-history-confirm' }, [
    h('p', `${action}会直接写回磁盘。`),
    h('p', `历史记录：${entry.label}`),
    h('p', `涉及文件：${paths.length} 个`),
    h(
      'ul',
      { class: 'file-history-confirm-list' },
      paths.map((path) => h('li', { key: path }, path)),
    ),
  ]);
}

function fileHistoryAction(direction: FileHistoryReplayDirection) {
  return direction === 'undo' ? '撤销' : '重做';
}

async function applyFileSaveHistoryEntry(
  entry: FileSaveHistoryEntry,
  direction: 'undo' | 'redo',
  project: ProjectStore,
  tables: TablesStore,
) {
  await applyFileChangeSet(direction, entry.changes);
  for (const change of entry.changes) {
    if (change.kind === 'directory') continue;
    const text = textForFileHistoryDirection(change, direction);
    if (text === null && hasBinaryFileContent(change, direction)) continue;
    await emit(WINDOW_EVENTS.fileEditorTextApplied, { path: change.path, text: text ?? '' });
    const specChange = parseJsonSpecFileChange(project.modsData, change.path, text);
    if (specChange) {
      syncEditorSpecChange(project, specChange);
      await emit(WINDOW_EVENTS.editorSpecApplied, specChange);
      continue;
    }
    if (syncVariantFileChange(project, change.path, text)) {
      continue;
    }
    if (syncSkinFileChange(project, change.path, text)) {
      continue;
    }
    syncConfigFileChange(project.modsData, change, direction);
    const tableChange = tableForCsvFileChange(project.modsData, change.path);
    if (tableChange) {
      const loaded = await loadTableRows(tableChange.modRoot, tableChange.table);
      const modData = project.getModData(tableChange.modRoot);
      if (modData) {
        modData.csvHeaders[tableChange.table] = loaded.header;
        modData.csvPaths[tableChange.table] = loaded.path;
        modData[tableChange.table] = loaded.rows;
      }
      tables.replaceTableForMod(tableChange.modRoot, tableChange.table, loaded.rows);
    }
  }
}

function syncSkinFileChange(project: ProjectStore, path: string, text: string | null): boolean {
  const modRoot = resolveLoadedModRootForPath(project.modsData, path);
  if (!modRoot) return false;
  const rel = relativePathFromRoot(modRoot, path);
  if (!rel.startsWith('data/hulls/skins/') || !rel.endsWith('.skin')) return false;
  if (!text) {
    const existing = project.getModData(modRoot)?.skinFiles.find((skin) => normalizeFsPath(skin.path) === normalizeFsPath(path));
    if (existing) project.deleteSkinFile(modRoot, existing.skinHullId);
    return true;
  }
  try {
    const data = JSON.parse(text) as RowData;
    const skinHullId = stringField(data, 'skinHullId') || pathStem(path);
    const baseHullId = stringField(data, 'baseHullId');
    if (!baseHullId) return true;
    const previous = project.getModData(modRoot)?.skinFiles.find((skin) => normalizeFsPath(skin.path) === normalizeFsPath(path));
    project.upsertSkinFile(modRoot, buildSkinFile(modRoot, rel, data), previous?.skinHullId);
    return Boolean(skinHullId);
  } catch {
    return true;
  }
}

function syncVariantFileChange(project: ProjectStore, path: string, text: string | null): boolean {
  const modRoot = resolveLoadedModRootForPath(project.modsData, path);
  if (!modRoot) return false;
  const rel = relativePathFromRoot(modRoot, path);
  if (!rel.startsWith('data/variants/') || !rel.endsWith('.variant')) return false;
  if (!text) {
    const existing = project.getModData(modRoot)?.variantFiles.find((variant) => normalizeFsPath(variant.path) === normalizeFsPath(path));
    if (existing) project.deleteVariantFile(modRoot, existing.variantId);
    return true;
  }
  try {
    const data = JSON.parse(text) as RowData;
    const variantId = stringField(data, 'variantId') || pathStem(path);
    const hullId = stringField(data, 'hullId');
    if (!hullId) return true;
    const previous = project.getModData(modRoot)?.variantFiles.find((variant) => normalizeFsPath(variant.path) === normalizeFsPath(path));
    project.upsertVariantFile(modRoot, buildVariantFile(modRoot, rel, data), previous?.variantId);
    return Boolean(variantId);
  } catch {
    return true;
  }
}

function textForFileHistoryDirection(change: FileChangeRecord, direction: 'undo' | 'redo'): string | null {
  return direction === 'undo' ? (change.beforeText ?? null) : (change.afterText ?? null);
}

function hasBinaryFileContent(change: FileChangeRecord, direction: 'undo' | 'redo'): boolean {
  return Boolean(direction === 'undo' ? change.beforeDataBase64 : change.afterDataBase64);
}

function parseJsonSpecFileChange(modsData: Map<string, AppData>, path: string, text: string | null): EditorSpecSavedEvent | null {
  if (!text) return null;
  const modRoot = resolveLoadedModRootForPath(modsData, path);
  if (!modRoot) return null;
  const rel = relativePathFromRoot(modRoot, path);
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

function tableForCsvFileChange(modsData: Map<string, AppData>, path: string): { modRoot: string; table: TableKey } | null {
  const modRoot = resolveLoadedModRootForPath(modsData, path);
  if (!modRoot) return null;
  const modData = modsData.get(modRoot);
  if (!modData) return null;
  const normalizedPath = normalizeFsPath(path);
  for (const [table, relPath] of Object.entries(modData.csvPaths)) {
    if (normalizedPath === `${normalizeFsPath(modRoot)}/${normalizeFsPath(relPath)}`) {
      return { modRoot, table: table as TableKey };
    }
  }
  return null;
}

function syncConfigFileChange(modsData: Map<string, AppData>, change: FileChangeRecord, direction: 'undo' | 'redo') {
  const modRoot = resolveLoadedModRootForPath(modsData, change.path);
  if (!modRoot) return;
  const modData = modsData.get(modRoot);
  if (!modData) return;
  const rel = relativePathFromRoot(modRoot, change.path);
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

function syncEditorSpecChange(project: ProjectStore, specChange: EditorSpecSavedEvent) {
  if (!project.getModData(specChange.modRoot)) return false;
  if (specChange.kind === 'ship') {
    project.updateShipFile(specChange.modRoot, specChange.id, specChange.spec);
  } else if (specChange.kind === 'weapon') {
    project.updateWeaponFile(specChange.modRoot, specChange.id, specChange.spec);
  } else {
    project.updateProjectileFile(specChange.modRoot, specChange.id, specChange.spec);
  }
  return true;
}

function resolveLoadedModRootForPath(modsData: Map<string, AppData>, path: string): string | null {
  const normalizedPath = normalizeFsPath(path);
  const matches = [...modsData.keys()].filter((modRoot) => {
    const normalizedRoot = normalizeFsPath(modRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  });
  matches.sort((a, b) => normalizeFsPath(b).length - normalizeFsPath(a).length);
  return matches[0] ?? null;
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
  return typeof value === 'string' && value ? value : pathStem(path);
}

function buildVariantFile(modRoot: string, relPath: string, data: RowData): VariantFile {
  return {
    variantId: stringField(data, 'variantId'),
    hullId: stringField(data, 'hullId'),
    relPath,
    path: joinModPath(modRoot, relPath),
    data,
    weaponGroupCount: arrayCount(data.weaponGroups),
    hullModCount: arrayCount(data.hullMods),
    permaModCount: arrayCount(data.permaMods),
    wingCount: arrayCount(data.wings),
  };
}

function buildSkinFile(modRoot: string, relPath: string, data: RowData): SkinFile {
  return {
    skinHullId: stringField(data, 'skinHullId'),
    baseHullId: stringField(data, 'baseHullId'),
    relPath,
    path: joinModPath(modRoot, relPath),
    data,
    builtInModCount: arrayCount(data.builtInMods),
    builtInWeaponCount: objectCount(data.builtInWeapons),
    builtInWingCount: arrayCount(data.builtInWings),
    weaponSlotChangeCount: objectCount(data.weaponSlotChanges),
    engineSlotChangeCount: objectCount(data.engineSlotChanges),
  };
}

function stringField(data: RowData, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function objectCount(value: unknown): number {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function joinModPath(root: string, relPath: string): string {
  return `${root.replace(/[\\/]+$/, '')}\\${relPath.replace(/\//g, '\\')}`;
}
