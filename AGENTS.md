# Starsector DevTool

Starsector DevTool 的项目入口索引。先读这里，再读 `.trae/` 里的细则。

## 最首要最绝对的规则

- 所有文件都必须以 UTF-8 无 BOM 编码读取
- 所有文件都必须以 UTF-8 无 BOM 编码写入
- Get-Content 必须带 -Encoding utf8 参数
- 本小节不得简化，必须严格遵守

## 读取顺序

1. `AGENTS.md`
2. `.trae/overview.md`
3. `.trae/workflow.md`
4. 相关专题文档：
   - `.trae/frontend-guidelines.md`
   - `.trae/backend-guidelines.md`
   - `.trae/module-map.md`
   - `.trae/editor-flows.md`
   - `.trae/terminology.md` (非常巨大，根据情况决定是否需要读取)
5. 任务文档：
   - `.trae/todo.md`
   - `.trae/specs/`

## 绝对规则

- 修改前先读对应文档，修改后同步更新相关文档
- Rust / Vue 改动都要保持构建可过
- Rust `clippy` 目标是零 warning
- Prettier 目标是零 error 零 warn
- 禁止对 TS / Vue 做全局正则替换
- 禁止全文重写既有 `.md` 文档，只允许逐条增删改
- 禁止破坏性命令，除非用户明确要求
- 代码编辑优先 `apply_patch`
- 优先考虑接入符合项目风格的部分
- 优先缩短调用链路、简化调用方式

## 常用命令

- 安装依赖：`npm install`
- 前端类型检查：`npm.cmd run typecheck`
- 前端规范：`npm.cmd run lint`
- 前端格式检查：`npm.cmd run format:check`
- 编码检查：`npm.cmd run encoding:check`
- 前端构建：`npm.cmd run build`
- Rust 测试：`cargo test --manifest-path src-tauri\Cargo.toml`
- Rust 规范：`cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings`
- Rust 格式检查：`cargo fmt --manifest-path src-tauri\Cargo.toml --check`
- 构建：`.\build.ps1` 或 `build.bat`

## 当前状态

- 当前实现为 Tauri 2 + Vue 3 + TypeScript + Rust。
- 前端使用 Naive UI，画布编辑器使用 Canvas 2D。
- Rust 负责 Starsector 宽松 JSON、CSV、mod 文件扫描、保存、删除和贴图上传。
- 功能范围包括：
  - Mod 目录选择
  - CSV 表格编辑、筛选、排序、保存、撤销、新建、删除
  - 舰船编辑器
  - 武器编辑器
  - 弹体编辑器
  - 发射预览
- 接下来要做的：
  - 按 `.trae/todo.md` 中的 phase 1 开始执行

## 改动前先看

- `.trae/workflow.md`
- `.trae/overview.md`
- 前端改动看 `.trae/frontend-guidelines.md`
- 后端改动看 `.trae/backend-guidelines.md`
- 模块边界调整看 `.trae/module-map.md`
- 舰船、武器、联队等编辑链路看 `.trae/editor-flows.md`
- 术语和命名看 `.trae/terminology.md` (非常巨大，根据情况决定是否需要读取)
- 后续阶段看 `.trae/todo.md`

## 关键提醒

- 顶部“保存 CSV”和编辑器“保存 .ship/.wpn/.proj”是两条独立链路，不能混写或互相偷偷代写。
- dirty state 按稳定 row id 追踪，不能退回按表格索引追踪。
- 右侧详情面板的预览、摘要和操作必须严格跟随当前记录，不能在切表、切记录或切 Mod 时串状态。
- 在所有情况下，画布必须以邻近采样方式渲染，不允许退回模糊缩放或线性插值。
- 贴图上传必须按用途写入正确目录：舰船 `graphics/ships/`，武器 `graphics/weapons/`，弹体 `graphics/missiles/`。
