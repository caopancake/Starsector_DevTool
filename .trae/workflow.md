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
4. 根据任务阅读相关专题：
   - 前端：`.trae/frontend-guidelines.md`
   - 后端：`.trae/backend-guidelines.md`
   - 模块边界：`.trae/module-map.md`
   - 后续阶段：`.trae/todo.md`
5. 使用 `rg` 或显式 UTF-8 读取命令检查当前实现。

## 开发约束

- 禁止对 TS / Vue 做全局正则替换。
- 禁止破坏性命令，除非用户明确要求。
- 不回退 dirty state 到按表格索引追踪。
- 不把组件拆成没有稳定语义的小文件。
- 不绕过 feature service 直接在组件里调用 Tauri command。
- Rust / Vue 改动都要保持构建可过。

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

- 文档或纯配置改动：至少运行 `encoding:check` 和 `format:check`。
- 前端改动：运行 `format:check`、`lint`、`typecheck`、`encoding:check`。
- 后端改动：运行 Rust test、clippy、fmt check。
- 跨前后端改动：前端和后端验证都要跑。
