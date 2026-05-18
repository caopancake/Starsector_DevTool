# Module Map

本文档是 `.trae/modules/` 的模块文档模板和索引。项目宏观架构边界写在 `.trae/overview.md`，模块级定义、边界、规范和调用链写在对应模块文档中。

## 模块文档规范

- 模块文档统一放在 `.trae/modules/`。
- 文件名使用英文 kebab-case，并以 `.md` 结尾。
- 文档标题使用中文模块名，保持和本文档索引一致。
- 每个模块文档保留 `定义`、`边界`、`规范` 和 `链路` 等当前结构。
- `定义` 说明模块是什么、解决什么问题。
- `边界` 列出涉及文件、层级和状态归属。
- `规范` 记录当前实现必须遵守的规则和容易出错的细节。
- `链路` 只写真实调用顺序，不能混入规范、解释或规划。
- 跨模块关系先在对应模块文档中说明，本文档只保留宏观边界和索引。
- 新增模块文档时，先在本文档中添加索引，再在对应模块文档中填写内容。

## 模块索引

- [应用启动与窗口挂载系统](modules/app-window-mounting.md)：说明前端入口如何按窗口类型挂载主窗口、编辑器窗口和文件编辑器窗口。
- [多窗口机制](modules/windowing.md)：说明 Tauri 多窗口的创建、单例化、聚焦和跨窗口事件边界。
- [工作区与启动恢复系统](modules/workspace.md)：说明 workspace 状态、启动恢复、自动保存和主窗口编排边界。
- [目录识别、游戏概览与完整读取系统](modules/directory-project-loading.md)：说明打开游戏目录或 Mod 目录时的识别、轻量扫描和完整读取流程。
- [Project / AppData 缓存系统](modules/project-cache.md)：说明完整读取后的 AppData 缓存、同步和按 Mod 隔离规则。
- [CSV 表格系统](modules/csv-tables.md)：说明 CSV 表格显示、编辑、行身份、dirty 和详情动作边界。
- [CSV 草稿历史系统](modules/csv-edit-history.md)：说明未保存 CSV 编辑的内存级 undo/redo 栈。
- [表格保存与关联文件 changeset 系统](modules/table-save-changeset.md)：说明 CSV 保存和关联 spec 创建删除如何组成一次文件级 changeset。
- [文件级 history / changeset 系统](modules/file-history.md)：说明已写盘文件 changeset 的记录、撤销、重做和同步。
- [文件编辑器系统](modules/file-editor.md)：说明文本文件编辑器窗口、保存和文件历史接入。
- [配置系统](modules/config.md)：说明 mod_info、阵营和任务配置的读取、编辑、保存边界。
- [舰船编辑器模块](modules/ship-editor.md)：说明舰船 spec 独立窗口编辑器的加载、保存和同步。
- [武器编辑器模块](modules/weapon-editor.md)：说明武器 spec 独立窗口编辑器及弹体、预览入口。
- [弹体编辑器模块](modules/projectile-editor.md)：说明弹体 spec 独立窗口编辑器的加载、保存和同步。
- [发射预览模块](modules/weapon-preview.md)：说明武器发射预览窗口的读取和非保存边界。
- [装配编辑模块](modules/variant-editor.md)：说明 `.variant` 列表、schema 表单、新建、保存和删除链路。
- [Schema 系统](modules/schema.md)：说明配置 schema、字段渲染、多来源字段和表单边界。
- [资源、贴图与 core fallback 系统](modules/assets-core-fallback.md)：说明图片资源读取、上传、core fallback 和像素采样规则。
- [alex_csv 读取与写入 parser](modules/csv-parser.md)：说明 Starsector CSV-like parser 的读取、空行保留和写回规则。
- [alex_json 宽松 JSON parser](modules/json-parser.md)：说明 Starsector JSON-like 清洗、解析和错误边界。
- [Rust 文件 IO、路径校验与目录 changeset](modules/rust-file-io-changeset.md)：说明 Rust 文本 IO、路径安全、目录 changeset 和失败回滚。
- [主窗口撤销 / 重做快捷键机制](modules/main-undo-redo.md)：说明主窗口 Ctrl+Z / Ctrl+Shift+Z 在 CSV 草稿和文件历史之间的分派。
- [设置、主题与反馈入口机制](modules/settings-theme-feedback.md)：说明设置、主题、message 和 dialog 的入口边界。
