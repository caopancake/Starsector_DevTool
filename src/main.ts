import { createApp } from 'vue';
import { createPinia } from 'pinia';
import naive from 'naive-ui';
import App from '@/app/App.vue';
import EditorWindowApp from '@/app/EditorWindowApp.vue';
import FileEditorApp from '@/app/FileEditorApp.vue';
import { loadSettings } from '@/services/app-config.service';
import { initializeSettingsStore } from '@/stores/settings.store';
import { showCurrentWindow } from '@/windows/current.window';
import './styles/index.css';
import './styles/file-editor.css';

const params = new window.URLSearchParams(window.location.search);
const windowKind = params.get('window');
const Root = windowKind === 'file-editor' ? FileEditorApp : windowKind === 'editor' ? EditorWindowApp : App;

async function bootstrap() {
  initializeSettingsStore(await initialSettings());
  createApp(Root).use(createPinia()).use(naive).mount('#app');
  await revealCurrentWindow();
}

void bootstrap().catch((error) => {
  const target = document.querySelector('#app');
  if (target) {
    const message = error instanceof Error ? error.message : String(error);
    target.innerHTML = `<div class="startup-error"><h1>启动失败</h1><pre>${escapeHtml(message)}</pre></div>`;
  }
  void revealCurrentWindow();
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}

async function initialSettings() {
  if (!windowKind) return loadSettings();
  const settings = params.get('settings');
  if (!settings) throw new Error('子窗口缺少主窗口 settings snapshot');
  return JSON.parse(settings);
}

async function revealCurrentWindow() {
  await showCurrentWindow();
}
