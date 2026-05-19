# Workflow

本文档只记录日常操作流程、命令和验收规则。项目背景、功能边界和数据流见 `.trae/overview.md`。

## 编码规则

- 所有文件必须以 UTF-8 无 BOM 编码读取。
- 所有文件必须以 UTF-8 无 BOM 编码写入。
- PowerShell `Get-Content` 必须带 `-Encoding utf8` 参数。
- 以 CRLF 作为换行符。
- 一切文件编辑只允许 `apply_patch`。
- 禁止用 Python、PowerShell、shell 重定向、Set-Content 或任何脚本写入、重写、生成或批量改写文件内容。

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
- 术语：`.trae/terminology.md` (非常巨大，除非任务明确需要，否则不要全文读取)
- 阶段计划：`.trae/todo.md`
- 候选设计：`.trae/reference.md`

## 开发约束

- 禁止任何破坏性命令。
- 禁止全文重写任何文档。
- 禁止没有稳定职责边界的拆分。
- 禁止把文件大作为拆分理由。
- Rust / Vue 改动都要保持构建可过。
- 禁止采取快速验证、临时方案等非正式开发方式。
- 更新文档时，必须根据文档情况决定每一条放在何处。
- 代码行为、架构边界或模块链路变化后，必须检查并同步对应模块文档。
- `overview.md` 和 guidelines 只写长期总边界；模块细节、链路和具体实现归 `.trae/modules/`。
- 架构检查失败时必须修复真实边界，禁止通过白名单、例外或绕过规则压过失败。

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

`npm.cmd run lint` 包含架构静态检查。

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
4. 静态检查脚本改动必须运行 `lint`。
5. 跨前后端改动运行前端和后端验证。

验收目标：

- Rust `clippy` 零 warning。
- Prettier 零 error 零 warning。
