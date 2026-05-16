# Module Map

本文档记录当前模块地图和调用边界，用于后续重构时判断是否过拆或跨层。

具体舰船、武器、弹体、联队、船插、工业的编辑调用链见 `.trae/editor-flows.md`。术语统一口径见 `.trae/terminology.md`。

## Frontend

- `src/main.ts`：应用挂载入口。
- `src/app/App.vue`：应用壳、workspace 视图路由、导入/移除 Mod 编排。
- `src/app/TitleBar.vue`：自定义窗口标题栏，集中处理主题切换和窗口控制，显示当前 Mod 名。
- `src/app/settings.store.ts`：应用级设置状态，当前负责主题持久化。
- `src/app/components/NavSidebar.vue`：左侧导航面板，包含导入按钮、概览/设置链接和 Mod 树。
- `src/app/components/ModTreeItem.vue`：单个 Mod 树节点，展开显示数据模块。
- `src/app/components/OverviewPage.vue`：工作区概览页，显示已导入 Mod 卡片。
- `src/app/components/SettingsPage.vue`：设置页，承载主题等配置。
- `src/app/components/TableWorkspace.vue`：数据表格工作区（从 App.vue 提取），包含顶栏操作和表格/详情布局。
- `src/app/DataTable.vue`：主数据表格视图，包含单元格编辑和 Vue ref 聚焦。
- `src/app/DetailPane.vue`：右侧记录详情面板，包含缩略图、操作按钮、KV 列表。
- `src/app/EditorsHost.vue`：编辑器弹窗宿主，管理舰船/武器/弹体编辑器和发射预览。
- `src/app/providers/`：全局 provider 初始化。
- `src/features/workspace/`：工作区编排状态（Mod 列表、活动 Mod、视图路由）。
- `src/features/project/`：项目打开、目录选择 service、per-Mod 数据缓存（Map<modRoot, AppData>）。
- `src/features/tables/`：per-Mod CSV 表格状态（stateMap）、dirty tracking、单元格编辑、行选择、保存/新建/删除流程。
- `src/features/editors/`：per-Mod 编辑器状态、舰船/武器/弹体编辑体验、发射预览。
- `src/features/editors/components/common/`：编辑器内稳定共享结构组件和小型字段组件，例如 header、footer、inspector、颜色数组和对象编辑器。
- `src/features/editors/composables/`：编辑器共享交互能力，例如画布视口、绘制辅助、局部历史、快捷键作用域和贴图上传。
- `src/features/editors/lib/`：编辑器通用格式化、规范化、视觉绘制 helper、常量。
- `src/features/history/`：全局修改链路和统一 undo/redo 历史系统。
- `src/features/history/history.types.ts`：统一修改事件模型类型（CsvCellEditEvent、EditorSaveEvent、SpriteFieldWriteEvent、HistoryEntry、HistoryBarrier、HistoryCheckpoint）。
- `src/features/history/history.store.ts`：Pinia store，per-Mod 隔离的 undo/redo 栈，push/undo/redo/trim/barrier/checkpoint 逻辑。
- `src/features/history/history.service.ts`：apply undo/redo 纯函数，根据事件类型修改 tableState 或 modData。
- `src/features/history/composables/useGlobalShortcuts.ts`：主界面 Ctrl+Z/Y 监听器，编辑器打开时让步。
- `src/features/config/`：配置模块编辑功能（mod_info、势力、战役、星系）。
- `src/features/config/config.store.ts`：配置模块 per-Mod 状态管理（modInfo snapshot、dirty 追踪）。
- `src/features/config/config.service.ts`：配置模块保存 service，封装 Tauri command 调用。
- `src/features/config/components/ConfigWorkspace.vue`：配置模块主容器，根据 configView 路由到子组件。
- `src/features/config/components/ModInfoEditor.vue`：mod_info.json 结构化表单 + JSON 兜底编辑。
- `src/features/config/components/JsonFieldEditor.vue`：通用 JSON 字段编辑器（未知字段兜底）。
- `src/features/config/components/FactionList.vue`：势力列表（颜色色块预览 + 新建/删除）。
- `src/features/config/components/FactionEditor.vue`：势力详情表单（颜色、标签、描述等）。
- `src/features/config/components/ColorArrayInput.vue`：[R,G,B] 颜色输入 + 实时色块预览。
- `src/features/config/components/CampaignView.vue`：战役 CSV 文件列表 + 可编辑表格 + 保存。
- `src/features/config/components/WorldFilesView.vue`：星系 JSON 文件列表 + 通用 JSON 编辑。
- `src/features/schema/`：Schema Registry 系统，声明式字段模式驱动编辑器 UI。
- `src/features/schema/schema.types.ts`：Schema 文件格式类型定义（FieldSchema、SectionSchema、FileSchema）。
- `src/features/schema/schema.service.ts`：Schema 加载、数据源解析（resolveSource）、嵌套值读写。
- `src/features/schema/components/SchemaFormRenderer.vue`：通用 schema 驱动表单渲染器（按 section 分组 + 额外字段兜底）。
- `src/features/schema/components/SchemaFieldRenderer.vue`：单字段渲染器（12 种类型 + 递归嵌套 + path-image 图片索引选择器 + 缩略图预览）。
- `src/features/schema/composables/useCoreSchema.ts`：core 字段扫描 + 动态 schema 合并（单例缓存）。
- `src/features/schema/composables/useCoreGraphics.ts`：core graphics 图片路径索引（单例缓存，供 path-image 字段下拉选取）。
- `schemas/`：随工具分发的 Schema 定义文件（mod-info、faction 等）。
- `src/features/tables/table.service.ts`：表格 feature 的后端语义边界，封装 CSV 行和舰船/武器记录的新建、删除、保存调用。
- `src/shared/api/`：Tauri API 薄 adapter，只封装 command payload，不承载业务流程。
- `src/shared/lib/`：Starsector 通用工具、默认数据、格式转换。
- `src/shared/types/`：前端共享类型，包括 workspace 类型（ModEntry、ModTableState、ModEditorState、EditorRef、WorkspaceView、PersistedWorkspace）。
- `src/shared/lib/store-utils.ts`：Store 通用工具函数（如 `getNextActiveKeyAfterRemoval`）。
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
- `EditorsHost.vue` 是弹窗编排边界，集中挂载 spec 编辑器和只读预览；编辑器通过 `EditorRef`（含 modRoot）绑定具体 Mod，不依赖当前活动 Mod。
- 业务 hit detection、自动吸附选择和 drag mutation 暂留具体编辑器组件内。
- 无 UI 或业务入口的 shared API adapter 应删除；未来按真实产品入口重新补。

