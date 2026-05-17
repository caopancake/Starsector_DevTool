# Module Map

本文档只记录当前已实现的模块、架构边界和调用链设计。未实现的目标、候选设计和参考内容见 `.trae/reference.md`。

具体舰船、武器、弹体、联队、舰船插件、战术系统、工业的编辑调用链见 `.trae/editor-flows.md`。术语统一口径见 `.trae/terminology.md`。

## 文档定位

### 记录范围

- 本文按系统边界组织，不按前端/后端分块。
- 一个系统可以同时包含 Vue 组件、Pinia store、feature service、Tauri API adapter、Rust command 和 Rust service。
- 调用链以当前实现为准；设计候选和未实现目标不写入本文。

### 总体边界

- Rust 是文件系统、解析、保存、路径安全和数据校验的权威实现。
- Vue 负责 UI 状态、用户交互、窗口编排、缓存刷新和用户反馈。
- 业务组件不直接拼 Tauri command payload；通过 feature service 或 shared API adapter。
- 保存边界必须明确：CSV、spec、配置文件、workspace 私有状态不能互相偷写。
- 多 Mod 状态必须按 `modRoot` 隔离；dirty、选择、编辑器引用和 history 不能串 Mod。

## 窗口系统

### 窗口类型

- 主窗口：`App.vue`，负责工作区、目录打开、Mod 概览、表格、配置和主界面级快捷键。
- 文件编辑器窗口：`FileEditorApp.vue`，由 `file-editor-window.ts` 打开，窗口 label 为 `file-editor-*`，按文件绝对路径单例复用。
- 编辑器窗口：`EditorWindowApp.vue`，由 `editor-window.ts` 打开，窗口 label 为 `editor-*`，按 `kind + modRoot + id` 单例复用。
- 当前编辑器窗口 kind：`ship`、`weapon`、`projectile`、`weapon-preview`。
- 独立窗口通用壳：`WindowShell.vue`，集中接入主题、message provider 和 dialog provider。

### 多窗口基础层

- `src/features/windowing/managed-window.ts`：统一创建、聚焦和复用业务窗口。
- `src/features/windowing/window-events.ts`：统一跨窗口事件名和 payload 类型。
- 新增独立窗口时应优先接入 `features/windowing` 和 `WindowShell.vue`，不要复制窗口 key、URL 拼接、主题 provider 或事件名定义。

### 应用挂载入口

- `src/main.ts`：应用挂载入口。
- 普通窗口挂载 `App.vue`。
- `?window=file-editor` 挂载通用文件编辑器窗口。
- `?window=editor` 挂载独立编辑器窗口。

## 应用壳与工作区

### 应用壳组件

- `src/app/App.vue`：应用壳，负责 workspace 视图路由、导入/移除 Mod 编排、启动恢复和全局 provider 下的主布局。
- `src/app/TitleBar.vue`：自定义窗口标题栏，集中处理主题切换和窗口控制，显示当前 Mod 名。
- `src/app/providers/`：Naive UI 等全局 provider 初始化。
- `src/app/components/NavSidebar.vue`：左侧导航面板，包含总览/设置入口和已完整读取 Mod 树。
- `src/app/components/ModTreeItem.vue`：单个 Mod 树节点，展开显示已实现的数据和配置模块。
- `src/app/components/SettingsPage.vue`：设置页，管理主题、主题色、Starsector 路径和撤销上限等工具设置。

### 工作区状态

- `src/features/workspace/`：工作区编排状态，管理游戏目录上下文、轻量 Mod 索引、已完整读取 Mod 列表、活动 Mod、当前视图和展开状态。
- `workspace.store` 不持有 `AppData`；项目数据归 `project.store` 管理。
- 工作区持久化只保存工具私有状态，不把私有 UI 状态写进 Mod 目录。
- `src/features/workspace/file-editor-window.ts`：文件编辑器窗口的业务适配层。

