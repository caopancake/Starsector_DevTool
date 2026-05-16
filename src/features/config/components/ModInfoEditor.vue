<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>Mod 信息</h1>
    </header>

    <section class="settings-section">
      <h3>基本信息</h3>
      <div class="settings-row">
        <span>ID</span>
        <n-input :value="str(local.id)" size="small" disabled />
      </div>
      <div class="settings-row">
        <span>名称</span>
        <n-input :value="str(local.name)" size="small" @update:value="set('name', $event)" />
      </div>
      <div class="settings-row">
        <span>作者</span>
        <n-input :value="str(local.author)" size="small" @update:value="set('author', $event)" />
      </div>
      <div class="settings-row">
        <span>版本</span>
        <n-input :value="versionStr" size="small" @update:value="setVersion($event)" />
      </div>
      <div class="settings-row">
        <span>游戏版本</span>
        <n-input :value="str(local.gameVersion)" size="small" @update:value="set('gameVersion', $event)" />
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

    <section class="settings-section">
      <h3>插件</h3>
      <div class="settings-row">
        <span>modPlugin</span>
        <n-input :value="str(local.modPlugin)" size="small" @update:value="set('modPlugin', $event)" />
      </div>
      <div class="settings-row">
        <span>totalConversion</span>
        <n-switch :value="local.totalConversion === true" @update:value="set('totalConversion', $event)" />
      </div>
      <div class="settings-row">
        <span>utility</span>
        <n-switch :value="local.utility === true" @update:value="set('utility', $event)" />
      </div>
    </section>

    <section class="settings-section">
      <h3>JAR 文件</h3>
      <div v-for="(jar, i) in jars" :key="i" class="settings-row">
        <n-input :value="jar" size="small" @update:value="updateJar(i, $event)" />
        <n-button size="tiny" quaternary @click="removeJar(i)">删除</n-button>
      </div>
      <n-button size="small" @click="addJar">添加 JAR</n-button>
    </section>

    <section class="settings-section">
      <h3>依赖</h3>
      <div v-for="(dep, i) in deps" :key="i" class="settings-row" style="gap: 4px">
        <n-input :value="dep.id ?? ''" placeholder="id" size="small" style="flex: 1" @update:value="updateDep(i, 'id', $event)" />
        <n-input :value="dep.name ?? ''" placeholder="name" size="small" style="flex: 1" @update:value="updateDep(i, 'name', $event)" />
        <n-button size="tiny" quaternary @click="removeDep(i)">删除</n-button>
      </div>
      <n-button size="small" @click="addDep">添加依赖</n-button>
    </section>

    <section class="settings-section">
      <h3>其他字段</h3>
      <JsonFieldEditor v-model="local" :known-keys="KNOWN_KEYS" />
    </section>

    <footer class="settings-footer">
      <n-button type="primary" :loading="saving" @click="save">保存 mod_info.json</n-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import { useProjectStore } from '../../project/project.store';
import { useConfigStore } from '../config.store';
import { useHistoryStore } from '../../history/history.store';
import { useSettingsStore } from '../../../app/settings.store';
import { saveModInfoData } from '../config.service';
import { deepClone } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import type { JsonValue, RowData } from '../../../shared/types';
import JsonFieldEditor from './JsonFieldEditor.vue';

const KNOWN_KEYS = [
  'id',
  'name',
  'author',
  'version',
  'gameVersion',
  'description',
  'modPlugin',
  'jars',
  'dependencies',
  'totalConversion',
  'utility',
];

const project = useProjectStore();
const configStore = useConfigStore();
const historyStore = useHistoryStore();
const settings = useSettingsStore();

const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => ({ theme: settings.naiveTheme })),
});

const saving = ref(false);
const local = ref<RowData>({});

// Initialize from project data
watch(
  () => project.activeModData?.modInfo,
  (modInfo) => {
    if (modInfo) local.value = deepClone(modInfo);
  },
  { immediate: true },
);

function str(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const versionStr = computed(() => {
  const v = local.value.version;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, JsonValue>;
    return `${obj.major ?? 0}.${obj.minor ?? 0}.${obj.patch ?? '0'}`;
  }
  return str(v);
});

const jars = computed<string[]>(() => {
  const j = local.value.jars;
  if (Array.isArray(j)) return j.map((x) => String(x ?? ''));
  return [];
});

const deps = computed<RowData[]>(() => {
  const d = local.value.dependencies;
  if (Array.isArray(d)) return d as RowData[];
  return [];
});

function set(key: string, value: JsonValue) {
  local.value = { ...local.value, [key]: value };
}

function setVersion(raw: string) {
  // Try to preserve object version format if original was object
  const orig = project.activeModData?.modInfo?.version;
  if (orig && typeof orig === 'object' && !Array.isArray(orig)) {
    const parts = raw.split('.');
    set('version', {
      major: parseInt(parts[0]) || 0,
      minor: parseInt(parts[1]) || 0,
      patch: parts[2] ?? '0',
    });
  } else {
    set('version', raw);
  }
}

function updateJar(index: number, value: string) {
  const arr = [...jars.value];
  arr[index] = value;
  set('jars', arr);
}

function addJar() {
  set('jars', [...jars.value, '']);
}

function removeJar(index: number) {
  const arr = [...jars.value];
  arr.splice(index, 1);
  set('jars', arr);
}

function updateDep(index: number, field: string, value: string) {
  const arr = deps.value.map((d) => ({ ...d }));
  arr[index] = { ...arr[index], [field]: value };
  set('dependencies', arr);
}

function addDep() {
  set('dependencies', [...deps.value, { id: '', name: '' }]);
}

function removeDep(index: number) {
  const arr = [...deps.value];
  arr.splice(index, 1);
  set('dependencies', arr);
}

async function save() {
  const modData = project.activeModData;
  if (!modData) return;
  saving.value = true;
  try {
    const previousSpec = deepClone(modData.modInfo);
    await saveModInfoData(modData.modRoot, local.value);
    // Update project store
    modData.modInfo = deepClone(local.value);
    configStore.updateSnapshot(local.value);
    // Push to history
    historyStore.pushEvent(
      { type: 'editor-save', editorKind: 'ship', id: '__mod_info__', previousSpec, newSpec: deepClone(local.value) },
      '保存 mod_info.json',
    );
    historyStore.pushCheckpoint('editor-save', 'mod_info.json 已保存');
    message.success('mod_info.json 已保存');
  } catch (error) {
    message.error(formatError(error));
  } finally {
    saving.value = false;
  }
}
</script>
