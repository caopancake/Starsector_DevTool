import type { EditorWindowKind, TableKey } from '@/shared/types';

interface AssociatedSpecDefinition {
  editorKinds: EditorWindowKind[];
  relPath: (id: string) => string;
}

const ASSOCIATED_SPEC_DEFINITIONS: Partial<Record<TableKey, AssociatedSpecDefinition>> = {
  ships: {
    editorKinds: ['ship'],
    relPath: (id) => `data/hulls/${id}.ship`,
  },
  weapons: {
    editorKinds: ['weapon', 'weapon-preview'],
    relPath: (id) => `data/weapons/${id}.wpn`,
  },
  shipSystems: {
    editorKinds: ['system'],
    relPath: (id) => `data/shipsystems/${id}.system`,
  },
  skills: {
    editorKinds: [],
    relPath: (id) => `data/characters/skills/${id}.skill`,
  },
};

export function associatedSpecEditorKinds(table: TableKey): EditorWindowKind[] {
  return [...(ASSOCIATED_SPEC_DEFINITIONS[table]?.editorKinds ?? [])];
}

export function associatedSpecRelPath(table: TableKey, id: string): string | null {
  if (!id) return null;
  return ASSOCIATED_SPEC_DEFINITIONS[table]?.relPath(id) ?? null;
}