### 项目缓存

- `src/features/project/`：项目加载与 per-Mod `AppData` 缓存。
- `project.store` 使用 `Map<modRoot, AppData>` 隔离多个 Mod。
- 当前缓存 CSV 表、spec 文件、战术系统 `.system` 文件、配置文件和资源预览数据。
- `project.store` 不负责视图路由。

### 工作区加载链路

1. 用户在 `OverviewPage` / `App.vue` 中选择打开目录。
2. `workspace/open-directory.service.ts` 调用 `detect_directory`，判断结果为 `game-root`、`mod-in-game`、`external-mod` 或 `unknown`。
3. 若是 `game-root`，`scan_game_overview` 只读取 `mods/*/mod_info.json`，写入 `workspace.gameOverview` 并停留在概览页。
4. 若是 `mod-in-game`，先写入游戏目录概览，再完整读取所选 Mod，并回到概览页。
5. 若是 `external-mod`，只完整读取该 Mod，设置页游戏目录只作为原版资源 fallback。
6. 若用户在概览页点击“完整读取”，`open-directory.service` 调用带显式 `starsectorRoot` 的 `load_mod_data`。
7. Rust 返回 `AppData`。
8. `project.store` 将数据写入 `modsData`。
9. `workspace.store` 注册 Mod、设置活动 Mod 和视图状态。
10. `tables.store`、`editors.store`、`file.history.store` 按活动 Mod 激活各自状态。

### 启动恢复链路

1. `App.vue` 的 `onMounted` 调用 `loadWorkspace()`。
2. Rust 从 Tauri `app_data_dir()` 读取 `%APPDATA%/com.starsector.devtool/workspace.json`。
3. 若文件不存在或损坏，返回空默认值。
4. `workspace.restoreFrom(persisted)` 恢复游戏目录概览、已完整读取 Mod 列表、视图和展开状态。
5. 前端逐个 Mod 调用 `project.openProject(modRoot)` 重新加载数据。
6. 加载成功后刷新 workspace、project、tables、editors 和 file history 状态。
7. 加载失败时移除该 Mod 的工作区状态，不在左侧栏保留空节点；若错误能定位文件，顶部错误提示提供“打开错误文件”。

### 工作区持久化链路

1. workspace store 状态变化时，通过 `watch(workspace.toPersistedState())` 防抖 500ms 后写入。
2. 前端调用 `save_workspace`。
3. Rust `services::workspace` 写入 Tauri `app_data_dir()` 下的 `workspace.json`。
4. workspace 保存失败要向前端返回错误。

## 目录识别与项目加载

### 后端加载入口

- `detect_directory`：接收用户选择的目录和设置页 fallback 游戏目录。
- `scan_game_overview`：只扫描游戏目录下 `mods/*/mod_info.json`，不加载完整 CSV、spec 或贴图。
- `load_mod_data` / `load_mod_data_with_root`：完整读取一个 Mod，支持显式游戏根目录作为 core fallback。

### Rust 项目服务

- `src-tauri/src/services/project/`：目录识别、游戏目录轻量概览扫描、项目加载、CSV 表扫描、势力发现、贴图、弹体资源和战术系统 `.system` 聚合。
- `services::project::load_all_data` 读取 `mod_info.json`、CSV 表、spec 文件、势力、装配和资源索引。
- 贴图 data URL 使用 Mod → core fallback 链加载。

### 游戏目录概览

- `src/app/components/OverviewPage.vue`：工作区总览页，打开游戏目录后显示轻量 Mod 概览；对单个 Mod 执行完整读取后显示已导入 Mod 卡片。
- `src/app/components/GameOverviewPanel.vue`：游戏目录轻量概览面板，显示所有可识别 Mod、扫描 warning 和按需完整读取入口。
- `src/app/components/LoadedModsPanel.vue`：传统已完整读取 Mod 卡片面板。
- 游戏目录轻量扫描不创建 `AppData`，未完整读取的 Mod 不进入 tables、editors、history 或 project 缓存。