## Backend

- `src-tauri/src/lib.rs`：Tauri 装配、command 注册和 single-instance 插件。
- `src-tauri/src/commands/`：Tauri command 入口，包括 workspace 持久化命令。
- `src-tauri/src/services/`：业务流程。
- `src-tauri/src/services/workspace.rs`：workspace.json 读写 service。
- `src-tauri/src/parsers/`：CSV 和宽松 JSON。
- `src-tauri/src/models/`：payload、AppData、核心 spec 类型。
- `src-tauri/src/models/workspace.rs`：PersistedWorkspace、PersistedMod 持久化数据结构。
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
- `App.vue` 承担 workspace 视图路由、导入/移除 Mod 编排和启动恢复逻辑；弹窗挂载由 `EditorsHost.vue` 承担。
- `base.css` 中的通用 panel/action 结构只用于稳定跨页面样式；具体业务区样式继续留在对应 CSS 模块。
- 舰船/武器编辑器的画布交互已经形成局部模式，但坐标、贴图锚点和强选择规则仍是高风险区域，后续修改应先读现有实现。
- tables.store.ts 使用 computed proxy 模式（per-Mod stateMap + computed 代理），修改对外 API 时需确保 proxy get/set 正确委托到 activeState。
- 启动恢复期间使用 `restoring` 标志抑制自动保存 watcher；如需修改恢复逻辑，注意保持该标志的 set/reset 对称。

## Planned: Blueprint System (Phase 17)

可视化逻辑编辑器，将 Starsector 模板化 Java 模块抽象为节点图。

### 规划目录结构

- `src/features/blueprint/`：蓝图编辑器 feature 模块
- `src/features/blueprint/blueprint.store.ts`：蓝图状态管理（节点/连线/选择/历史）
- `src/features/blueprint/blueprint.service.ts`：序列化/反序列化/代码生成调用
- `src/features/blueprint/components/BlueprintCanvas.vue`：节点画布（复用 ShipEditor 画布能力）
- `src/features/blueprint/components/NodePalette.vue`：节点面板（按库/类型分类）
- `src/features/blueprint/components/NodeInspector.vue`：节点属性检查器
- `src/features/blueprint/components/DialogueFlowEditor.vue`：对话流专用编辑器
- `src/features/blueprint/components/TemplateWizard.vue`：模板向导容器
- `src/features/blueprint/lib/`：节点类型定义、端口类型、代码生成模板
- `src/features/blueprint/lib/nodes/`：各库节点注册表
- `src-tauri/src/services/codegen/`：Java 代码生成引擎（Rust 端模板渲染）
- `src-tauri/src/services/codegen/templates/`：.java 代码模板文件
- `blueprints/`：随工具分发的节点库定义 JSON

### 社区库集成边界

| 库 | 集成范围 | 节点化目标 |
|---|---|---|
| MagicLib | MagicRender 粒子/光束/拖尾、MagicBarEvent JSON 对话、MagicCampaign 工具 | 视觉效果节点 + 对话导出格式 |
| GraphicsLib | ShaderAPI 光照/泛光/扭曲/涟漪后处理 | 视觉效果节点（着色器参数化） |
| LazyLib | MathUtils/CollisionUtils/CombatUtils/WeaponUtils | 条件/计算工具节点 |
| LunaLib | LunaSettings 运行时配置面板、LunaCombatPlugin 钩子 | 配置绑定节点 + 向导选项 |
| BoxUtil | BoxCollider 区域判定/范围计算/碰撞检测 | 空间判定节点 |

### 代码生成规则

- 生成的 Java 必须 target JDK 7（Starsector 运行时约束）
- 生成代码保持可读性：合理缩进、import 整理、方法级注释
- 蓝图元数据保存为 `.blueprint.json`，与生成的 .java 并存
- 支持从蓝图重新生成（覆盖）或脱离蓝图手动维护两种模式
- 节点库注册表采用 JSON Schema 描述，允许社区扩展
