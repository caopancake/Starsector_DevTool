import { createApp } from 'vue';
import naive from 'naive-ui';
import App from './app/App.vue';
import EditorWindowApp from './app/EditorWindowApp.vue';
import FileEditorApp from './app/FileEditorApp.vue';
import { pinia } from './app/providers/pinia';
import './styles/index.css';
import './styles/file-editor.css';

const params = new window.URLSearchParams(window.location.search);
const windowKind = params.get('window');
const Root = windowKind === 'file-editor' ? FileEditorApp : windowKind === 'editor' ? EditorWindowApp : App;

createApp(Root).use(pinia).use(naive).mount('#app');
