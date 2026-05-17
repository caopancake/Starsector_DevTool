# Module Map

本文档只记录当前已实现的模块、架构边界和调用链设计。未实现的目标、候选设计和参考内容见 `.trae/reference.md`。

具体舰船、武器、弹体、联队、船插、工业的编辑调用链见 `.trae/editor-flows.md`。术语统一口径见 `.trae/terminology.md`。

## Frontend

### App Shell

- `src/main.ts`：应用挂载入口。
- `src/app/App.vue`：应用壳，负责 workspace 视图路由、导入/移除 Mod 编排、启动恢复和全局 provider 下的主布局。
- `src/app/TitleBar.vue`：自定义窗口标题栏，集中处理主题切换和窗口控制，显示当前 Mod 名。
- `src/app/EditorsHost.vue`：编辑器弹窗宿主，统一挂载舰船、武器、弹体编辑器和发射预览。
- `src/app/providers/`：Naive UI 等全局 provider 初始化。
- `src/app/components/NavSidebar.vue`：左侧导航面板，包含导入按钮、总览/设置入口和 Mod 树。
- `src/app/components/ModTreeItem.vue`：单个 Mod 树节点，展开显示已实现的数据和配置模块。
- `src/app/components/OverviewPage.vue`：工作区总览页，显示已导入 Mod 卡片。
- `src/app/components/SettingsPage.vue`：设置页，管理主题、主题色、Starsector 路径和撤销上限等工具设置。
- `src/app/components/TableWorkspace.vue`：数据表格工作区容器，组合顶栏、主表格和右侧详情面板。
- `src/app/DataTable.vue`：主 CSV 表格视图，负责行选择和单元格编辑。
- `src/app/DetailPane.vue`：右侧记录详情面板，展示当前记录预览、摘要和上下文操作。

### Feature Modules

- `src/features/workspace/`：工作区编排状态，管理 Mod 列表、活动 Mod、当前视图和展开状态。
- `src/features/project/`：项目加载与 per-Mod AppData 缓存，使用 `Map<modRoot, AppData>` 隔离多个 Mod。
- `src/features/tables/`：CSV 表格状态与操作，包含 per-Mod table state、dirty tracking、搜索、筛选、保存、新建和删除。
- `src/features/editors/`：舰船、武器、弹体编辑器和发射预览，按 Mod 绑定 `EditorRef`，避免弹窗串 Mod。
- `src/features/history/`：全局修改链路和 undo/redo 历史系统，按 Mod 隔离历史栈。
- `src/features/config/`：配置模块，包括 Mod 概览、Mod 信息、势力和战役编辑。
- `src/features/schema/`：Schema Registry，提供 schema 加载、source 解析、multi-source 聚合/拆分和通用表单渲染。

### Shared Layers

- `src/shared/api/`：Tauri API 薄 adapter，只封装 command payload 和返回类型，不承载业务流程。
- `src/shared/components/ColorPicker.vue`：跨 Schema 表单、设置页和编辑器复用的颜色输入组件，内部归一为 RGBA，按调用方声明输出数组、HEX 或 CSS 字符串。
- `src/shared/types/`：前端共享类型，包括 `AppData`、workspace 状态、表格和编辑器引用类型。
- `src/shared/lib/`：Starsector 通用工具、默认数据、格式转换和 store 辅助函数。
- `schemas/`：随工具分发的 schema 文件，当前包含 `mod-info`、`faction`、`mission` 等已接入配置。
- `src/styles/`：按语义拆分的 CSS 模块和主题 token。具体规则见 `.trae/css-guidelines.md`。

## Frontend Call Chains

### Workspace Load

1. 用户在 `NavSidebar` / `App.vue` 中选择导入 Mod。
2. `project.service` 调用 `load_mod_data` Tauri command。
3. Rust 返回 `AppData`。
4. `project.store` 将数据写入 `modsData`。
5. `workspace.store` 注册 Mod、设置活动 Mod 和视图状态。
6. `tables.store`、`editors.store`、`history.store` 按活动 Mod 激活各自状态。

### CSV Table Editing

1. `TableWorkspace` 根据当前 Mod 和 tab 显示 `DataTable` 与 `DetailPane`。
2. `DataTable` 将单元格编辑写入 `tables.store`，dirty state 按稳定 row key 追踪。
3. 保存、新建、删除通过 `features/tables/table.service.ts` 调用 shared API。
4. 后端保存 CSV 或配套 spec 文件后，前端更新 per-Mod 数据缓存和 history。

### Editor Modal

1. `DetailPane` 或表格动作请求打开编辑器。
2. `editors.store` 记录带 `modRoot` 的 `EditorRef`。
3. `EditorsHost` 根据 `EditorRef` 挂载对应编辑器。
4. 编辑器从目标 Mod 的 `AppData` 读取 spec 和资源数据。
5. 保存时通过对应 service/API 写回 `.ship/.wpn/.proj`，不隐式保存 CSV。

