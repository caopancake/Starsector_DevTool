import { computed, ref } from 'vue';
import type { EditorWindowKind } from '@/windows/editor.window';
import { queryEditorEntityBundle, type EditorEntityBundle } from '@/services/editor.service';
import type { RowData } from '@/shared/types';
import type { FileChangeRecord } from '@/shared/api/write-api';
import { defaultWeapon } from '@/shared/lib/starsector';
import { formatError } from '@/shared/lib/errors';
import {
  saveProjectileSpecWithUserAction,
  saveShipSpecWithUserAction,
  saveWeaponSpecWithUserAction,
} from '@/orchestrators/editor-save.orchestrator';

export function useEditorWindowViewModel(params: { sessionId: string; modRoot: string; id: string; kind: EditorWindowKind }) {
  const editorData = ref<EditorEntityBundle | null>(null);
  const loading = ref(true);
  const errorText = ref('');

  const weaponForEditor = computed<RowData>(() => {
    const data = editorData.value;
    if (!data) return {};
    return data.weaponFiles[params.id] || defaultWeapon(params.id, data.weaponRow);
  });
  const shipSpriteForEditor = computed(() => editorData.value?.shipSpriteData ?? '');

  const missingEditorText = computed(() => {
    if (!params.modRoot || !params.id) return '缺少 Mod 路径或目标 id。';
    if (params.kind === 'ship') return `找不到 ${params.id}.ship。`;
    if (params.kind === 'weapon') return `找不到 ${params.id}.wpn。`;
    if (params.kind === 'projectile') return `找不到 ${params.id}.proj。`;
    return `找不到 ${params.id} 的预览数据。`;
  });

  async function queryEditorData() {
    if (!params.sessionId || !params.modRoot || !params.id) {
      errorText.value = '缺少 Mod 路径或目标 id。';
      loading.value = false;
      return;
    }
    try {
      editorData.value = await queryEditorEntityBundle(params.sessionId, params.kind, params.id);
    } catch (error) {
      errorText.value = formatError(error);
    } finally {
      loading.value = false;
    }
  }

  function saveEditorSpec(kind: Extract<EditorWindowKind, 'ship' | 'weapon' | 'projectile'>, data: RowData): Promise<FileChangeRecord[]> {
    if (kind === 'ship') return saveShipSpecWithUserAction(params.modRoot, params.id, data);
    if (kind === 'weapon') return saveWeaponSpecWithUserAction(params.modRoot, params.id, data);
    return saveProjectileSpecWithUserAction(params.modRoot, params.id, data);
  }

  return {
    editorData,
    loading,
    errorText,
    weaponForEditor,
    shipSpriteForEditor,
    missingEditorText,
    queryEditorData,
    saveEditorSpec,
  };
}
