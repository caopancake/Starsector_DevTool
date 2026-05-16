<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>势力编辑 — {{ str(local.displayName) || factionId }}</h1>
    </header>

    <!-- 基本信息 -->
    <section class="settings-section">
      <h3>基本信息</h3>
      <div class="settings-row">
        <span>ID</span>
        <div style="flex: 1">
          <n-input :value="str(local.id)" size="small" @update:value="set('id', $event)" />
          <span class="field-warning">修改 ID 可能导致依赖此 Mod 的其他 Mod 失效</span>
        </div>
      </div>
      <div class="settings-row">
        <span>显示名称</span>
        <n-input :value="str(local.displayName)" size="small" @update:value="set('displayName', $event)" />
      </div>
      <div class="settings-row">
        <span>完整名称</span>
        <n-input :value="str(local.displayNameLong)" size="small" @update:value="set('displayNameLong', $event)" />
      </div>
      <div class="settings-row">
        <span>带冠词名称</span>
        <n-input :value="str(local.displayNameWithArticle)" size="small" @update:value="set('displayNameWithArticle', $event)" />
      </div>
      <div class="settings-row">
        <span>is/are</span>
        <n-input :value="str(local.displayNameIsOrAre)" size="small" @update:value="set('displayNameIsOrAre', $event)" />
      </div>
      <div class="settings-row">
        <span>舰名前缀</span>
        <n-input :value="str(local.shipNamePrefix)" size="small" @update:value="set('shipNamePrefix', $event)" />
      </div>
      <div class="settings-row">
        <span>描述</span>
        <n-input
          :value="str(local.description)"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          size="small"
          @update:value="set('description', $event)"
        />
      </div>
    </section>

    <!-- 颜色 -->
    <section class="settings-section">
      <h3>颜色</h3>
      <div class="settings-row">
        <span>主颜色 (color)</span>
        <ColorArrayInput :model-value="local.color" @update:model-value="set('color', $event)" />
      </div>
      <div class="settings-row">
        <span>基础颜色 (baseColor)</span>
        <ColorArrayInput :model-value="local.baseColor" @update:model-value="set('baseColor', $event)" />
      </div>
      <div class="settings-row">
        <span>暗色 (darkColor)</span>
        <ColorArrayInput :model-value="local.darkColor" @update:model-value="set('darkColor', $event)" />
      </div>
    </section>

    <!-- 图标 -->
    <section class="settings-section">
      <h3>图标</h3>
      <div class="settings-row">
        <span>标志 (logo)</span>
        <div style="flex: 1">
          <n-input :value="str(local.logo)" size="small" @update:value="set('logo', $event)" />
          <img
            v-if="logoSrc"
            :src="logoSrc"
            class="faction-icon-preview"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
      </div>
      <div class="settings-row">
        <span>纹章 (crest)</span>
        <div style="flex: 1">
          <n-input :value="str(local.crest)" size="small" @update:value="set('crest', $event)" />
          <img
            v-if="crestSrc"
            :src="crestSrc"
            class="faction-icon-preview"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
      </div>
    </section>

    <!-- 已知舰船标签 -->
    <section class="settings-section">
      <h3>已知舰船 (knownShips)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('knownShips')"
          :options="shipTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('knownShips', $event)"
        />
      </div>
    </section>

    <!-- 已知武器标签 -->
    <section class="settings-section">
      <h3>已知武器 (knownWeapons)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('knownWeapons')"
          :options="weaponTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('knownWeapons', $event)"
        />
      </div>
    </section>

    <!-- 已知联队标签 -->
    <section class="settings-section">
      <h3>已知联队 (knownFighters)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('knownFighters')"
          :options="wingTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('knownFighters', $event)"
        />
      </div>
    </section>

    <!-- 已知船插标签 -->
    <section class="settings-section">
      <h3>已知船插 (knownHullMods)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('knownHullMods')"
          :options="hullmodTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('knownHullMods', $event)"
        />
      </div>
    </section>

    <!-- shipsWhenImporting -->
    <section class="settings-section">
      <h3>导入舰船 (shipsWhenImporting)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('shipsWhenImporting')"
          :options="shipTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('shipsWhenImporting', $event)"
        />
      </div>
    </section>

    <!-- knownIndustries -->
    <section class="settings-section">
      <h3>已知工业 (knownIndustries)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('knownIndustries')"
          :options="industryTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('knownIndustries', $event)"
        />
      </div>
    </section>

    <!-- priorityShips -->
    <section class="settings-section">
      <h3>优先舰船 (priorityShips)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('priorityShips')"
          :options="shipTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('priorityShips', $event)"
        />
      </div>
    </section>

    <!-- priorityWeapons -->
    <section class="settings-section">
      <h3>优先武器 (priorityWeapons)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('priorityWeapons')"
          :options="weaponTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('priorityWeapons', $event)"
        />
      </div>
    </section>

    <!-- priorityFighters -->
    <section class="settings-section">
      <h3>优先联队 (priorityFighters)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-select
          :value="getTagsArray('priorityFighters')"
          :options="wingTagOptions"
          multiple
          filterable
          tag
          size="small"
          @update:value="setTagsArray('priorityFighters', $event)"
        />
      </div>
    </section>

    <!-- 肖像 -->
    <section class="settings-section">
      <h3>肖像 (portraits)</h3>
      <div class="settings-row" style="flex-direction: column; align-items: stretch">
        <span style="margin-bottom: 8px">男性</span>
        <n-dynamic-tags :value="getPortraits('male')" @update:value="setPortraits('male', $event)" />
      </div>
      <div class="settings-row" style="flex-direction: column; align-items: stretch">
        <span style="margin-bottom: 8px">女性</span>
        <n-dynamic-tags :value="getPortraits('female')" @update:value="setPortraits('female', $event)" />
      </div>
    </section>

    <!-- 其他字段 -->
    <section class="settings-section">
      <h3>其他字段</h3>
      <JsonFieldEditor v-model="local" :known-keys="KNOWN_KEYS" />
    </section>

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save">保存 {{ str(local.id) || factionId }}.faction</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useHistoryStore } from '../../history/history.store';
import { useSettingsStore } from '../../../app/settings.store';
import { saveFactionData, deleteFactionFile } from '../config.service';
import { loadImageDataUrl } from '../../../shared/api/tauri';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue, RowData } from '../../../shared/types';
import JsonFieldEditor from './JsonFieldEditor.vue';
import ColorArrayInput from './ColorArrayInput.vue';