### Config Editing

1. `ModTreeItem` 切换 `workspace.configView`。
2. `ConfigWorkspace` 路由到 `ModOverview`、`ModInfoEditor`、`FactionList/FactionEditor` 或 `MissionView`。
3. 配置编辑器通过 schema 聚合当前数据为单个 `RowData`。
4. `SchemaFormRenderer` 负责表单展示和字段编辑。
5. 保存时由业务组件拆回原始 source，并调用 config service 或 shared API 写回对应文件。

### History

1. 表格、编辑器或配置模块在完成可撤销修改时推送 history event。
2. `history.store` 按 Mod 管理 undo/redo 栈和 checkpoint。
3. `history.service` 根据事件类型回放到 table state 或 mod data。
4. 编辑器内部可使用局部 history 组织拖拽粒度，但不能形成互不相通的长期撤销体系。

## Frontend Boundaries

- 组件不直接拼 Tauri command payload；通过 feature service 或 shared API adapter。
- Store 不直接调用 Tauri 插件；持久化、文件读写和系统对话应通过 service 或 app 边界。
- `workspace.store` 不持有 AppData；`project.store` 不负责视图路由。
- 表格本体只负责展示、选择和单元格编辑；上下文操作集中到顶栏、详情面板或后续右键菜单。
- `EditorsHost` 是弹窗挂载边界；编辑器引用必须带 `modRoot`。
- 画布 hit detection、自动吸附和 drag mutation 留在具体编辑器组件内；共享的是 viewport、绘制 helper 和历史等稳定能力。
- SchemaFormRenderer 只渲染单个聚合对象；保存边界由业务组件拆分处理。

## Backend

- `src-tauri/src/lib.rs`：Tauri 装配、command 注册和 single-instance 插件。
- `src-tauri/src/commands/`：Tauri command 入口，保持薄封装。
- `src-tauri/src/services/`：业务流程层，组合 parser、filesystem 和 models。
- `src-tauri/src/services/project/`：项目加载、CSV 表扫描、势力发现、贴图和弹体资源聚合。
- `src-tauri/src/services/config.rs`：Mod 信息、势力、战役列表/任务文件等配置保存流程。
- `src-tauri/src/services/tables.rs`：CSV 行与配套 spec 的新建、删除和保存流程。
- `src-tauri/src/services/specs.rs`：`.ship/.wpn/.proj` 保存相关逻辑。
- `src-tauri/src/services/workspace.rs`：工具私有 `workspace.json` 读写。
- `src-tauri/src/parsers/`：CSV 和 Starsector 宽松 JSON 解析与写回。
- `src-tauri/src/models/`：payload、AppData、workspace、核心 spec 类型。
- `src-tauri/src/filesystem/`：路径、UTF-8 文本 IO、JSON 文件、贴图上传和资源扫描。
- `src-tauri/src/errors.rs`：统一错误类型和结果别名。

## Backend Call Chains

### Project Load

1. `load_mod_data` command 接收 Mod 根目录。
2. `services::project::load_all_data` 读取 `mod_info.json`、CSV 表、spec 文件、势力、装配和资源索引。
3. 贴图 data URL 使用 Mod → core fallback 链加载。
4. 返回 `AppData` 给前端缓存。

### CSV Save

1. 前端提交目标 `modRoot`、表名、header 和 rows。
2. command 转入 tables/config service。
3. service 校验目标路径并调用 parser 保存。
4. CSV parser 保留表头、注释行和空字段语义。

### Spec Save

1. 前端提交 `modRoot`、id 和 spec 数据。
2. command 转入 specs service。
3. service 使用结构化 JSON 写回对应 `.ship/.wpn/.proj`。
4. 核心字段按强类型处理，未知字段通过 extra 保留。

### Config Save

1. 前端业务组件将 schema 聚合对象拆分为原始 source。
2. command 接收明确 payload，例如 faction、mission list、descriptor 或 text。
3. service 写回对应 CSV、JSON 或文本文件。
4. 删除操作区分索引删除和实体文件/目录删除。

### Workspace Persistence

1. 前端防抖提交 workspace 状态。
2. `save_workspace` command 调用 workspace service。
3. 后端写入 Tauri `app_data_dir()` 下的 `workspace.json`。
4. 启动恢复失败时返回安全默认状态。

## Backend Boundaries

- command 保持薄入口，不承载业务逻辑。
- service 表达保存语义和路径安全边界。
- parser 不依赖 Tauri，不包含 UI 语义。
- filesystem 不推断前端状态，只处理路径和文件 IO。
- models 允许核心字段强类型和 extra 共存。
- 所有文本 IO 必须保持 UTF-8 无 BOM。
- 所有涉及用户传入路径、id、文件名的删除或写入都必须在后端校验。
