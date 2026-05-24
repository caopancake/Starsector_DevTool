# Overview

Starsector DevTool 是一个 Windows 桌面版 Starsector Mod 配置工具。

## 项目目标

- 打开 Starsector 游戏目录或任意 Mod 目录，并在原位读取、编辑、保存 Mod 文件。
- 支持多 Mod 工作区：同时读取多个 Mod，隔离状态，自由切换。
- 游戏目录先进入轻量概览，用户选择 Mod 后打开 ProjectSession，并按界面需要查询数据。
- 覆盖 CSV 表格编辑、配置编辑、舰船编辑器、武器编辑器、弹体编辑器、发射预览、文件编辑器和 PNG 贴图导入。
- 让工程结构保持清晰边界，避免臃肿调用链和“为了拆而拆”的碎片化。

## 技术栈

- 桌面壳：Tauri 2
- 后端：Rust
- 前端：Vue 3 + TypeScript + Pinia
- UI：Naive UI
- 编辑画布：Canvas 2D
- 构建：Vite + Tauri CLI

## 总体架构边界

- 前端访问后端的唯一宏观链路是 `前端 -> shared/api -> Rust command -> service -> 后端实现`。
- 任何前端业务代码都不得绕过 `src/shared/api/` 访问 Rust command。
- Rust command 层只能调用 service；除参数接收和错误转换外，不允许包含任何实现细节。
- `src/main.ts` 是前端运行时入口，按 URL 参数挂载主窗口、编辑器窗口或文件编辑器窗口。
- `src/app/` 承载应用壳、窗口根组件、全局 provider、主题、反馈入口、页面装配和 Vue 业务组件。
- `src/domain/` 承载纯业务模型、schema、表格规则和编辑器纯工具，不访问后端和 store。
- `src/services/` 承载后端 API 调用和单一业务服务。
- `src/stores/` 承载 Pinia store，只管理内存状态。
- `src/orchestrators/` 承载跨 store、service、history 和窗口的用户动作编排。
- `src/windows/` 承载窗口创建、窗口事件和窗口生命周期协调。
- `src/shared/api/` 只封装 Tauri command 的调用形状。
- `src/shared/lib/` 承载跨业务纯工具，例如路径、错误和 Starsector 数据辅助函数。
- `src/shared/types/` 承载跨模块共享的前端数据类型。
- `src/styles/` 承载全局 CSS 模块，视觉边界以 `css-guidelines.md` 为准。
- `src-tauri/src/lib.rs` 注册 Tauri command、plugin 和应用启动能力。
- `src-tauri/src/commands/` 是 Tauri command 层，只负责参数接收、错误转换和调用 service。
- `src-tauri/src/services/` 是 Rust service 层，负责 command 后的项目加载、保存、changeset、配置和资源扫描。
- `src-tauri/src/domain/` 承载不直接 IO 的 Rust 业务规则、适配器和数据转换。
- `src-tauri/src/parsers/` 是格式解析和渲染层。
- `src-tauri/src/io/` 是 UTF-8、JSON-like、图片和路径相关 IO 层。
- `src-tauri/src/models/` 是 Rust 与前端交换的数据结构和 payload。
- 具体模块链路和职责以 `.trae/module-map.md` 及 `.trae/modules/` 为准。

## 规范

- 视觉大于一切；任何性能、实现便利或临时交互调整都不得牺牲既有视觉一致性、密度和专业感。
- 前端不能把磁盘写入当成普通状态变更，所有写盘必须经过 shared API 到 Rust command。
- Rust 是磁盘路径、删除语义、文件写入、parser 和 changeset 回放的权威。
- Tauri command 层只调用明确的 service 边界，不承载实现细节。
- 前端运行时状态不是磁盘权威；所有按 Mod 归属的状态必须按 `modRoot` 隔离。
- 保存流程只能写入当前模块声明拥有的目标。
- 字段编辑入口必须遵守全局编辑模式。
- 禁止性规则必须描述完整边界，不得用具体对象、文件类型、状态类型、函数名或模块名的枚举来限定禁止范围。示例只能作为非穷尽说明，不能构成允许边界。

## 核心数据流

- 用户通过目录选择器打开游戏目录或 Mod 目录。
- 前端调用目录识别 command，决定进入游戏概览或打开单个 Mod 的 ProjectSession。
- Rust 建立 session 索引，CSV、配置、spec、资源和只读引用按需 query。
- 前端将 manifest 写入 project store，并由当前界面按需驱动表格、右侧详情和独立编辑器窗口。
- 用户编辑并保存后，前端通过对应 orchestrator 编排状态、历史和 service 调用。
- Rust service 执行路径解析、数据校验、文件写回和 changeset 回放。
- workspace 状态写入工具私有目录，启动时按当前 parser 重新加载。

## 发布策略

- 具体构建命令、产物路径和验收步骤见 `.trae/workflow.md`。
