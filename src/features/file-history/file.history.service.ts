import { emit } from '@tauri-apps/api/event';
import { applyFileChangeSet } from '../../shared/api/tauri';
import { loadProject } from '../project/project.service';
import type { useProjectStore } from '../project/project.store';
import type { useTablesStore } from '../tables/tables.store';
import { WINDOW_EVENTS } from '../windowing/window-events';
import type { FileSaveHistoryEntry } from './file.history.types';
import { parseJsonSpecFileChange, syncConfigFileChange, tableForCsvFileChange, textForFileHistoryDirection } from './file.history.sync';

type ProjectStore = ReturnType<typeof useProjectStore>;
type TablesStore = ReturnType<typeof useTablesStore>;

export async function applyFileSaveHistoryEntry(
  entry: FileSaveHistoryEntry,
  direction: 'undo' | 'redo',
  project: ProjectStore,
  tables: TablesStore,
) {
  await applyFileChangeSet(direction, entry.changes);
  for (const change of entry.changes) {
    if (change.kind === 'directory') continue;
    const text = textForFileHistoryDirection(change, direction);
    await emit(WINDOW_EVENTS.fileEditorTextApplied, { path: change.path, text: text ?? '' });
    const specChange = parseJsonSpecFileChange(project.modsData, change.path, text);
    if (specChange) {
      if (specChange.kind === 'ship') {
        project.updateShipFile(specChange.modRoot, specChange.id, specChange.spec);
      } else if (specChange.kind === 'weapon') {
        project.updateWeaponFile(specChange.modRoot, specChange.id, specChange.spec);
      } else {
        project.updateProjectileFile(specChange.modRoot, specChange.id, specChange.spec);
      }
      await emit(WINDOW_EVENTS.editorSpecApplied, specChange);
      continue;
    }
    syncConfigFileChange(project.modsData, change, direction);
    const tableChange = tableForCsvFileChange(project.modsData, change.path);
    if (tableChange) {
      const loaded = await loadProject(tableChange.modRoot, project.getModData(tableChange.modRoot)?.starsectorRoot);
      project.modsData.set(tableChange.modRoot, loaded);
      tables.replaceTableForMod(tableChange.modRoot, tableChange.table, loaded[tableChange.table]);
    }
  }
}
