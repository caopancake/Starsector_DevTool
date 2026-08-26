# Overview

本文件维护项目架构、状态权威和关键链路的总契约。任务执行流程见 `.zcode/workflow.md`。

## 定位

- 本项目是 Windows 桌面 Starsector Mod 配置工具，运行栈为 Tauri 2、Rust、Vue 3、TypeScript、Pinia、Naive UI、Canvas 2D 与 Vite。
- 游戏目录提供轻量概览与原版只读来源；成功建立 `ProjectSession` 的 Mod 提供实体 query、编辑和保存能力。
- 前端拥有交互、草稿和运行时投影；Rust 拥有磁盘路径、格式解析、写入、删除、changeset 构建与回放权威。

## 运行入口

- `src/main.ts` 按 URL 中的窗口类型加载主窗口、专用编辑器窗口或文件编辑器窗口，并在挂载前初始化 settings、Pinia 与 Naive UI。
- Rust `src-tauri/src/lib.rs` 注册目录识别、ProjectSession、query、write、资源、workspace、settings、日志、配置实体与文件变更命令。
- `src/app/App.vue` 是主窗口应用壳入口；专用编辑器根与文件编辑器根分别挂载各自窗口所需的 ViewModel 和组件。

## 顶层职责

- `src/app/` 保存窗口根、页面、组件和 ViewModel/composable；组件负责渲染、输入和局部 UI 状态。
- `src/domain/` 保存纯规则和转换；`src/services/` 包装单一后端能力；`src/orchestrators/` 编排跨模块用户动作。
- `src/stores/` 保存内存运行态；`src/windows/` 管理窗口身份、生命周期和事件；`src/shared/` 保存跨模块 API、runtime、类型和纯工具。
- `src/styles/` 保存全局主题、应用框架和业务样式；`schemas/` 保存配置字段与 CSV 列 schema。
- `src-tauri/src/commands/` 处理 wire 参数、错误转换和 service 调用；`services/` 提供目录、ProjectSession、配置实体、文件、settings、日志、workspace 与资源能力。
- `src-tauri/src/domain/` 保存纯业务规则；`io/` 保存路径和文件边界；`parsers/` 保存格式解析与渲染；`models/` 保存 wire 和内部模型。
- `src-tauri/src/services/project/` 按 root、session、query、write、resources、cache 与 model 分工；query 负责只读查询，write 返回 changeset 与结构化 invalidation。

## 核心状态与权威

- 按 Mod 归属的 session、缓存、草稿、选择、历史和窗口身份按 `modRoot` 隔离；`sessionId + modRoot` 共同标识 ProjectSession 操作。
- 前端持有 manifest、按需 query 缓存、草稿和界面状态；后端提供磁盘内容、实体身份和路径归属结果。
- 保存、删除、导入和 undo/redo 经过所属模块的 changeset 链路，持久化目标由该模块的保存边界声明。
- workspace、settings、日志和派生索引写入工具私有目录；Mod 内容与工具私有状态由独立 owner 管理。
- 当前 Mod 数据优先于原版只读数据；资源 fallback、引用解析和 data URL hydration 经过后端 query 与前端批量资源缓存。
- 字段编辑服从全局 edit mode；窗口复用、事件和外部更新携带完整 session、Mod 与目标身份。

## 追踪路径

- 目录打开从组件请求追到 directory-opening orchestrator、后端目录识别、游戏概览或 ProjectSession 建立，再进入 workspace/project 运行态。
- 实体读取从组件追到 ViewModel/composable、service、`shared/api`、Rust command、project query、parser/IO 或 cache，再返回 manifest 与前端 query 缓存。
- 保存从组件动作追到 ViewModel、orchestrator、write-facing service、`shared/api`、Rust write service、changeset、File History、ProjectSession refresh、结构化 invalidation 与界面同步。
- 窗口同步从完整窗口 identity 追到 managed window、结构化事件、主窗口保存与 refresh，再进入 dirty draft 的外部版本交接。
- 资源读取从后端 `ResourceRef` 追到 Mod/Core 解析、批量 hydrate、前端 resource cache 与最终组件；上传继续进入二进制 changeset 和缓存失效。
- workspace 恢复从工具私有快照追到目录重识别、ProjectSession 重建、运行态注册与工作区总览；恢复期间自动保存处于暂停状态。

## 文档入口

- 调查、修改与验证流程见 `.zcode/workflow.md`。
- 前端、后端和视觉约束分别见 `.zcode/frontend-guidelines.md`、`.zcode/backend-guidelines.md` 与 `.zcode/css-guidelines.md`。
- 模块职责和调用链路由见 `.zcode/module-map.md`；产品术语见 `.zcode/terminology.md`。
