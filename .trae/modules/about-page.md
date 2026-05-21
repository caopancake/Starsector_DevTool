# About 页面

## 定义

About 页面在左侧导航"设置"下方提供独立 tab，读取项目根目录的 `ABOUT.md` 并渲染为 HTML 展示版本、作者和更新日志。

## 边界

- `ABOUT.md` 是 About 页面的唯一内容来源，构建时通过 Vite `?raw` 内联为字符串常量。
- `src/app/components/AboutPage.vue` 负责 markdown 解析和 HTML 渲染。
- `marked` 是 markdown 解析依赖。
- `src/app/components/NavSidebar.vue` 提供 About 导航按钮。
- `src/app/AppContent.vue` 按 `workspace.currentView === 'about'` 条件挂载 AboutPage。

## 规范

- About 内容只来自构建时打包的 `ABOUT.md`，不访问后端、不读取运行时文件。
- 修改 About 内容只需编辑 `ABOUT.md`，下次构建自动生效。
- `v-html` 渲染的 HTML 来自本地静态文件，不存在 XSS 风险。
- About 页面不承载任何业务状态、保存或编辑能力。

## 链路

1. Vite 构建时将 `ABOUT.md` 内容内联为 JS 字符串常量。
2. `AboutPage.vue` 导入该常量，用 `marked()` 解析为 HTML。
3. 用 `v-html` 渲染到页面。