## 表格系统

### 表格组件

- `src/app/components/TableWorkspace.vue`：数据表格工作区容器，组合顶栏、主表格和右侧详情面板。
- `src/app/DataTable.vue`：主 CSV 表格视图，负责行选择和单元格编辑。
- `src/app/DetailPane.vue`：右侧记录详情面板，展示当前记录预览、摘要和上下文操作。

### 表格状态与服务

- `src/features/tables/`：CSV 表格状态与操作，包含 per-Mod table state、dirty tracking、搜索、筛选、保存、新建、删除和 CSV 草稿历史。
- 表格 dirty state 按稳定 row key 追踪，不能退回按表格索引追踪。
- 表格本体只负责展示、选择和单元格编辑；上下文操作集中到顶栏、详情面板或后续右键菜单。

### 表格编辑链路

1. `TableWorkspace` 根据当前 Mod 和 tab 显示 `DataTable` 与 `DetailPane`。
2. 当前 tab 包括舰船、武器、联队、舰船插件、战术系统和工业。
3. `DataTable` 将单元格编辑写入 `tables.store`，dirty state 按稳定 row key 追踪。
4. 单元格编辑、新建、删除只修改内存表格并进入 CSV 草稿历史。
5. 保存通过 `features/tables/table.service.ts` 调用 `save_csv_with_history`。
6. 后端返回 changeset，前端更新 per-Mod 数据缓存并推入文件级保存历史。

### CSV 保存链路

1. 前端提交目标 `modRoot`、表名、header、rows 和可选关联文件变更。
2. Tauri command 转入 `services::tables`。
3. service 校验目标路径，生成 CSV 文件 changeset，并通过 `apply_file_change_set` 写回。
4. CSV parser 保留表头和空字段语义；`#` 开头行、真正空行和全逗号行会作为可见空行进入表格。
5. `保存 CSV + 可选创建/删除关联 spec 文件` 必须作为单条文件级 history。

### 战术系统基础链路

1. `shipSystems` tab 显示 `data/shipsystems/ship_systems.csv`。
2. 项目加载同时读取 `data/shipsystems/*.system` 到 `AppData.systemFiles`。
3. `DetailPane` 选择战术系统行时，使用 CSV 的 `icon` 字段显示预览，并在操作区提供“文件编辑器”按钮打开 `data/shipsystems/{id}.system`。
4. 保存 CSV 走通用 `save_csv_with_history`。
5. 保存 `.system` 走通用文件编辑器的 `save_text_file_with_history`。
6. CSV 与 `.system` 是两条独立保存链路，互不代写。

## 编辑器系统

### 编辑器模块

- `src/features/editors/`：舰船、武器、弹体编辑器和发射预览。
- `src/features/editors/editor-window.ts`：按 `kind + modRoot + id` 打开或复用独立编辑器窗口。
- `src/app/EditorWindowApp.vue`：独立编辑器窗口根组件，按 URL 参数加载目标 Mod 数据并挂载具体编辑器。

### 编辑器窗口链路

1. `DetailPane` 或表格动作请求打开编辑器。
2. `editor-window.ts` 将业务请求转给 `openManagedWindow()`。
3. `openManagedWindow()` 使用 `kind + modRoot + id` 生成窗口 key；同一目标已打开时聚焦已有窗口。
4. `EditorWindowApp.vue` 根据 URL 参数加载目标 Mod 的 `AppData`。
5. 窗口挂载舰船、武器、弹体编辑器或发射预览。
6. 编辑器从窗口内加载的 `AppData` 读取 spec、CSV 行和资源数据。

### 规格保存链路

