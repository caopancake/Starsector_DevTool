# Module Map

本文档记录当前模块地图和调用边界，用于后续重构时判断是否过拆或跨层。

具体舰船、武器、弹丸、联队、船插、工业的编辑调用链见 `.trae/editor-flows.md`。

## Frontend

- `src/main.ts`：应用挂载入口。
- `src/app/App.vue`：应用壳、导航栏、顶栏操作、全局编排。
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

## Frontend Boundaries

- 组件不直接调用 Tauri command；通过 feature service 或 shared API adapter。
- Store 不负责 Canvas 绘制。
- Composable 只保留稳定复用能力，不承载具体业务编辑动作。
- 右侧详情面板是主表格记录操作入口，表格本体专注数据展示和单元格编辑。
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

- `src/styles.css` 仍集中承载大量 UI 样式，需要后续整理。
- `ShipEditor.vue`、`WeaponEditor.vue`、`ProjectileEditor.vue` 仍较大，但保留了业务流程聚合价值。
- `App.vue` 仍承担主布局和弹窗编排，后续 UI 重设计时可再评估是否拆分。
- 快捷键和右键行为尚未系统定义。
