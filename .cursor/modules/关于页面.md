# 关于页面

## 定义

主窗口只读信息页，展示静态元信息与构建时内联的更新记录。

## Owner 与链路

- 输入仅 `CHANGELOG.md?raw`；`AboutPage.vue` 用 `marked` 渲染；`NavSidebar -> workspace.showAbout -> AppContent` 挂载。
- `workspace.store` 只持有 `currentView='about'`；启动恢复一律回到 overview。

## 不变量

- 不运行时读 Markdown，不接收用户/Mod/后端文本，不保存、不 IPC、不记日志；`v-html` 仅渲染仓库内联 changelog。
- 静态元信息只归组件模板；样式复用设置页骨架，Markdown 样式限制在 `.about-content`。
