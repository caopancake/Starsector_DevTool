# About 页面

## 定义

About 页面负责在主窗口内展示工具静态元信息和构建时内联的更新记录，是只读信息页，不参与 ProjectSession、文件 IO、设置持久化或后端 command 链路。

## 参考

- `CHANGELOG.md`：提供 About 页面更新内容区的唯一 markdown 输入。
- `package.json`：声明 `marked` 解析依赖和工具包版本，不直接驱动 About 页面运行态显示。
- `src/app/AppContent.vue`：按 `workspace.currentView === 'about'` 挂载 About 页面组件。
- `src/app/components/AboutPage.vue`：拥有 About 页面的静态元信息、markdown 解析、HTML 渲染和局部样式。
- `src/app/components/NavSidebar.vue`：提供进入关于页面所需的主窗口导航按钮。
- `src/shared/types/workspace.types.ts`：把 `about` 定义为主窗口 `WorkspaceView` 的合法视图值。
- `src/stores/workspace.store.ts`：持有当前主窗口视图并提供 `showAbout()` 状态入口。
- `vite.config.ts`：启用 Vite 构建链路，使 `?raw` 文本导入在前端构建时成为字符串模块。

## 边界

- About 内容输入只来自 `CHANGELOG.md?raw` 的构建时内联字符串，不在运行时读取磁盘 markdown。
- About 元信息由 `AboutPage.vue` 静态模板拥有，不从 Rust、配置文件、package 版本或 workspace 状态派生。
- About HTML 渲染只消费 `marked(changelogRaw)` 的输出，不接收用户输入、Mod 文件、后端返回文本或外部内容。
- About 页面不新增 Rust command、service、IPC、运行时文件读取、写盘、日志或反馈副作用。
- Vite raw 导入只负责把 `CHANGELOG.md` 转成前端字符串模块，不拥有 markdown 解析语义。
- `marked` 只负责把内联 markdown 转成 HTML 字符串，不拥有内容来源、导航或持久化。
- workspace store 只记录 `about` 视图状态，不拥有 About 内容、版本、作者或解析结果。
- `AppContent.vue` 只根据 `currentView` 选择组件，不改写 About 内容。
- `NavSidebar.vue` 只调用 `workspace.showAbout()`，左侧可见文案使用中文“关于”，不直接挂载组件或解析 markdown。
- About 样式复用设置页页面骨架和 section 宽度，markdown 标签样式限制在组件局部 `.about-content` 范围内。

## 链路

### 进入页面

1. 用户点击主窗口左侧导航的关于按钮。
2. `NavSidebar.vue` 调用 `workspace.showAbout()`。
3. `workspace.store.ts` 将 `currentView` 写为 `about`。
4. `AppContent.vue` 命中 `workspace.currentView === 'about'` 分支。
5. `AppContent.vue` 挂载 `AboutPage.vue`。

### 内容渲染

1. Vite 构建时处理 `AboutPage.vue` 中的 `../../../CHANGELOG.md?raw` 导入。
2. `CHANGELOG.md` 内容以内联字符串形式成为 `changelogRaw`。
3. `AboutPage.vue` 的 `computed` 调用 `marked(changelogRaw)`。
4. `AboutPage.vue` 将解析结果绑定到 `changelogHtml`。
5. 模板用 `v-html="changelogHtml"` 渲染更新内容区。
6. 组件 scoped 样式通过 `:deep(...)` 约束 markdown 生成标签的显示。

### 视图恢复

1. workspace 持久化对象可以包含 `currentView` 字段。
2. `workspace.store.ts` 的 `applyPersistedWorkspaceSnapshot` 注册已持久化 Mod 和布局状态。
3. `applyPersistedWorkspaceSnapshot` 将 `currentView` 设回 `overview`。
4. About 页面不会在启动恢复时自动成为当前视图。

## 规范

- About 入口只能通过合法 `WorkspaceView` 值切换主窗口内容视图。
- 主窗口左侧导航入口必须显示为中文“关于”。
- About 页面必须复用设置页页面骨架，不建立独立页面布局体系。
- About markdown 标签样式必须限制在组件局部 `.about-content` 范围内。
- About 内容、解析结果、版本和作者都不持久化到 workspace 或 app config。
- About 页面不得在启动恢复时自动成为当前视图。
- `v-html` 只能渲染本仓库构建时内联的 changelog 解析结果。
- `CHANGELOG.md` 缺失、raw 导入失败或 markdown 解析异常属于前端构建或运行错误，不转成业务提示。
- 修改更新日志展示内容时编辑 `CHANGELOG.md`；修改版本或作者展示时编辑 `AboutPage.vue`。

## 陷阱

- 把 About 内容来源写成 `ABOUT.md`，会引入当前仓库不存在的输入链路。
- 让 About 页面运行时读取磁盘 markdown，会绕过 Vite raw 导入和只读页面边界。
- 把 `package.json` 或 `src-tauri/tauri.conf.json` 的版本当作 About 页面显示值的运行态来源，会让静态页面元信息出现第二权威。
- 把 `v-html` 扩展为渲染用户输入、Mod 内容、后端返回文本或外部链接内容，会扩大 HTML 渲染边界。
- 在 About 页面加入保存、刷新、日志、dialog 或 workspace 持久化副作用，会破坏只读信息页边界。
- 让导航组件直接 import 或调用 About 页面的解析逻辑，会把视图切换和内容渲染耦合在一起。
