# 工作流程（AI 执行规则）

## 读取与编码

1. 读 `AGENTS.md`、`overview.md`、本文件；再按任务读前端/后端/样式/模块/术语/计划/参考。
2. 读取必须 UTF-8 无 BOM；PowerShell 使用 `Get-Content -Encoding utf8`。写入 UTF-8 无 BOM。
3. 仅用 `apply_patch` 编辑；禁止脚本、重定向、`Set-Content`、Python 重写/生成 Markdown。可运行 `cargo fmt` 与 `npm.cmd run format`。

## 设计门槛

- 修改前逐文件追溯相关链路至磁盘 IO；文档是线索，不是现状证明。
- 先定义模块的输入、输出、状态 owner、保存边界、错误语义与验证；错误方向必须撤掉并回到正式模型。
- 禁止临时方案、局部找补、兼容壳、fallback、特判、隐藏状态和为样例过关的设计。
- 改动必须接入长期正式链路；行为/架构变更后更新对应模块文档。禁止破坏性命令、整篇重写 Markdown、以文件大小为拆分理由。

## 验收

```powershell
npm.cmd run format:check; npm.cmd run lint; npm.cmd run typecheck; npm.cmd run encoding:check
cargo fmt --manifest-path src-tauri\Cargo.toml --check
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri\Cargo.toml
```

- 文档/配置：`encoding:check`、`format:check`；前端、后端、静态检查或跨层改动按上列运行相关命令。默认全仓验证。
- 构建/运行：`npm.cmd run tauri -- dev`；`powershell -ExecutionPolicy Bypass -File .\build.ps1`。产物：`src-tauri\target\release\starsector-devtool.exe`。
