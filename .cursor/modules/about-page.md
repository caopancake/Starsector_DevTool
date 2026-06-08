# About 页面

## 定义

About 页面是在主窗口内展示工具版本、作者和构建时内联更新日志的只读信息页。

## 参考

- `CHANGELOG.md`：提供 About 页面更新内容区的唯一 markdown 输入。
- `package.json`：声明 `marked` 解析依赖和工具包版本，不直接驱动 About 页面运行态显示。
- `src/app/AppContent.vue`：按 `workspace.currentView === 'about'` 挂载 About 页面组件。
- `src/app/components/AboutPage.vue`：拥有 About 页面的静态元信息、markdown 解析、HTML 渲染和局部样式。
- `src/app/components/NavSidebar.vue`：提供进入 About 页面所需的主窗口导航按钮。
- `src/shared/types/workspace.types.ts`：把 `about` 定义为主窗口 `WorkspaceView` 的合法视图值。
- `src/stores/workspace.store.ts`：持有当前主窗口视图并提供 `navigateTo('about')` 状态入口。
- `vite.config.ts`：启用 Vite 构建链路，使 `?raw` 文本导入在前端构建时成为字符串模块。

## 边界

| 对象               | 归属                                                | 边界                                                                           |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| About 元信息       | `src/app/components/AboutPage.vue`                  | 页面内静态展示当前版本和作者；不从 Rust、配置文件或 workspace 状态派生。       |
| HTML 渲染          | `src/app/components/AboutPage.vue`                  | 只消费 `marked(changelogRaw)` 的输出；不接收用户输入、Mod 文件或后端返回文本。 |
| markdown 输入      | `CHANGELOG.md`                                      | 只作为构建时内联文本；不在运行时从磁盘读取。                                   |
| markdown 解析依赖  | `marked`                                            | 只负责把内联 markdown 转成 HTML 字符串；不拥有内容来源、导航或持久化。         |
| Rust 后端          | 无归属                                              | 不参与 About 内容读取、解析、保存、错误或日志链路。                            |
| Vite raw 导入      | Vite 构建链路                                       | 只把 `CHANGELOG.md` 转成前端字符串模块；不解析 markdown 语义。                 |
| workspace 视图状态 | `src/stores/workspace.store.ts`                     | 只记录当前主内容视图；不拥有 About 内容、版本、作者或解析结果。                |
| 主窗口挂载         | `src/app/AppContent.vue`                            | 只根据 `currentView` 选择组件；不改写 About 内容。                             |
| 导航入口           | `src/app/components/NavSidebar.vue`                 | 只调用 `workspace.navigateTo('about')`；不直接挂载组件或解析 markdown。        |
| 样式               | `src/app/components/AboutPage.vue` 与共享设置页样式 | 只控制 About 页面布局、元信息和 markdown HTML 的展示；不改变内容语义。         |

## 链路

### 进入页面

1. 用户点击主窗口左侧导航的 About 按钮。
2. `NavSidebar.vue` 调用 `workspace.navigateTo('about')`。
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
2. `workspace.store.ts` 的 `restoreFrom` 注册已持久化 Mod 和布局状态。
3. `restoreFrom` 将 `currentView` 设回 `overview`。
4. About 页面不会在启动恢复时自动成为当前视图。

## 规范

| 项目       | 规则                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| 内容输入   | 更新内容必须来自 `CHANGELOG.md?raw` 的构建时内联字符串。                                     |
| 版本输入   | 当前版本展示值由 `AboutPage.vue` 模板中的静态文本拥有。                                      |
| 作者输入   | 作者展示值由 `AboutPage.vue` 模板中的静态文本拥有。                                          |
| 解析输出   | `marked` 输出只能进入 About 页面更新内容区。                                                 |
| HTML 边界  | `v-html` 只能渲染本仓库构建时内联的 changelog 解析结果。                                     |
| 后端边界   | About 页面不得新增 Rust command、service、IPC、运行时文件读取或写盘流程。                    |
| 导航输入   | About 入口只能通过合法 `WorkspaceView` 值切换主窗口内容视图。                                |
| 状态持久化 | About 内容、解析结果、版本和作者都不持久化到 workspace 或 app config。                       |
| 启动恢复   | workspace 恢复时不得把 About 页面作为自动恢复目标。                                          |
| 样式输出   | About markdown 标签样式必须限制在组件局部 `.about-content` 范围内。                          |
| 错误语义   | `CHANGELOG.md` 缺失、raw 导入失败或 markdown 解析异常属于前端构建/运行错误，不转成业务提示。 |
| 修改入口   | 修改更新日志展示内容时编辑 `CHANGELOG.md`；修改版本或作者展示时编辑 `AboutPage.vue`。        |

## 陷阱

- 不得把 About 内容来源写成 `ABOUT.md`，当前仓库没有该输入链路。
- 不得让 About 页面运行时读取磁盘 markdown，否则会绕过 Vite raw 导入和只读页面边界。
- 不得把 `package.json` 或 `src-tauri/tauri.conf.json` 的版本当作 About 页面显示值的运行态来源。
- 不得把 `v-html` 扩展为渲染用户输入、Mod 内容、后端返回文本或外部链接内容。
- 不得在 About 页面加入保存、刷新、日志、dialog 或 workspace 持久化副作用。
- 不得让导航组件直接 import 或调用 About 页面的解析逻辑。
