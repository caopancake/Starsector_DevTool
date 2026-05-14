# Overview

Starsector DevTool 是一个 Windows 桌面版 Starsector Mod 配置工具。当前项目使用 Tauri 2 + Vue 3 + TypeScript + Rust，目标是提供长期可维护的原生桌面工具。

## 项目目标

- 打开 Starsector Mod 根目录并在原位读取、编辑、保存配置文件。
- 覆盖 CSV 表格编辑、舰船编辑器、武器编辑器、弹体编辑器、发射预览和 PNG 贴图导入。
- 让工程结构保持清晰边界，避免臃肿调用链和“为了拆而拆”的碎片化。

## 技术栈

- 桌面壳：Tauri 2
- 后端：Rust
- 前端：Vue 3 + TypeScript + Pinia
- UI：Naive UI
- 编辑画布：Canvas 2D
- 构建：Vite + Tauri CLI

## 功能边界

- Rust 负责文件扫描、解析、读写、校验和贴图写入。
- Vue 负责 UI 状态、表格交互、编辑器表单、Canvas 交互和用户反馈。
- 保存 JSON 时采用结构保真：内容正确、字段保留、规范缩进写回；不承诺保留原注释、尾逗号和手写格式。
- 保存 CSV 时必须保留表头、注释行和空字段语义。

## 核心数据流

1. 用户通过目录选择器打开 Mod 根目录。
2. 前端调用 Tauri command 请求加载项目数据。
3. Rust 扫描 `data/`、`graphics/` 和 `mod_info.json`，解析 CSV、宽松 JSON 和资源列表。
4. 前端将数据写入 Pinia store，并驱动表格、右侧详情和编辑器弹窗。
5. 用户编辑 CSV 或 spec 文件后，前端通过 feature service 调用 Tauri command。
6. Rust service 执行路径解析、数据校验和文件写回。

## 发布策略

- 项目只发布单文件 exe，不生成安装包。
- 具体构建命令、产物路径和验收步骤见 `.trae/workflow.md`。