1. 编辑器保存时调用 `save_json_with_history` 写回 `.ship/.wpn/.proj`。
2. spec 保存不隐式保存 CSV。
3. 保存成功后窗口通过带 changeset 的 `WINDOW_EVENTS.editorSpecSaved` 事件通知主窗口。
4. 主窗口若已加载该 Mod，则更新 `project.modsData` 并推入文件级保存历史。
5. 文件级 undo/redo 通过 `apply_file_change_set` 写回 `.ship/.wpn/.proj`。
6. 主窗口更新缓存，并发送 `WINDOW_EVENTS.editorSpecApplied` 刷新已打开的对应编辑器窗口。

### 画布交互边界

- 编辑器窗口按 `kind + modRoot + id` 隔离；同一目标不重复打开，不同目标可并行打开。
- 画布 hit detection、自动吸附和 drag mutation 留在具体编辑器组件内。
- 共享的是 viewport、绘制 helper、窗口打开能力和保存历史。
- 舰船、武器、弹体编辑器各自维护坐标换算和业务语义，不为共享代码合并不同领域模型。

## 文件编辑器系统

### 文件编辑器窗口

- `src/app/FileEditorApp.vue`：通用文件编辑器窗口。
- 窗口显示文件路径、可选上下文消息和可选红色目标行高亮。
- 保存通过统一 changeset 原样写回文本文件，不触发重新加载。
- 若文件属于已加载 Mod，则接入文件级保存历史。

### 文件编辑器打开链路

1. 文件读取或解析失败时，前端通过 `extractFileReferenceFromError()` 从错误消息中提取绝对文件路径和可选行号。
2. 可定位到文件时，顶部错误提示显示“打开错误文件”按钮。
3. 点击按钮后，`file-editor-window.ts` 通过 `openManagedWindow()` 按规范化绝对路径复用或打开独立 `file-editor-*` 窗口。
4. 同一文件不允许重复打开多个窗口。
5. 当前调用方包括错误修复入口，以及右侧详情面板中舰船、武器、战术系统的“文件编辑器”入口。

### 文件编辑器保存链路

1. 文件编辑器调用 `load_editable_file` 读取 UTF-8 无 BOM 文本。
2. 用户保存时调用 `save_text_file_with_history` 原样写回当前文本并返回单文件 changeset。
3. 保存成功后窗口发送 `WINDOW_EVENTS.fileEditorSaved`。
4. 主窗口按绝对路径判断文件是否属于已加载 Mod。
5. 属于已加载 Mod 时，将 changeset 推入该 Mod 的文件级保存历史。
6. 文件级 undo/redo 会调用 `apply_file_change_set` 写回目标文件，并发送 `WINDOW_EVENTS.fileEditorTextApplied` 刷新已打开的同一文件编辑器。

### 文件编辑器快捷键

- `Esc`：关闭窗口。
- `Ctrl+S`：保存。
- `Ctrl+Z`：窗口内文本撤销。
- `Ctrl+Shift+Z`：窗口内文本重做。
- 这些快捷键只操作窗口内文本历史，不进入主窗口 CSV 草稿历史。

## 配置与表单系统

### 配置模块

- `src/features/config/`：配置模块，包括 Mod 概览、Mod 信息、势力和战役编辑。
- `ConfigWorkspace` 路由到 `ModOverview`、`ModInfoEditor`、`FactionList/FactionEditor` 或 `MissionView`。
- 配置保存通过 changeset 保存接口写回对应文件，随后推入文件级保存历史。

### 配置保存链路

1. `ModTreeItem` 切换 `workspace.configView`。
2. 配置编辑器通过 schema 聚合当前数据为单个 `RowData`。
3. `SchemaFormRenderer` 负责表单展示和字段编辑。
4. 保存时由业务组件拆回原始 source。
5. 配置保存通过 `save_mod_files_with_history` 或配置专用 history command 生成 changeset。
6. 保存成功后前端更新配置缓存并推入文件级保存历史。

### 势力保存边界

