<template>
  <div class="settings-page">
    <header class="settings-header"><h1>设置</h1></header>
    <section class="settings-section">
      <h3>游戏目录</h3>
      <div class="settings-row">
        <span>Starsector 安装路径</span>
        <div class="settings-control-row">
          <n-input :value="settings.starsectorRoot" size="small" placeholder="自动推断或手动指定" readonly />
          <n-button size="small" @click="pickStarsectorRoot">选择目录</n-button>
          <n-button v-if="settings.starsectorRoot" size="small" quaternary @click="settings.setStarsectorRoot('')">清除</n-button>
        </div>
      </div>
      <div v-if="settings.starsectorRoot" class="settings-hint">已设置: {{ settings.starsectorRoot }}</div>
      <div v-else class="settings-hint">未设置时，工具将从导入的 Mod 路径自动推断（mod_root 的上两级目录）。</div>
    </section>
    <section class="settings-section">
      <h3>外观</h3>
      <div class="settings-row">
        <span>主题</span>
        <n-switch class="tool-switch settings-theme-switch" :value="settings.isDark" @update:value="settings.toggleTheme">
          <template #checked>暗色</template>
          <template #unchecked>浅色</template>
        </n-switch>
      </div>
      <div class="settings-row settings-row-top">
        <span>主题色</span>
        <div class="accent-settings">
          <div class="accent-swatch-grid">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.value"
              class="accent-swatch-button"
              :class="{ active: settings.accent === preset.value }"
              type="button"
              :title="preset.name"
              @click="settings.setAccent(preset.value)"
            >
              <span :style="{ backgroundColor: preset.hex }" />
            </button>
            <div class="accent-custom-control" :class="{ active: settings.accent === 'custom' }">
              <button class="accent-custom-label" type="button" @click="settings.setAccent('custom')">自定义</button>
              <ColorPicker
                v-model="customAccentDraft"
                class="accent-custom-input"
                channels="rgb"
                output="hex-rgb"
                :allow-text-input="true"
                @click="settings.setAccent('custom')"
                @update:model-value="applyCustomAccent"
              />
            </div>
          </div>
          <div v-if="!customAccentValid" class="settings-hint settings-hint-error">自定义主题色必须是 #RRGGBB。</div>
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h3>编辑模式</h3>
      <div class="settings-row">
        <span>引用式编辑</span>
        <n-radio-group :value="settings.editMode" class="settings-mode-group" @update:value="settings.setEditMode">
          <n-radio-button value="plain">纯文本</n-radio-button>
          <n-radio-button value="smart">增强控件</n-radio-button>
        </n-radio-group>
      </div>
      <div class="settings-hint">纯文本模式下，CSV 表格和其它引用型编辑入口都只使用文本编辑；增强控件模式下保持当前实现。</div>
    </section>
    <section class="settings-section">
      <h3>全局记录</h3>
      <div class="settings-row">
        <span>文件历史记录</span>
        <n-input-number
          class="settings-number-input"
          :value="settings.historyLimit"
          :min="1"
          :max="MAX_HISTORY_LIMIT"
          :step="1"
          @update:value="settings.setHistoryLimit($event ?? settings.historyLimit)"
        />
      </div>
    </section>
    <section class="settings-section">
      <h3>配置文件</h3>
      <div class="settings-row">
        <span>Log 文件大小</span>
        <strong>{{ formattedLogSize }}</strong>
      </div>
      <div class="settings-control-row settings-file-actions">
        <n-button size="small" @click="openConfigFolderAction">打开配置文件夹</n-button>
        <n-button size="small" @click="openLogFileAction">打开 log 文件</n-button>
        <n-button size="small" type="error" secondary @click="confirmClearConfig">清空配置文件</n-button>
        <n-button size="small" type="error" secondary @click="confirmClearLog">清除 log 文件</n-button>
      </div>
      <div class="settings-hint">{{ logPathHint }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { pickDirectoryDialog } from '@/shared/runtime/dialog.runtime';
import { ACCENT_PRESETS, MAX_HISTORY_LIMIT, useSettingsStore } from '@/stores/settings.store';
import ColorPicker from '@/shared/ui/ColorPicker.vue';
import { clearConfig, clearLog, loadLogStatus, openConfigFolder, openLogFile } from '@/services/app-config.service';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import { reloadCurrentWebviewWindow } from '@/windows/current.window';

const settings = useSettingsStore();
const feedback = useAppFeedback();
const customAccentDraft = ref(settings.customAccent);
const customAccentValid = ref(true);
const logSizeBytes = ref(0);
const logPath = ref('');
const formattedLogSize = computed(() => formatBytes(logSizeBytes.value));
const logPathHint = computed(() => (logPath.value ? `Log 文件: ${logPath.value}` : 'Log 文件尚未创建。'));

onMounted(() => {
  void refreshLogStatus();
});

watch(
  () => settings.customAccent,
  (value) => {
    customAccentDraft.value = value;
    customAccentValid.value = true;
  },
);

function applyCustomAccent(value: string | number[] = customAccentDraft.value) {
  if (typeof value !== 'string') return;
  customAccentDraft.value = value;
  const applied = settings.setCustomAccent(value);
  customAccentValid.value = applied;
}

async function pickStarsectorRoot() {
  const selected = await pickDirectoryDialog('选择 Starsector 安装目录');
  if (selected && typeof selected === 'string') {
    settings.setStarsectorRoot(selected);
  }
}

async function refreshLogStatus() {
  try {
    const status = await loadLogStatus();
    logSizeBytes.value = status.sizeBytes;
    logPath.value = status.path;
  } catch (error) {
    feedback.error(error, '读取 log 状态失败');
  }
}

async function openConfigFolderAction() {
  try {
    await openConfigFolder();
  } catch (error) {
    feedback.error(error, '打开配置文件夹失败');
  }
}

async function openLogFileAction() {
  try {
    await openLogFile();
    await refreshLogStatus();
  } catch (error) {
    feedback.error(error, '打开 log 文件失败');
  }
}

function confirmClearConfig() {
  feedback.confirmDanger({
    title: '清空配置文件',
    content: '将删除配置目录内除 log 文件外的工具配置文件。确认清空？',
    actionText: '清空',
    onConfirm: async () => {
      try {
        await clearConfig();
        await refreshLogStatus();
        feedback.success('配置文件已清空');
        await reloadCurrentWebviewWindow();
      } catch (error) {
        feedback.error(error, '清空配置文件失败');
      }
    },
  });
}

function confirmClearLog() {
  feedback.confirmDanger({
    title: '清除 log 文件',
    content: '将清空当前 log 文件内容。确认清除？',
    actionText: '清除',
    onConfirm: async () => {
      try {
        const status = await clearLog();
        logSizeBytes.value = status.sizeBytes;
        logPath.value = status.path;
        feedback.success('log 文件已清除');
      } catch (error) {
        feedback.error(error, '清除 log 文件失败');
      }
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
</script>
