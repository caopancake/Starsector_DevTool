# Starsector DevTool

Starsector DevTool 的项目入口索引。先读这里，再读 `.trae/` 里的细则。

## 最首要最绝对的规则

- 所有文件都必须以 UTF-8 无 BOM 编码读取
- 所有文件都必须以 UTF-8 无 BOM 编码写入
- 绝对不允许用 Raw 方式获取文件内容
- 本小节不得简化，必须严格遵守

## 读取顺序

1. `AGENTS.md`
2. `.trae/workflow.md`
3. 相关专题文档：
   - `.trae/`
4. 术语、命名、API：
   - `.trae/`
5. 任务文档：
   - `.trae/specs/`

## 绝对规则

- 修改前先读对应文档，修改后同步更新相关文档
- Rust / Vue 改动都要保持构建可过
- Rust `clippy` 目标是零 warning
- 禁止对 TS / Vue 做全局正则替换
- 禁止全文重写既有 `.md` 文档，只允许逐条增删改；除非用户明确要求整份重写
- 禁止破坏性命令，除非用户明确要求
- 代码编辑优先 `apply_patch`
- 优先考虑接入符合项目风格的部分
- 优先缩短调用链路、简化调用方式

## 常用命令

- 安装依赖：`npm install`
- 前端类型检查：`.\\node_modules\\.bin\\vue-tsc.cmd --noEmit`
- 前端构建：`npm.cmd run build`
- Rust 检查：`cargo check`
- Rust 规范：`cargo clippy -- -D warnings`
- 开发运行：`npm run tauri -- dev`
- 单文件构建：`.\build.ps1` 或 `build.bat`

## 当前状态

- 已迁移为 Tauri 2 + Vue 3 + TypeScript + Rust。
- 前端使用 Naive UI，画布编辑器使用 Canvas 2D。
- Rust 负责 Starsector 宽松 JSON、CSV、mod 文件扫描、保存、删除和贴图上传。
- 功能范围包括：
  - Mod 目录选择
  - CSV 表格编辑、筛选、排序、保存、撤销、新建、删除
  - 舰船编辑器
  - 武器编辑器
  - 弹丸/导弹编辑器
  - 弹道/光束预览

## 改动前先看

- 暂无

## 关键提醒

- `old_program/` 只是迁移参考，不是运行入口。
- 保存 JSON 时采用结构保真，不承诺保留原注释、尾逗号或手写格式。
- 保存 CSV 时应保留表头和注释行。
- dirty state 按稳定 row id 追踪，不能退回按表格索引追踪。
- 贴图上传必须按用途写入正确目录：舰船 `graphics/ships/`，武器 `graphics/weapons/`，导弹/弹丸 `graphics/missiles/`。
