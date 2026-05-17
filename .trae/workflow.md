# Workflow

本文档只记录日常操作流程、命令和验收规则。项目背景、功能边界和数据流见 `.trae/overview.md`。

## 编码规则

- 所有文件必须以 UTF-8 无 BOM 编码读取。
- 所有文件必须以 UTF-8 无 BOM 编码写入。
- PowerShell `Get-Content` 必须带 `-Encoding utf8` 参数。
- 禁止 Raw 方式读取源码内容。
- 源码编辑优先使用 `apply_patch`。

## 改动前

1. 阅读 `AGENTS.md`。
2. 阅读 `.trae/overview.md`。
3. 阅读本文档确认操作和验收要求。
4. 根据任务阅读相关专题。
5. 使用 `rg` 或显式 UTF-8 读取命令检查当前实现。

相关专题：

- 前端：`.trae/frontend-guidelines.md`
- 后端：`.trae/backend-guidelines.md`
- CSS / 视觉：`.trae/css-guidelines.md` (较大)
- 模块边界和链路：`.trae/module-map.md` 及其引用的 `.trae/modules/`
- 术语：`.trae/terminology.md` (非常巨大)
- 阶段计划：`.trae/todo.md`
- 候选设计：`.trae/reference.md`

## 开发约束

- 禁止任何破坏性命令。
- 禁止全文重写任何文档。
- 不把组件拆成没有稳定语义的小文件。
- 不把文件大作为拆分文件的理由。
- Rust / Vue 改动都要保持构建可过。
- 禁止采取快速验证、临时方案等非正式开发方式。

## 常用命令

```powershell
npm install
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run encoding:check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri\Cargo.toml --check
```

## 运行与构建

```powershell
npm.cmd run tauri -- dev
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

发布产物位于：

```text
src-tauri\target\release\starsector-devtool.exe
```

## 验收顺序

1. 文档或纯配置改动运行 `encoding:check` 和 `format:check`。
2. 前端改动运行 `format:check`、`lint`、`typecheck`、`encoding:check`。
3. 后端改动运行 Rust test、clippy、fmt check。
4. 跨前后端改动运行前端和后端验证。

验收目标：

- Rust `clippy` 零 warning。
- Prettier 零 error 零 warning。