const KNOWN_KEYS = [
  'id',
  'displayName',
  'displayNameLong',
  'displayNameWithArticle',
  'displayNameIsOrAre',
  'color',
  'baseColor',
  'darkColor',
  'logo',
  'crest',
  'shipNamePrefix',
  'description',
  'knownShips',
  'knownWeapons',
  'knownFighters',
  'knownHullMods',
  'shipsWhenImporting',
  'knownIndustries',
  'priorityShips',
  'priorityWeapons',
  'priorityFighters',
  'portraits',
];

const props = defineProps<{ factionId: string }>();

const project = useProjectStore();
const historyStore = useHistoryStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const saving = ref(false);
const local = ref<RowData>({});

watch(
  () => props.factionId,
  (id) => {
    const modData = project.activeModData;
    if (modData && modData.factionFiles[id]) {
      local.value = deepClone(modData.factionFiles[id]);
    } else {
      local.value = { id };
    }
  },
  { immediate: true },
);

function str(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function set(key: string, value: JsonValue) {
  local.value = { ...local.value, [key]: value };
}

// --- Image preview ---
const logoSrc = ref('');
const crestSrc = ref('');

async function refreshImagePreviews() {
  const modRoot = project.activeModData?.modRoot;
  const logo = str(local.value.logo);
  const crest = str(local.value.crest);

  if (logo && modRoot) {
    try {
      logoSrc.value = (await loadImageDataUrl(modRoot, logo)) ?? '';
    } catch {
      logoSrc.value = '';
    }
  } else {
    logoSrc.value = '';
  }

  if (crest && modRoot) {
    try {
      crestSrc.value = (await loadImageDataUrl(modRoot, crest)) ?? '';
    } catch {
      crestSrc.value = '';
    }
  } else {
    crestSrc.value = '';
  }
}

watch(
  () => [str(local.value.logo), str(local.value.crest)],
  () => refreshImagePreviews(),
  { immediate: true },
);

// --- Tag extraction from CSV rows ---
function extractTags(rows: RowData[], column = 'tags'): string[] {
  const tagSet = new Set<string>();
  for (const row of rows) {
    const raw = String(row[column] ?? '');
    for (const tag of raw.split(',')) {
      const t = tag.trim();
      if (t) tagSet.add(t);
    }
  }
  return [...tagSet].sort();
}

const shipTagOptions = computed(() => extractTags(project.activeModData?.ships ?? []).map((t) => ({ label: t, value: t })));
const weaponTagOptions = computed(() => extractTags(project.activeModData?.weapons ?? []).map((t) => ({ label: t, value: t })));
const wingTagOptions = computed(() => extractTags(project.activeModData?.wings ?? []).map((t) => ({ label: t, value: t })));
const hullmodTagOptions = computed(() => extractTags(project.activeModData?.hullmods ?? []).map((t) => ({ label: t, value: t })));
const industryTagOptions = computed(() => extractTags(project.activeModData?.industries ?? []).map((t) => ({ label: t, value: t })));

// --- Tags array helpers (for n-select multiple) ---
function getTagsArray(field: string): string[] {
  const obj = local.value[field];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const tags = (obj as Record<string, JsonValue>).tags;
    if (Array.isArray(tags)) return tags.map(String);
  }
  return [];
}

