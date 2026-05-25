# Workflow

本文档只记录日常操作流程、命令和验收规则。项目背景、功能边界和数据流见 `.trae/overview.md`。

## 编码规则

- 所有文件必须以 UTF-8 无 BOM 编码读取。
- 所有文件必须以 UTF-8 无 BOM 编码写入。
- PowerShell `Get-Content` 必须带 `-Encoding utf8` 参数。
- 以 CRLF 作为换行符。
- 一切文件编辑只允许 `apply_patch`。
- 禁止用 Python、PowerShell、shell 重定向、Set-Content 或任何脚本写入、重写、生成或批量改写文件内容。
- 允许使用 rustfmt 格式化 Rust 源码。
- 允许运行项目标准格式化命令 `npm.cmd run format`，因为 Prettier 规范化属于格式验收链路。

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
- 禁止把文件大作为拆分理由。
- Rust / Vue 改动都要保持构建可过。
- 禁止采取快速验证、临时方案等非正式开发方式。
- 禁止补丁式修复：不得用局部找补、兼容壳、隐藏标记、fallback、特判、倒推条件或临时分支解决当前问题。
- 遇到任何模块问题，必须先回到模块正式模型和职责边界，确认输入、输出、状态归属、保存边界、解析语义和验证方式。
- 任何模块不允许只做“修复当前问题”的改动；改动必须成为该模块长期正式链路的一部分。
- 如果问题暴露出现有模块设计错误，必须撤掉错误方向并重构或重做相关模块实现，禁止在错误方向上继续叠加兼容。
- 当前样例通过只能作为验收结果，不能作为设计依据；不得为了让当前文件、当前界面或当前流程通过而牺牲模型干净度。
- 模块重做必须同步补充正例和反例验证，证明正式模型成立，并证明错误输入仍按规则失败。
- 更新文档时，必须根据文档情况决定每一条放在何处。
- 代码行为、架构边界或模块链路变化后，必须检查并同步对应模块文档。
- 做任何改动之前，哪怕只是改一个字母，也必须逐文件地完整审计和它有关的任何链路，无限制地审计、追溯，从前端组件到硬盘读写。
- 完全不信任任何文档内容，永远把文档视为过时的指导。
- 如果你觉得有些函数命名语义不对，他妈的动点脑子想想是不是为了通过静态检查脚本而特别设的。

## 问题处理流程

1. 停止局部修改，先定位问题所属模块和职责层。
2. 写清该模块的正式模型：输入来源、结构语义、状态归属、输出结果和错误边界。
3. 检查当前实现是否符合正式模型；不符合时撤掉错误方向，重构或重做模块内相关实现。
4. 只接入正式链路，不新增临时入口、隐藏状态、兼容壳、fallback 或特判。
5. 用当前问题样例、同类正例和反例一起验收；当前样例通过但模型不成立时视为失败。
6. 永远优先考虑最大幅度重构、彻底重写、完全重新设计等最为干净的方式。

## 常用命令

```powershell
npm install
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format
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
6. 忽略实际改动范围，总是全仓验证。

验收目标：

- Rust `clippy` 零 warning。
- Prettier 零 error 零 warning。