- 势力新建、删除、改 ID 接入文件级保存历史。
- `factions.csv + .faction` 作为同一次 changeset。
- 前端不再调用旧的直接写盘 faction API。

### 战役保存边界

- mission 新建、删除、改 ID 接入文件级保存历史。
- `mission_list.csv + descriptor.json + mission_text.txt` 作为同一次 changeset。
- 删除 mission 时可选删除整个 `data/missions/{id}` 目录；目录删除作为同一次文件级 changeset 的目录事件记录，撤销时恢复目录快照。
- 改 ID 且确认删除旧目录时，旧 `data/missions/{oldId}` 也通过目录事件删除，不留下空目录。

### 表单与 Schema

- `src/features/schema/`：Schema Registry，提供 schema 加载、source 解析、multi-source 聚合/拆分和通用表单渲染。
- `SchemaFormRenderer` 只渲染单个聚合对象。
- 保存边界由业务组件拆分处理。
- Schema、设置页和编辑器内的颜色字段使用共享 `ColorPicker`；输出格式由字段契约决定。

## 历史系统

### CSV 草稿历史

- 位置：`tables.edit-history.store.ts` / `tables.edit-history.service.ts`。
- 范围：CSV 单元格编辑、新建行、删除行。
- 作用域：按 `modRoot + tableKey` 隔离，只修改内存表格和 dirty，不写磁盘。
- 保存成功后：清空对应 Mod + 表的 CSV 草稿历史；之后撤销粒度变为文件级保存。

### 文件级保存历史

- 位置：`file.history.store.ts` / `file.history.service.ts` / `file.history.sync.ts`。
- 范围：CSV 保存、CSV + 关联 spec 创建/删除、文件编辑器保存、舰船/武器/弹体 spec 保存、配置保存。
- 事件：每次写盘保存都是一个 `FileSaveHistoryEntry`，payload 是 `FileChangeRecord[]`。
- 文件记录：`kind=file`，记录单个文本文件的 before/after 存在状态和文本。
- 目录记录：`kind=directory`，记录目录 before/after 存在状态和目录快照；快照文件可为 UTF-8 文本或 base64 二进制，用于 mission 目录删除/恢复。
- 回放：通过后端 `apply_file_change_set` 写回磁盘。
- 回放成功后刷新项目缓存、表格状态、文件编辑器和独立编辑器窗口。
- 失败处理：文件级 undo/redo 先 peek，写盘成功后才 commit 移动栈；失败时历史栈保持原样。
- 二次确认：文件级 undo/redo 在主窗口执行前弹窗确认，CSV 草稿历史不弹确认。

### 主窗口撤销重做

1. `useMainWindowShortcuts()` 捕获主窗口 Ctrl+Z / Ctrl+Shift+Z。
2. `main-undo-redo.service.ts` 优先回放当前表的 CSV 草稿历史。
3. 当前表没有 CSV 草稿可回放时，回放文件级保存历史。
4. 文件级保存历史先 peek，后端写盘成功后才 commit 移动栈；失败时栈保持原样。

### 历史触发点

| 操作           | 历史系统     | 触发位置                                       |
| -------------- | ------------ | ---------------------------------------------- |
| CSV 单元格编辑 | CSV 草稿历史 | `tables.store.ts` → `finishCellEdit()`         |
| 新建行         | CSV 草稿历史 | `tables.store.ts` → `addNewRow()`              |
| 删除行         | CSV 草稿历史 | `tables.store.ts` → `deleteSelected()`         |
| CSV 保存       | 文件级历史   | `tables.store.ts` → `saveChanges()`            |
| 配置保存       | 文件级历史   | config 组件保存链路                            |
| 编辑器保存     | 文件级历史   | `App.vue` 监听 `WINDOW_EVENTS.editorSpecSaved` |
| 文件编辑器保存 | 文件级历史   | `App.vue` 监听 `WINDOW_EVENTS.fileEditorSaved` |
| 贴图覆盖       | 文件级屏障   | `useSpriteUpload.ts`                           |