function setTagsArray(field: string, values: string[]) {
  const existing = local.value[field];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    set(field, { ...(existing as Record<string, JsonValue>), tags: values });
  } else {
    set(field, { tags: values });
  }
}

function getPortraits(gender: 'male' | 'female'): string[] {
  const portraits = local.value.portraits;
  if (portraits && typeof portraits === 'object' && !Array.isArray(portraits)) {
    const list = (portraits as Record<string, JsonValue>)[gender];
    if (Array.isArray(list)) return list.map(String);
  }
  return [];
}

function setPortraits(gender: 'male' | 'female', list: string[]) {
  const existing = local.value.portraits;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    set('portraits', { ...(existing as Record<string, JsonValue>), [gender]: list });
  } else {
    set('portraits', { [gender]: list });
  }
}

async function save() {
  const modData = project.activeModData;
  if (!modData) return;
  saving.value = true;
  try {
    const newId = str(local.value.id) || props.factionId;
    const oldId = props.factionId;
    const idChanged = newId !== oldId;

    const previousSpec = deepClone(modData.factionFiles[oldId] ?? {});

    // Save with new ID (backend writes to {newId}.faction)
    await saveFactionData(modData.modRoot, newId, local.value);

    if (idChanged) {
      // Delete old faction file
      await deleteFactionFile(modData.modRoot, oldId);
      // Update factionFiles map: remove old, add new
      delete modData.factionFiles[oldId];
    }

    modData.factionFiles[newId] = deepClone(local.value);

    historyStore.pushEvent(
      { type: 'editor-save', editorKind: 'ship', id: newId, previousSpec, newSpec: deepClone(local.value) },
      `保存 ${newId}.faction`,
    );
    historyStore.pushCheckpoint('editor-save', `${newId}.faction 已保存`);
    message.success(`${newId}.faction 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.field-warning {
  display: block;
  font-size: 11px;
  color: var(--color-warning, #e6a23c);
  margin-top: 2px;
}

.faction-icon-preview {
  margin-top: 4px;
  max-width: 64px;
  max-height: 64px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  image-rendering: pixelated;
}
</style>
