# Starsector DevTool

Starsector DevTool 的项目入口索引。先读这里，再读 `.cursor/` 里的细则。

## 最首要最绝对的规则

- 所有文件都必须以 UTF-8 无 BOM 编码读取
- 所有文件都必须以 UTF-8 无 BOM 编码写入
- Get-Content 必须带 -Encoding utf8 参数
- 一切文件编辑只允许 `apply_patch`
- 禁止用 Python、PowerShell、shell 重定向、Set-Content 或任何脚本写入、重写、生成或批量改写文件内容
- 允许使用 rustfmt 格式化 Rust 源码。
- 允许运行项目标准格式化命令 `npm.cmd run format`，因为 Prettier 规范化属于格式验收链路。
- 本小节不得简化，不得删改，必须严格遵守

## 读取顺序

1. `AGENTS.md`
2. `.cursor/overview.md`
3. `.cursor/workflow.md`
4. 相关专题文档：
   - `.cursor/frontend-guidelines.md`
   - `.cursor/backend-guidelines.md`
   - `.cursor/css-guidelines.md` (较大)
   - `.cursor/module-map.md`
   - `.cursor/terminology.md` (非常巨大，除非任务明确需要，否则不要全文读取)
5. 任务文档：
   - `.cursor/todo.md`
   - `.cursor/specs/`
   - `.cursor/reference.md` (未实现目标、候选设计和参考资料，需要时读取)

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
- 禁止任何未接入正式链路、不可维护、不可验证或仅用于临时绕过当前问题的实现
- 禁止快速验证、临时方案或任何形式的临时绕过
- 任何问题都不得用补丁式修复、局部找补、兼容壳、隐藏标记、fallback、特判、倒推条件或临时分支解决
- 任何模块出现设计、解析、保存、状态、边界或显示问题时，必须回到该模块的正式模型、正式边界和正式链路，彻底重构或重做模块内相关实现
- 任何模块不允许存在“修一下当前问题”的修复工作；所有改动都必须是模块级正式设计的一部分，并能解释长期规则、输入输出、职责边界和验证方式
- 出现问题时，当前样例通过不能作为设计依据；必须先定义正确模型，再实现，再用当前样例和反例验证
- 如果已有实现方向错误，必须撤掉错误方向后重做；禁止在错误方向上继续叠加补丁、兼容、例外或额外状态
- 禁止把“让当前文件/当前界面/当前流程能过”放在“设计必须干净、边界必须清楚、链路必须正式”之前
- 做任何改动之前，哪怕只是改一个字母，也必须逐文件地完整审计和它有关的任何链路，无限制地审计、追溯，从前端组件到硬盘读写
- 完全不信任任何文档内容，永远把文档视为过时的指导
- 完全不信任任何上下文记忆，任何文件随时可能产生任何变化
- 如果你觉得有些函数命名语义不对，他妈的动点脑子想想是不是为了通过静态检查脚本而特别设的
- 禁止把文件大作为拆分理由
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
- 当前已实现模块和调用链以 `.cursor/module-map.md` 为准；未实现目标和参考设计以 `.cursor/reference.md` / `.cursor/todo.md` 为准。

## 按任务选择专题

- 前端改动看 `.cursor/frontend-guidelines.md`
- 后端改动看 `.cursor/backend-guidelines.md`
- CSS / 视觉改动看 `.cursor/css-guidelines.md`
- 模块边界和编辑链路看 `.cursor/module-map.md` 及其引用的 `.cursor/modules/`
- 术语和命名看 `.cursor/terminology.md` (非常巨大，除非任务明确需要，否则不要全文读取)
- 后续阶段看 `.cursor/todo.md`
- 未实现目标和候选设计看 `.cursor/reference.md`

## 关键提醒

- 保存边界必须清晰：任一保存流程只能写入其声明拥有的持久化目标，禁止写入、推断写入或附带修改其它目标。
- 多 Mod 状态必须按 `modRoot` 隔离；任一按 Mod 归属的运行时状态、缓存、编辑上下文和历史记录，都禁止跨 Mod 读取、复用、写入或回放。
- 所有磁盘路径、删除和写入语义以后端校验为准，前端不绕过 Rust。
- 字段编辑入口必须遵守全局编辑模式。
- 视觉、CSS、主题和控件风格以 `.cursor/css-guidelines.md` 为准。
