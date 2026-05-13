# Module Map

本文档记录当前模块地图和调用边界，用于后续重构时判断是否过拆或跨层。

具体舰船、武器、弹体、联队、船插、工业的编辑调用链见 `.trae/editor-flows.md`。术语统一口径见 `.trae/terminology.md`。

## Frontend

- `src/main.ts`：应用挂载入口。
- `src/app/App.vue`：应用壳、导航栏、顶栏操作、全局编排。
- `src/app/TitleBar.vue`：自定义窗口标题栏，集中处理主题切换和窗口控制。
- `src/app/settings.store.ts`：应用级设置状态，当前负责主题持久化。
- `src/app/DataTable.vue`：主数据表格视图，包含单元格编辑和 Vue ref 聚焦。
- `src/app/DetailPane.vue`：右侧记录详情面板，包含缩略图、操作按钮、KV 列表。
- `src/app/EditorsHost.vue`：编辑器弹窗宿主，管理舰船/武器/弹体编辑器和发射预览。
- `src/app/providers/`：全局 provider 初始化。
- `src/features/project/`：项目打开、目录选择 service、加载状态、项目级数据入口。
- `src/features/tables/`：CSV 表格状态、dirty tracking、保存/新建/删除流程。
- `src/features/editors/`：舰船、武器、弹体编辑体验，以及发射预览子能力。
- `src/shared/api/`：Tauri API adapter。
- `src/shared/lib/`：Starsector 通用工具、默认数据、格式转换。
- `src/shared/types/`：前端共享类型。
- `src/styles/`：按稳定语义拆分的 CSS 模块和主题 token。

## Frontend Boundaries

- 组件不直接调用 Tauri command；通过 feature service 或 shared API adapter。
- Store 不直接调用 Tauri command 或 Tauri 插件；通过 feature service 表达业务动作。
- Store 不负责 Canvas 绘制。
- Composable 只保留稳定复用能力，不承载具体业务编辑动作。
- 右侧详情面板是上下文操作面板，承载记录摘要、缩略图、编辑器/预览入口和少量字段速览。
- 右侧详情面板不承载复杂编辑；复杂编辑使用 modal，当前不引入抽屉。
- 表格本体专注数据展示、行选择和单元格编辑，不承载打开编辑器等重复操作列。
- 编辑器壳层统一为 header、主编辑区、footer；舰船/武器编辑器采用画布主导 + 右侧检查器。
- `EditorsHost.vue` 是弹窗编排边界，集中挂载 spec 编辑器和只读预览；preview 暂不拆独立 feature。
- 业务 hit detection 和 drag mutation 暂留编辑器组件内。
- 无 UI 或业务入口的 shared API adapter 应删除；未来按真实产品入口重新补。

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

- 后续全局修改链路、快捷键、右键菜单分别由 Phase 8、Phase 9、Phase 10 处理。
- `ShipEditor.vue`、`WeaponEditor.vue`、`ProjectileEditor.vue` 仍较大，但保留了业务流程聚合价值。
- `App.vue` 仍承担主布局和顶层业务动作编排，但弹窗挂载已由 `EditorsHost.vue` 承担。
- 快捷键和右键行为尚未系统定义。
