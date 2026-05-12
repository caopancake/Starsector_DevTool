import { createApp } from 'vue';
import naive from 'naive-ui';
import App from './app/App.vue';
import { pinia } from './app/providers/pinia';
import './styles.css';

createApp(App).use(pinia).use(naive).mount('#app');
