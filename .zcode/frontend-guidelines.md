# Frontend Guidelines

本文件维护 `src/` 的分层、依赖、状态、IPC、窗口与资源边界。通用调查和验证流程见 `.zcode/workflow.md`。

## 分层与命名

- `app` 只允许拥有窗口根、provider、页面、组件和 ViewModel/composable；组件必须使用 PascalCase。
- `domain` 只允许拥有纯规则和转换；`services` 只允许包装单一后端能力；`orchestrators` 只允许编排跨模块用户动作。
- `stores` 只允许保存内存运行态；`windows` 只允许管理窗口身份、生命周期和事件；`shared` 只允许保存跨模块 API、runtime、类型和纯工具。
- service、store、orchestrator 与 window 文件必须分别使用 `.service.ts`、`.store.ts`、`.orchestrator.ts` 与 `.window.ts` 或 `.events.ts` 后缀；共享业务类型必须位于 `shared/types` 或 domain。
- 项目内导入必须使用 `@/`；共享类型 owner 文件必须直接导入具体类型文件，严禁反向导入 shared types barrel。

## 依赖方向

- `shared` 只允许依赖 `shared`；`domain` 只允许依赖 `domain` 与 `shared`。
- `services` 只允许依赖 service、domain 与 shared；store 只允许依赖 store、domain 与 shared。
- orchestrator 允许协调 service、store、domain、window 与 shared；window 允许依赖 window、orchestrator、service、domain 与 shared。
- 组件必须通过 ViewModel/composable 消费状态和动作，严禁直接调用 service、orchestrator 或 wire API。
- ViewModel/composable 严禁直接调用 `shared/api`；跨进程业务能力必须先由 service 包装。

## IPC 与运行时

- `shared/api` 是唯一 `invoke` wire adapter；业务调用链必须为 service -> `shared/api` -> Rust command。
- Tauri API 只允许出现在 `shared/api`、`shared/runtime` 与 `windows`；dialog、窗口和事件必须由各自 runtime 边界包装。
- `shared/api` 只允许进行 payload 适配和结果返回，严禁定义业务可见类型或业务规则。
- 前端严禁使用 `localStorage`、`sessionStorage` 或 `indexedDB`；持久化必须通过正式 app config、workspace 或 Mod 后端能力。

## 状态与保存

- 所有按 Mod 归属的状态、缓存、草稿、选择与历史必须按 `modRoot` 隔离；游戏概览与 ProjectSession 必须保持独立身份。
- Store 严禁拥有 IO、确认框或跨模块编排；Draft Session 必须拥有 base、draft、dirty、revision 与 pending external 状态。
- 保存、删除、导入和 undo/redo 必须经过所属 orchestrator、write service、changeset 与 ProjectSession refresh。
- 组件和 ViewModel 严禁构造磁盘路径、`ResourceRef` 或后端实体身份；已保存数据与 dirty draft 必须通过显式外部更新语义交接。

## 窗口与资源

- 常规窗口身份必须包含完整 session、`modRoot` 和业务目标；错误恢复文件窗口必须包含调用链提供的 `modRoot` 和错误文件路径，并使用 recovery 模式与常规 session 模式区分；子窗口严禁自行打开 ProjectSession 或读取 settings 文件。
- 错误恢复文件入口只允许在错误文件属于调用链提供的 `modRoot` 时启用；恢复窗口保存只允许经过无 session 文件写入能力，严禁发送依赖 ProjectSession 的保存同步事件。
- 主窗口拥有 settings 持久化权威；子窗口只允许接收完整 snapshot，并通过正式事件同步。
- 资源只允许由后端 query 返回 `ResourceRef`，再由 resource-cache service 批量 hydrate data URL；严禁逐项 IPC 或前端构造 fallback。
- 字段渲染必须遵守全局 edit mode；字符串真实换行必须使用 textarea 并完整保留。
- UI 和布局必须遵守 `.zcode/css-guidelines.md`。