### 历史作用域

| 场景               | 行为                                                                |
| ------------------ | ------------------------------------------------------------------- |
| 编辑器窗口聚焦     | Ctrl+Z 使用编辑器窗口内局部历史；保存后的 spec 变更进入文件级历史   |
| 文件编辑器窗口聚焦 | Ctrl+Z 使用文件编辑器窗口内文本历史；保存后的文件变更进入文件级历史 |
| 主窗口聚焦         | Ctrl+Z 先撤销当前表 CSV 草稿；无草稿时撤销最近文件保存              |
| 切换 Mod           | CSV 草稿历史和文件级历史都按 Mod 隔离                               |
| 跨 Tab 切换        | CSV 草稿历史按表隔离；文件级历史按 Mod 隔离                         |

### 历史限制

- 历史上限由 `settings.store.ts` 的 `historyLimit` 控制，默认 128，可在设置页配置。
- CSV 草稿历史和文件级历史分别按该上限裁剪。
- 贴图覆盖作为 `sprite-overwrite` 文件级屏障；二进制贴图文件暂不纳入文本 changeset，后续若要支持需扩展二进制 changeset 或资产级快照。

## 文件变更集系统

### 变更集保存入口

- `save_text_file_with_history`：保存单个任意文本文件。
- `save_json_with_history`：保存 `.ship/.wpn/.proj` 等 JSON spec。
- `save_csv_with_history`：保存 CSV 和可选关联文件。
- `save_mod_files_with_history`：保存配置模块的多个文本文件。
- `apply_file_change_set`：文件级 undo/redo 的权威回放入口。

### 变更集回放链路

1. 文件编辑器、spec 编辑器、CSV 保存或配置保存提交目标文件和完整目标文本。
2. 后端生成 `FileChangeRecord[]`；文本文件记录 before/after 存在状态和文本，目录记录 before/after 存在状态和目录快照。
3. 后端通过 `apply_file_change_set` 按 undo/redo 方向回放 changeset。
4. 回放失败时尽力回滚已写入文件。
5. 前端根据 changeset 刷新已加载的 `AppData`、table state 和独立窗口。

### 文件与目录边界

- 该系统以文本文件 changeset 为主；目录事件仅用于明确需要整体删除/恢复目录的配置链路。
- 目录快照支持 UTF-8 文本和 base64 二进制文件，但不用于常规贴图覆盖 history。
- 所有文本 IO 必须保持 UTF-8 无 BOM。
- 所有涉及用户传入路径、id、文件名的删除或写入都必须在后端校验。

## 资源与贴图系统

### 贴图上传链路

- 前端 composable：`src/features/editors/composables/useSpriteUpload.ts`
- 前端服务：`uploadEditorSprite()`
- API adapter：`uploadSprite()`
- Tauri command：`upload_sprite`
- Rust filesystem：`src-tauri/src/filesystem/assets.rs`

上传目录规则：

- 舰船：`graphics/ships/`
- 武器：`graphics/weapons/`
- 弹体：`graphics/missiles/`

上传只负责写入贴图文件并返回相对路径；对应 spec 字段仍由编辑器保存链路写回。

### 二进制贴图边界

- 贴图文件是二进制资产，当前不纳入文件级文本 changeset。
- 覆盖已有贴图时只推入文件级屏障。
- 后续若要支持贴图 undo/redo，需要单独设计二进制 changeset 或资产快照。

### 图片加载链路

- API：`loadImageDataUrl(modRoot, relPath, starsectorRoot?)`
- Tauri command：`load_image_data_url`
- Rust service：`services::load_image_as_data_url(mod_root, rel_path, starsector_root)`

查找顺序：

1. `{modRoot}/{relPath}`：Mod 自有贴图。
2. `{starsectorRoot}/starsector-core/{relPath}`：用户配置的游戏目录。
3. `{modRoot}/../../starsector-core/{relPath}`：自动推断游戏目录。

