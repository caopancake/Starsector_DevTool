# Overview

Starsector DevTool 是一个 Windows 桌面版 Starsector Mod 配置工具。

## 项目目标

- 打开 Starsector 游戏目录或任意 Mod 目录，并在原位读取、编辑、保存 Mod 文件。
- 支持多 Mod 工作区：同时读取多个 Mod，隔离状态，自由切换。
- 游戏目录先进入轻量概览，只有用户选择“完整读取”后才加载单个 Mod 的完整数据。
- 覆盖 CSV 表格编辑、配置编辑、舰船编辑器、武器编辑器、弹体编辑器、发射预览、文件编辑器和 PNG 贴图导入。
- 舰船和武器编辑器以独立窗口承载画布操作，支持快捷键、自动吸附选择、右侧检查器联动和局部 undo/redo。
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
- `src/services/` 承载后端 API 调用和单一业务服务，是 `shared/api` 的唯一业务使用层。
- `src/stores/` 承载 Pinia store，只管理内存状态。
- `src/orchestrators/` 承载跨 store、service、history 和窗口的用户动作编排。
- `src/windows/` 承载窗口创建、窗口事件和窗口生命周期协调。
- `src/shared/api/` 只封装 Tauri command 和 event 的调用形状。
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

## 规范

- 视觉大于一切；任何性能、实现便利或临时交互调整都不得牺牲既有视觉一致性、密度和专业感。
- 前端不能把磁盘写入当成普通状态变更，所有写盘必须经过 shared API 到 Rust command。
- Rust 是磁盘路径、删除语义、文件写入、parser 和 changeset 回放的权威。
- Tauri command 层只调用明确的 service 边界，不承载实现细节。
- 主窗口状态按 `modRoot` 隔离，独立窗口按窗口 URL 自行加载目标 Mod。
- `workspace` 记录打开了什么，`project` 缓存完整 `AppData`，`tables` 记录 CSV 草稿，`file-history` 记录已经写盘的 changeset。
- CSV 草稿历史、文件级 history、编辑器窗口局部 history 是三套系统，不共用栈。
- CSV、spec、配置文件、workspace 私有状态和二进制贴图有不同保存边界，不能互相偷写。
- Canvas 编辑器使用 Starsector 资源朝向约定做显示转换，但保存边界仍是对应 spec 文件本身。
- 保存 JSON-like spec 时采用结构保真：内容正确、字段保留、规范缩进写回；不承诺保留原注释、尾逗号和手写格式。
- `starsector-core` 只读，只作为原版资源回退和数据来源，不注册成可编辑 Mod。
- 禁止性规则必须描述完整边界，不得用具体对象、文件类型、状态类型、函数名或模块名的枚举来限定禁止范围。示例只能作为非穷尽说明，不能构成允许边界。

## 核心数据流

- 用户通过目录选择器打开游戏目录或 Mod 目录。
- 前端调用目录识别 command，决定进入游戏概览或完整读取单个 Mod。
- Rust 扫描 `data/`、`graphics/` 和配置入口，解析 CSV、宽松 JSON-like 文件和资源列表。
- 前端将数据写入 project store，并驱动表格、右侧详情和独立编辑器窗口。
- 用户编辑 CSV、spec、配置或文本文件后，前端通过对应 orchestrator 或 service 调用 `shared/api`，再调用对应的 Rust command 和 service。
- Rust service 执行路径解析、数据校验、文件写回和 changeset 回放。
- workspace 状态自动持久化至 `%APPDATA%/com.starsector.devtool/workspace.json`，启动时按当前 parser 重新加载。

## 发布策略

- 项目只发布单文件 exe，不生成安装包。
- 具体构建命令、产物路径和验收步骤见 `.trae/workflow.md`。
