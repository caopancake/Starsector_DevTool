# 应用启动与窗口挂载系统

## 定义

应用启动与窗口挂载系统决定当前 WebView 是主窗口、独立编辑器窗口还是文件编辑器窗口，并为每类窗口挂载对应根组件。

## 边界

- `src/main.ts` 读取 `window.location.search`，根据 `window` 参数选择根组件。
- `src/app/App.vue` 是主窗口根组件，保留全局 provider、布局和 workspace shell actions 挂载。
- `src/app/EditorWindowApp.vue` 是舰船、武器、弹体和发射预览窗口根组件。
- `src/app/FileEditorApp.vue` 是文本文件编辑窗口根组件。
- `src/app/WindowShell.vue` 承载独立窗口共用外壳。
- `src/app/TitleBar.vue` 承载自定义标题栏。
- `src-tauri/src/lib.rs` 注册 command、single-instance、dialog、opener 和 fs plugin。

## 规范

- `window=file-editor` 只能挂载 `FileEditorApp`。
- `window=editor` 只能挂载 `EditorWindowApp`。
- 缺少 `window` 参数时挂载主窗口 `App`。
- 全局 CSS 由 `src/styles/index.css` 导入；文件编辑器额外导入 `src/styles/file-editor.css`。
- 独立窗口的加载失败只能显示在本窗口内，不能污染主窗口 workspace、project、tables 或 history 状态。

## 链路：窗口挂载

1. Tauri 创建 WebView 并加载前端入口。
2. `src/main.ts` 读取 URL 查询参数。
3. `window=file-editor` 时创建 `FileEditorApp`。
4. `window=editor` 时创建 `EditorWindowApp`。
5. 其它情况创建 `App`。
6. Vue app 安装 Pinia。
7. Vue app 挂载到 `#app`。
