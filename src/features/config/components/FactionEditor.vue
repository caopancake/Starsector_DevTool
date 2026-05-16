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
        <n-input :value="str(local.id)" size="small" disabled />
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
        <span>Logo</span>
        <n-input :value="str(local.logo)" size="small" @update:value="set('logo', $event)" />
      </div>
      <div class="settings-row">
        <span>Crest</span>
        <n-input :value="str(local.crest)" size="small" @update:value="set('crest', $event)" />
      </div>
    </section>

    <!-- 已知舰船标签 -->
    <section class="settings-section">
      <h3>已知舰船 (knownShips)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('knownShips')" @update:value="setTags('knownShips', $event)" />
      </div>
    </section>

    <!-- 已知武器标签 -->
    <section class="settings-section">
      <h3>已知武器 (knownWeapons)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('knownWeapons')" @update:value="setTags('knownWeapons', $event)" />
      </div>
    </section>

    <!-- 已知联队标签 -->
    <section class="settings-section">
      <h3>已知联队 (knownFighters)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('knownFighters')" @update:value="setTags('knownFighters', $event)" />
      </div>
    </section>

    <!-- 已知船插标签 -->
    <section class="settings-section">
      <h3>已知船插 (knownHullMods)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('knownHullMods')" @update:value="setTags('knownHullMods', $event)" />
      </div>
    </section>

    <!-- shipsWhenImporting -->
    <section class="settings-section">
      <h3>导入舰船 (shipsWhenImporting)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('shipsWhenImporting')" @update:value="setTags('shipsWhenImporting', $event)" />
      </div>
    </section>

    <!-- knownIndustries -->
    <section class="settings-section">
      <h3>已知工业 (knownIndustries)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('knownIndustries')" @update:value="setTags('knownIndustries', $event)" />
      </div>
    </section>

    <!-- priorityShips -->
    <section class="settings-section">
      <h3>优先舰船 (priorityShips)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('priorityShips')" @update:value="setTags('priorityShips', $event)" />
      </div>
    </section>

    <!-- priorityWeapons -->
    <section class="settings-section">
      <h3>优先武器 (priorityWeapons)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('priorityWeapons')" @update:value="setTags('priorityWeapons', $event)" />
      </div>
    </section>

    <!-- priorityFighters -->
    <section class="settings-section">
      <h3>优先联队 (priorityFighters)</h3>
      <div class="settings-row">
        <span>Tags</span>
        <n-dynamic-tags :value="getTags('priorityFighters')" @update:value="setTags('priorityFighters', $event)" />
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
      <n-button type="primary" :loading="saving" @click="save">保存 {{ factionId }}.faction</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useHistoryStore } from '../../history/history.store';
import { useSettingsStore } from '../../../app/settings.store';
import { saveFactionData } from '../config.service';
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

function getTags(field: string): string[] {
  const obj = local.value[field];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const tags = (obj as Record<string, JsonValue>).tags;
    if (Array.isArray(tags)) return tags.map(String);
  }
  return [];
}

function setTags(field: string, tags: string[]) {
  const existing = local.value[field];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    set(field, { ...(existing as Record<string, JsonValue>), tags });
  } else {
    set(field, { tags });
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
    const previousSpec = deepClone(modData.factionFiles[props.factionId] ?? {});
    await saveFactionData(modData.modRoot, props.factionId, local.value);
    modData.factionFiles[props.factionId] = deepClone(local.value);
    historyStore.pushEvent(
      { type: 'editor-save', editorKind: 'ship', id: props.factionId, previousSpec, newSpec: deepClone(local.value) },
      `保存 ${props.factionId}.faction`,
    );
    historyStore.pushCheckpoint('editor-save', `${props.factionId}.faction 已保存`);
    message.success(`${props.factionId}.faction 已保存`);
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}
</script>
