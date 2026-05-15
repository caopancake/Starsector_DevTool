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
- `src/features/tables/`：CSV 表格状态、稳定 row key、dirty tracking、单元格编辑、行选择、保存/新建/删除流程。
- `src/features/editors/`：舰船、武器、弹体编辑体验，以及发射预览子能力。
- `src/features/editors/components/common/`：编辑器内稳定共享结构组件和小型字段组件，例如 header、footer、inspector、颜色数组和对象编辑器。
- `src/features/editors/composables/`：编辑器共享交互能力，例如画布视口、绘制辅助、局部历史、快捷键作用域和贴图上传。
- `src/features/editors/lib/`：编辑器通用格式化、规范化、视觉绘制 helper。
- `src/features/tables/table.service.ts`：表格 feature 的后端语义边界，封装 CSV 行和舰船/武器记录的新建、删除、保存调用。
- `src/shared/api/`：Tauri API 薄 adapter，只封装 command payload，不承载业务流程。
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
- 表格 dirty state、editing cell、selection 都由 `tables.store.ts` 维护，并且必须按稳定 row key 追踪。
- 编辑器壳层统一为 header、主编辑区、footer；舰船/武器编辑器采用画布主导 + 右侧检查器。
- 编辑器共享结构组件只能表达稳定壳层，不能承载具体保存逻辑、上传逻辑、画布绘制、hit detection 或 drag mutation。
- `EditorsHost.vue` 是弹窗编排边界，集中挂载 spec 编辑器和只读预览；preview 暂不拆独立 feature。
- 业务 hit detection、自动吸附选择和 drag mutation 暂留具体编辑器组件内。
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

- 后续全局修改链路和右键菜单分别由后续 phase 处理；编辑器内快捷键已经有局部作用域实现，但主界面全局快捷键仍需单独设计。
- `ShipEditor.vue`、`WeaponEditor.vue`、`ProjectileEditor.vue` 仍较大，但保留了业务流程聚合价值；除非出现稳定语义或真实复用需求，不继续为了行数拆分。
- `App.vue` 仍承担主布局和顶层业务动作编排，但弹窗挂载已由 `EditorsHost.vue` 承担。
- `base.css` 中的通用 panel/action 结构只用于稳定跨页面样式；具体业务区样式继续留在对应 CSS 模块。
- 舰船/武器编辑器的画布交互已经形成局部模式，但坐标、贴图锚点和强选择规则仍是高风险区域，后续修改应先读现有实现。
