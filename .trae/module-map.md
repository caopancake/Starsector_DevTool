# Module Map

本文档记录当前模块地图和调用边界，用于后续重构时判断是否过拆或跨层。

具体舰船、武器、弹丸、联队、船插、工业的编辑调用链见 `.trae/editor-flows.md`。

## Frontend

- `src/main.ts`：应用挂载入口。
- `src/app/App.vue`：应用壳、导航栏、顶栏操作、全局编排。
- `src/app/TitleBar.vue`：自定义窗口标题栏，集中处理主题切换和窗口控制。
- `src/app/settings.store.ts`：应用级设置状态，当前负责主题持久化。
- `src/app/DataTable.vue`：主数据表格视图，包含单元格编辑和 Vue ref 聚焦。
- `src/app/DetailPane.vue`：右侧记录详情面板，包含缩略图、操作按钮、KV 列表。
- `src/app/EditorsHost.vue`：编辑器弹窗宿主，管理舰船/武器/弹丸/预览编辑器。
- `src/app/providers/`：全局 provider 初始化。
- `src/features/project/`：项目打开、加载状态、项目级数据入口。
- `src/features/tables/`：CSV 表格状态、dirty tracking、保存/新建/删除流程。
- `src/features/editors/`：舰船、武器、弹丸、预览编辑体验。
- `src/shared/api/`：Tauri API adapter。
- `src/shared/lib/`：Starsector 通用工具、默认数据、格式转换。
- `src/shared/types/`：前端共享类型。
- `src/styles/`：按稳定语义拆分的 CSS 模块和主题 token。

## Frontend Boundaries

- 组件不直接调用 Tauri command；通过 feature service 或 shared API adapter。
- Store 不负责 Canvas 绘制。
- Composable 只保留稳定复用能力，不承载具体业务编辑动作。
- 右侧详情面板是上下文操作面板，承载记录摘要、缩略图、编辑器/预览入口和少量字段速览。
- 表格本体专注数据展示、行选择和单元格编辑，不承载打开编辑器等重复操作列。
- 编辑器壳层统一为 header、主编辑区、footer；舰船/武器编辑器采用画布主导 + 右侧检查器。
- 业务 hit detection 和 drag mutation 暂留编辑器组件内。

## Backend

- `src-tauri/src/lib.rs`：Tauri 装配和 command 注册。
- `src-tauri/src/commands/`：Tauri command 入口。
- `src-tauri/src/services/`：业务流程。
- `src-tauri/src/parsers/`：CSV 和宽松 JSON。
- `src-tauri/src/models/`：payload、AppData、核心 spec 类型。
- `src-tauri/src/filesystem/`：路径、文本 IO、JSON 文件、贴图、资源扫描。
- `src-tauri/src/errors.rs`：统一错误。

## Backend Boundaries

- command 保持薄入口。
- service 组合 parser、filesystem、models。
- parser 不依赖 Tauri。
- filesystem 不依赖前端语义。
- models 允许核心字段强类型和 extra 共存。

## Current Risk Areas

- `src/styles/` 已拆分，但 Phase 6 仍需要继续打磨完整视觉系统。
- `ShipEditor.vue`、`WeaponEditor.vue`、`ProjectileEditor.vue` 仍较大，但保留了业务流程聚合价值。
- `App.vue` 仍承担主布局和弹窗编排，后续 UI 重设计时可再评估是否拆分。
- 快捷键和右键行为尚未系统定义。
