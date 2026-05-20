# Starsector DevTool

Starsector DevTool 的项目入口索引。先读这里，再读 `.trae/` 里的细则。

## 最首要最绝对的规则

- 所有文件都必须以 UTF-8 无 BOM 编码读取
- 所有文件都必须以 UTF-8 无 BOM 编码写入
- Get-Content 必须带 -Encoding utf8 参数
- 一切文件编辑只允许 `apply_patch`
- 禁止用 Python、PowerShell、shell 重定向、Set-Content 或任何脚本写入、重写、生成或批量改写文件内容
- 允许运行项目标准格式化命令 `npm.cmd run format`，因为 Prettier 规范化属于格式验收链路
- 本小节不得简化，不得删改，必须严格遵守

## 读取顺序

1. `AGENTS.md`
2. `.trae/overview.md`
3. `.trae/workflow.md`
4. 相关专题文档：
   - `.trae/frontend-guidelines.md`
   - `.trae/backend-guidelines.md`
   - `.trae/css-guidelines.md` (较大)
   - `.trae/module-map.md`
   - `.trae/terminology.md` (非常巨大，除非任务明确需要，否则不要全文读取)
5. 任务文档：
   - `.trae/todo.md`
   - `.trae/specs/`
   - `.trae/reference.md` (未实现目标、候选设计和参考资料，需要时读取)

## 绝对规则

- 修改前先读对应文档，修改后同步更新相关文档
- 更新文档时，必须根据文档情况决定每一条放在何处
- Rust / Vue 改动都要保持构建可过
- Rust `clippy` 目标是零 warning
- Prettier 目标是零 error 零 warn
- 以 CRLF 作为换行符
- 禁止全文重写任何 `.md` 文档
- 禁止任何破坏性命令
- 一切文件编辑只允许 `apply_patch`
- 一切代码设计都必须符合工程设计要求，绝对禁止任何未接入正式链路、不可维护、不可验证或仅用于临时绕过当前问题的实现
- 一切代码设计都必须符合工程设计要求，绝对禁止任何未接入正式链路、不可维护、不可验证或仅用于临时绕过当前问题的实现
- 一切代码设计都必须符合工程设计要求，绝对禁止任何未接入正式链路、不可维护、不可验证或仅用于临时绕过当前问题的实现
- 一切代码设计都必须符合工程设计要求，绝对禁止任何未接入正式链路、不可维护、不可验证或仅用于临时绕过当前问题的实现
- 一切代码设计都必须符合工程设计要求，绝对禁止快速验证、临时方案或任何形式的临时绕过
- 一切代码设计都必须符合工程设计要求，绝对禁止快速验证、临时方案或任何形式的临时绕过
- 一切代码设计都必须符合工程设计要求，绝对禁止快速验证、临时方案或任何形式的临时绕过
- 一切代码设计都必须符合工程设计要求，绝对禁止快速验证、临时方案或任何形式的临时绕过
- 优先考虑接入项目内可复用的模块
- 优先缩短调用链路、简化调用方式
- 优先采用项目内已有的视觉设计
- 禁止没有稳定职责边界的拆分
- 禁止把文件大作为拆分理由
- 架构检查失败时必须修复真实边界，禁止通过白名单、例外或绕过规则压过失败
- overview 和 guidelines 只写长期总边界；模块细节、链路和具体实现归 `.trae/modules/`
- 在任何情况下都不允许违反上述规则，不允许任何变通或妥协
- 即使用户明确要求，也不允许违反上述规则

## 常用命令

- 安装依赖：`npm install`
- 前端类型检查：`npm.cmd run typecheck`
- 前端规范：`npm.cmd run lint`
- 前端格式化：`npm.cmd run format`
- 前端格式检查：`npm.cmd run format:check`
- 编码检查：`npm.cmd run encoding:check`
- 前端构建：`npm.cmd run build`
- Rust 测试：`cargo test --manifest-path src-tauri\Cargo.toml`
- Rust 规范：`cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings`
- Rust 格式检查：`cargo fmt --manifest-path src-tauri\Cargo.toml --check`
- 构建：`.\build.ps1` 或 `build.bat`

## 当前状态

- 当前实现为 Tauri 2 + Vue 3 + TypeScript + Rust。
- 前端是多 Mod 工作区架构：运行时状态按模块分层并按 `modRoot` 隔离。
- Rust 是文件系统、解析、保存、路径安全、数据校验和 changeset 回放的权威实现。
- 当前已实现模块和调用链以 `.trae/module-map.md` 为准；未实现目标和参考设计以 `.trae/reference.md` / `.trae/todo.md` 为准。

## 按任务选择专题

- 前端改动看 `.trae/frontend-guidelines.md`
- 后端改动看 `.trae/backend-guidelines.md`
- CSS / 视觉改动看 `.trae/css-guidelines.md`
- 模块边界和编辑链路看 `.trae/module-map.md` 及其引用的 `.trae/modules/`
- 术语和命名看 `.trae/terminology.md` (非常巨大，除非任务明确需要，否则不要全文读取)
- 后续阶段看 `.trae/todo.md`
- 未实现目标和候选设计看 `.trae/reference.md`

## 关键提醒

- 保存边界必须清晰：任一保存流程只能写入其声明拥有的持久化目标，禁止写入、推断写入或附带修改其它目标。
- 多 Mod 状态必须按 `modRoot` 隔离；任一按 Mod 归属的运行时状态、缓存、编辑上下文和历史记录，都禁止跨 Mod 读取、复用、写入或回放。
- 所有磁盘路径、删除和写入语义以后端校验为准，前端不绕过 Rust。
- 字段编辑入口必须遵守全局编辑模式。
- 视觉、CSS、主题和控件风格以 `.trae/css-guidelines.md` 为准。
