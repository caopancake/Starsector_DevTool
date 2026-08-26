# 前端规范（AI 规则）

## 分层与命名

- 组件 PascalCase；职责文件使用 `*.service/store/orchestrator/window/events.ts`；共享类型为 `*.types.ts`；使用 `@/` 导入。
- `app` 渲染/窗口根/provider；`domain` 纯规则；`services` 单一后端能力；`stores` 内存状态；`orchestrators` 跨模块动作；`windows` 生命周期；`shared` 跨模块纯工具/API/type。

## 强制边界

- IPC：`业务前端 -> service -> shared/api -> Rust command`。仅 `shared/api` 调用 `invoke`；Tauri 仅限 API/runtime/windows 根边界。
- 组件只拥有渲染、输入、局部 UI；复杂页面通过 ViewModel。Store 不做 IO/确认/跨模块编排，ViewModel 不直接调用 API，service 不做跨模块用户动作。
- `ResourceRef` 仅来自后端 query；图片 data URL 仅经批量资源缓存。`shared` 不反向依赖业务层。
- 运行态不是磁盘权威。所有 Mod 数据按 `modRoot` 隔离；游戏概览不等于 ProjectSession；`tables.store` 仅草稿/选择/dirty。
- 保存、undo/redo 走所属 orchestrator 和后端 changeset。窗口由窗口边界单例化、同步；编辑器只写自身目标。
- 设置仅 app-data：主窗口为权威，子窗口仅接收完整 snapshot；字段编辑遵守 editMode，字符串换行不得丢失。

## UI 与验证

- 遵从 `css-guidelines.md`、token 与既有控件；稳定布局不用 inline style，动态值才可用。紧凑容器的文案与字号匹配。
- 前端改动必须通过 `typecheck`、`lint`、`format:check`、`encoding:check`。