### 原版图片索引

- API：`scanCoreGraphics(starsectorRoot)`
- Tauri command：`scan_core_graphics`
- Rust service：`services::scan_core_graphics`
- 前端缓存：`useCoreGraphics` composable。
- 用途：`path-image` 字段的下拉候选列表，合并 Mod sprites + core graphics。

## 共享层

### 前端共享层

- `src/shared/api/`：Tauri API 薄 adapter，只封装 command payload 和返回类型，不承载业务流程。
- `src/shared/components/ColorPicker.vue`：跨 Schema 表单、设置页和编辑器复用的颜色输入组件。
- `src/shared/types/`：前端共享类型，包括 `AppData`、workspace 状态和表格状态类型。
- `src/shared/lib/`：Starsector 通用工具、默认数据、格式转换和 store 辅助函数。
- `schemas/`：随工具分发的 schema 文件，当前包含 `mod-info`、`faction`、`mission` 等已接入配置。
- `src/styles/`：按语义拆分的 CSS 模块和主题 token。具体规则见 `.trae/css-guidelines.md`。

### Rust 分层

- `src-tauri/src/lib.rs`：Tauri 装配、command 注册和 single-instance 插件。
- `src-tauri/src/commands/`：Tauri command 入口，保持薄封装。
- `src-tauri/src/services/`：业务流程层，组合 parser、filesystem 和 models。
- `src-tauri/src/parsers/`：CSV 和 Starsector 宽松 JSON 解析与写回。
- `src-tauri/src/models/`：payload、AppData 和 workspace 类型。
- `src-tauri/src/filesystem/`：路径、UTF-8 文本 IO、JSON 文件、贴图上传和资源扫描。
- `src-tauri/src/errors.rs`：统一错误类型和结果别名。

### Rust 服务

- `src-tauri/src/services/project/`：目录识别、游戏目录轻量概览扫描、项目加载、CSV 表扫描、势力发现、贴图、弹体资源和战术系统 `.system` 聚合。
- `src-tauri/src/services/config.rs`：Mod 信息、势力、战役列表/任务文件等配置保存流程。
- `src-tauri/src/services/tables.rs`：CSV 保存和 CSV changeset 生成流程。
- `src-tauri/src/services/file_changes.rs`：统一文本文件 changeset 生成、保存和回放逻辑。
- `src-tauri/src/services/workspace.rs`：工具私有 `workspace.json` 读写。

## 边界规则

### 前端边界

- 组件不直接拼 Tauri command payload；通过 feature service 或 shared API adapter。
- Store 不直接调用 Tauri 插件；持久化、文件读写和系统对话应通过 service 或 app 边界。
- `workspace.store` 不持有 `AppData`；`project.store` 不负责视图路由。
- 游戏目录轻量扫描不创建 `AppData`，未完整读取的 Mod 不进入 tables、editors、history。
- SchemaFormRenderer 只渲染单个聚合对象；保存边界由业务组件拆分处理。

### 后端边界

- command 保持薄入口，不承载业务逻辑。
- service 表达保存语义和路径安全边界。
- parser 不依赖 Tauri，不包含 UI 语义。
- filesystem 不推断前端状态，只处理路径和文件 IO。
- models 允许核心字段强类型和 extra 共存。
- 所有文本 IO 必须保持 UTF-8 无 BOM。
- 所有涉及用户传入路径、id、文件名的删除或写入都必须在后端校验。

### 保存边界

- CSV 保存只写对应 CSV 和显式确认的关联文件。
- spec 保存只写 `.ship/.wpn/.proj`，不隐式保存 CSV。
- 配置保存按业务 source 拆回原文件，不跨 source 偷写。
- workspace 持久化只写工具私有 `workspace.json`，不写 Mod 目录。
- core fallback 只影响读取、预览和候选列表，不改变保存目标。
