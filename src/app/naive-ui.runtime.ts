import { defineAsyncComponent, type App, type Component } from 'vue';
import { NButton } from 'naive-ui/es/button';
import { NConfigProvider } from 'naive-ui/es/config-provider';
import { NDialogProvider } from 'naive-ui/es/dialog';
import { NMessageProvider } from 'naive-ui/es/message';

export function installNaiveUi(app: App): void {
  app.component('NConfigProvider', NConfigProvider);
  app.component('NDialogProvider', NDialogProvider);
  app.component('NButton', NButton);
  app.component('NMessageProvider', NMessageProvider);
  registerAsyncNaiveComponent(app, 'NAutoComplete', async () => (await import('naive-ui/es/auto-complete')).NAutoComplete);
  registerAsyncNaiveComponent(app, 'NCheckbox', async () => (await import('naive-ui/es/checkbox')).NCheckbox);
  registerAsyncNaiveComponent(app, 'NCollapse', async () => (await import('naive-ui/es/collapse')).NCollapse);
  registerAsyncNaiveComponent(app, 'NCollapseItem', async () => (await import('naive-ui/es/collapse')).NCollapseItem);
  registerAsyncNaiveComponent(app, 'NDynamicTags', async () => (await import('naive-ui/es/dynamic-tags')).NDynamicTags);
  registerAsyncNaiveComponent(app, 'NInput', async () => (await import('naive-ui/es/input')).NInput);
  registerAsyncNaiveComponent(app, 'NInputNumber', async () => (await import('naive-ui/es/input-number')).NInputNumber);
  registerAsyncNaiveComponent(app, 'NModal', async () => (await import('naive-ui/es/modal')).NModal);
  registerAsyncNaiveComponent(app, 'NPopover', async () => (await import('naive-ui/es/popover')).NPopover);
  registerAsyncNaiveComponent(app, 'NRadioButton', async () => (await import('naive-ui/es/radio')).NRadioButton);
  registerAsyncNaiveComponent(app, 'NRadioGroup', async () => (await import('naive-ui/es/radio')).NRadioGroup);
  registerAsyncNaiveComponent(app, 'NSelect', async () => (await import('naive-ui/es/select')).NSelect);
  registerAsyncNaiveComponent(app, 'NSlider', async () => (await import('naive-ui/es/slider')).NSlider);
  registerAsyncNaiveComponent(app, 'NSwitch', async () => (await import('naive-ui/es/switch')).NSwitch);
}

function registerAsyncNaiveComponent(app: App, name: string, loader: () => Promise<Component>): void {
  app.component(name, defineAsyncComponent(loader));
}
