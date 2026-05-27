import { defaultShip, defaultWeapon } from '@/shared/lib/starsector';
import type { EditorWindowKind, RowData, TableKey } from '@/shared/types';

interface AssociatedSpecDefinition {
  createText: (id: string, row: RowData) => string;
  editorKinds: EditorWindowKind[];
  relPath: (id: string) => string;
}

const ASSOCIATED_SPEC_DEFINITIONS: Partial<Record<TableKey, AssociatedSpecDefinition>> = {
  ships: {
    relPath: (id) => `data/hulls/${id}.ship`,
    createText: (id) => JSON.stringify(defaultShip(id), null, 2),
    editorKinds: ['ship'],
  },
  weapons: {
    relPath: (id) => `data/weapons/${id}.wpn`,
    createText: (id, row) => JSON.stringify(defaultWeapon(id, row), null, 2),
    editorKinds: ['weapon', 'weapon-preview'],
  },
  shipSystems: {
    relPath: (id) => `data/shipsystems/${id}.system`,
    createText: (id) => JSON.stringify({ id }, null, 2),
    editorKinds: ['system'],
  },
  skills: {
    relPath: (id) => `data/characters/skills/${id}.skill`,
    createText: (id) => JSON.stringify({ id }, null, 2),
    editorKinds: [],
  },
};

export function associatedSpecRelPath(table: TableKey, id: string): string | null {
  if (!id) return null;
  return ASSOCIATED_SPEC_DEFINITIONS[table]?.relPath(id) ?? null;
}

export function associatedSpecCreateText(table: TableKey, id: string, row: RowData): string | null {
  if (!id) return null;
  return ASSOCIATED_SPEC_DEFINITIONS[table]?.createText(id, row) ?? null;
}

export function associatedSpecEditorKinds(table: TableKey): EditorWindowKind[] {
  return [...(ASSOCIATED_SPEC_DEFINITIONS[table]?.editorKinds ?? [])];
}

export function tableHasAssociatedSpec(table: TableKey): boolean {
  return Boolean(ASSOCIATED_SPEC_DEFINITIONS[table]);
}
