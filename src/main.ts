import { createApp } from 'vue';
import naive from 'naive-ui';
import App from './app/App.vue';
import FileEditorApp from './app/FileEditorApp.vue';
import { pinia } from './app/providers/pinia';
import './styles/index.css';
import './styles/file-editor.css';

const params = new window.URLSearchParams(window.location.search);
const Root = params.get('window') === 'file-editor' ? FileEditorApp : App;

createApp(Root).use(pinia).use(naive).mount('#app');
