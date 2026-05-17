# Editor Flows

本文档记录舰船、武器、弹体、联队、舰船插件、工业等模块的当前调用链和文件落点。它描述现状，不替代 `module-map.md` 的模块边界说明。术语口径以 `.trae/terminology.md` 为准。

## 共享入口链路

1. 用户在主表格选择一行。
2. `src/app/DetailPane.vue` 根据 `tables.currentTab` 展示右侧操作入口。
3. 需要弹窗编辑的模块通过 `src/features/editors/editors.store.ts` 记录当前编辑 id。
4. `src/app/EditorsHost.vue` 根据 store 中的 id 挂载对应编辑器组件。

## 启动恢复链路

- 触发：`App.vue` 的 `onMounted` 钩子。
- 流程：
  1. `loadWorkspace()` → Tauri command `load_workspace` → Rust 读取 `%APPDATA%/com.starsector.devtool/workspace.json`。
  2. 若文件不存在或损坏，返回空默认值，视为首次启动。
  3. `workspace.restoreFrom(persisted)` 恢复游戏目录概览、已完整读取 Mod 列表（status: loading）、视图、展开状态。
  4. 逐个 Mod 调用 `project.openProject(modRoot)` 加载数据。
  5. 加载成功：`workspace.updateModStatus('ready')`，`tables.hydrate(modRoot, loaded)`。
  6. 加载失败：从 workspace、tables、editors、history、project 缓存中移除该 Mod，不在左侧栏保留空节点；若错误能定位文件，顶部错误提示提供“打开错误文件”。
  7. 恢复 activeModRoot：仅当该 Mod 状态为 ready 时激活。
- 持久化触发：workspace store 状态变化时，通过 `watch(workspace.toPersistedState())` 防抖 500ms 后写入。
- Tauri command：`save_workspace` → Rust 写 workspace.json。
- 单例化：`tauri-plugin-single-instance` 在 Rust 端注册，第二个实例启动时聚焦第一个窗口。

5. 编辑器组件通过 `src/features/editors/editor.service.ts` 调用保存或上传能力。
6. `src/shared/api/tauri.ts` 统一封装 Tauri command。
7. Rust `src-tauri/src/commands/` 接收 payload，转交 `src-tauri/src/services/`。
8. Rust service 组合 parser、filesystem 和 models 执行读写。

## 项目打开链路（多 Mod 工作区）

- 入口：OverviewPage 的“打开目录”按钮。
- 编排：`App.vue` 只负责选择目录和提示；具体打开流程由 `src/features/workspace/open-directory.service.ts` 执行。
- 流程：
  1. `pickDirectory()` 选择目录。
  2. `detect_directory()` 返回 `game-root`、`mod-in-game`、`external-mod` 或 `unknown`。
  3. `game-root`：写入 `workspace.gameOverview`，只展示轻量 Mod 概览，不读取 CSV/spec/贴图。
  4. `mod-in-game`：写入游戏目录概览，并完整读取所选 Mod，读取完成后回到总览页。
  5. `external-mod`：只完整读取该 Mod；设置页游戏目录只作为原版资源 fallback。
  6. 游戏概览页点击“完整读取”时，使用该游戏目录作为显式 `starsectorRoot` 读取目标 Mod。
  7. 完整读取前 `workspace.registerMod(entry)` 注册为 loading 状态。
  8. `workspace.setActiveMod(modRoot)` 设置为活动 Mod。
  9. `project.openProject(modRoot, starsectorRoot)` 加载数据，写入 `modsData` Map。
  10. `workspace.updateModInfo()` 更新显示名和版本。
  11. `workspace.updateModStatus(modRoot, 'ready')` 标记就绪。
  12. `tables.hydrate(modRoot, loaded)` 创建该 Mod 的表格状态。
  13. `editors.activateFor(modRoot)` 激活编辑器状态。
- 游戏目录概览链路：
  1. `scan_game_overview()` 只读取 `mods/*/mod_info.json`。
  2. 概览页显示 Mod 名称、版本、路径、warning 和“完整读取”按钮。
  3. 未完整读取的 Mod 不进入 `project.modsData`、`tables.stateMap`、`editors` 或 `history`。
- 旧单 Mod 链路兼容：
  1. `pickModRoot()` 仍作为 `pickDirectory()` 的兼容别名。
  2. 检查是否已导入（`workspace.isModImported(modRoot)`），若是则仅激活。
- 前端状态：
  - `workspace.store.ts` 管理游戏目录上下文、已完整读取 Mod 列表和活动 Mod。
  - `workspace.gameOverview` / `workspace.gameWorkspace` 管理游戏目录轻量扫描结果和已完整读取 Mod 状态。
  - `project.store.ts` 的 `modsData: Map<modRoot, AppData>` 缓存所有已加载数据。
  - `project.data` 是 computed，指向当前活动 Mod 的 AppData。
- Tauri command：`detect_directory`、`scan_game_overview`、`load_mod_data`、`load_mod_data_with_root`
- 保存边界：打开项目只加载数据，不写入任何 Mod 文件。
- 文件编辑器：解析/读取失败可打开独立文件编辑器窗口，窗口显示文件路径和错误消息，红色高亮目标行；同一文件按规范化绝对路径复用已有窗口，不重复打开。保存只通过 `save_editable_file` 原样写回该文件，不触发重新加载。窗口内支持 `Esc` 关闭、`Ctrl+S` 保存、`Ctrl+Z` 撤销、`Ctrl+Shift+Z` 重做。当前只由错误修复入口调用，但窗口请求结构已预留通用标题、上下文消息和目标行。

## Mod 切换链路

- 入口：左侧 ModTreeItem 点击 Mod 名。
- 流程：
  1. `workspace.setActiveMod(modRoot)` 更新 `activeModRoot` 和 `currentView`。
  2. App.vue 的 `watch(workspace.activeModRoot)` 同步触发：
     - `project.setActiveModRoot(modRoot)` → `data` computed 自动指向新 Mod
     - `tables.activateFor(modRoot)` → 表格状态切换到该 Mod 的 ModTableState
     - `editors.activateFor(modRoot)` → 编辑器状态切换
  3. UI 自动响应 computed 变化渲染。
- 保存边界：切换不写入文件；per-Mod dirty 状态保持隔离。

## Mod 移除链路

- 入口：ModTreeItem 的上下文菜单”从工作区移除”。
- 流程：
  1. `App.vue` 的 `confirmRemoveMod(modRoot)` 检查 dirty → 弹确认。
  2. `workspace.removeMod(modRoot)` 从列表删除，自动切换活动 Mod。
  3. `tables.removeModState(modRoot)` 释放表格状态。
  4. `editors.removeModState(modRoot)` 释放编辑器状态。
  5. `project.removeModData(modRoot)` 释放 AppData 缓存。
- 保存边界：移除只取消导入，不删除本地文件。

`project.store.ts` 不直接调用 Tauri command 或 Tauri 插件；project feature service 是项目打开链路的边界。

## CSV 表格链路

- 前端状态：`src/features/tables/tables.store.ts`
- 前端服务：`src/features/tables/table.service.ts`
- API adapter：`saveCsv`、`addCsvRow`、`deleteCsvRow`
- Tauri commands：`save_csv`、`add_csv_row`、`delete_csv_row`
- Rust service：`src-tauri/src/services/tables.rs`
- CSV parser：`src-tauri/src/parsers/csv.rs`

顶部“保存 CSV”只保存当前 CSV 表格相关数据，不保存 `.ship`、`.wpn` 或 `.proj` spec 文件。CSV 写回必须保留表头、注释行和空字段语义。

## 舰船链路

### 打开

- 入口：右侧详情面板的“舰船编辑器”按钮。
- 前端状态：`editors.openShip(id)` 设置 `shipEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `ShipEditor.vue`。
- 数据来源：`project.data.shipFiles[id]`、`project.data.shipSprites[id]`。
- 画布渲染：舰船贴图按 Starsector 原始朝上资源转换为船头朝右显示；武器槽、碰撞边界、中心、护盾和引擎使用编辑器共享绘制 helper。
- 交互边界：组件仍负责舰船专属坐标换算、自动吸附选择、强选择、拖拽和数据修改。

### 保存规格

- 组件：`ShipEditor.vue`
- 前端服务：`saveShipSpec()`
- API adapter：`saveShip()`
- Tauri command：`save_ship`
- Rust service：`services::save_ship`
- 文件落点：`data/hulls/*.ship`
- 保存后：`editors.onShipSaved()` 更新 `project.data.shipFiles[id]`。
- 边界：编辑器“保存 .ship”只保存 spec，不同步写 `ship_data.csv`。

### 新建/删除记录

- 新建：`tables.addNewRow()` 在 `ships` tab 下生成 CSV 行和 `defaultShip(id)`。
- API adapter：`addShipRow()`
- Tauri command：`add_ship_row`
- Rust service：`add_ship_row()`
- 语义：CSV 行和 `.ship` 创建作为同一条后端业务链路；`.ship` 校验或保存失败时回滚新写入的 CSV 行。
- 删除：`deleteShipRow()`
- 语义：先删除 CSV 行，再尝试删除 `.ship`；`.ship` 缺失时不报错、不恢复 CSV；真实删除错误时恢复 CSV 并报错。
- 边界：当前不存在独立删除 `.ship` 的产品入口；删除舰船记录必须走 `delete_ship_row` 链路。

## 武器链路

### 打开

- 入口：右侧详情面板的“武器编辑器”按钮。
- 前端状态：`editors.openWeapon(id)` 设置 `weaponEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `WeaponEditor.vue`。
- 数据来源：优先 `project.data.wpnFiles[id]`；缺失时由 `defaultWeapon(id, csvRow)` 生成临时默认 spec。
- 贴图来源：`project.data.weaponSpritesData[id]` 按 `turret*` / `hardpoint*` sprite 字段提供 data URL，编辑器按当前视图绘制对应贴图层。
- 关联入口：武器编辑器可打开弹体编辑器，也可打开发射预览。
- 画布渲染：炮塔视图和固定视图分别使用对应贴图与发射点数据，炮口和角度指示使用编辑器共享绘制 helper。
- 交互边界：组件仍负责发射点自动吸附、强选择、拖拽、新增、删除和 angle offset 修改。

### 保存规格

- 组件：`WeaponEditor.vue`
- 前端服务：`saveWeaponSpec()`
- API adapter：`saveWeapon()`
- Tauri command：`save_wpn`
- Rust service：`services::save_weapon`
- 文件落点：`data/weapons/*.wpn`
- 保存后：`editors.onWeaponSaved()` 更新 `project.data.wpnFiles[id]`。
- 边界：编辑器“保存 .wpn”只保存 spec，不同步写 `weapon_data.csv`。

### 新建/删除记录

- 新建：`tables.addNewRow()` 在 `weapons` tab 下生成 CSV 行和 `defaultWeapon(id, row)`。
- API adapter：`addWeaponRow()`
- Tauri command：`add_weapon_row`
- Rust service：`add_weapon_row()`
- 语义：CSV 行和 `.wpn` 创建作为同一条后端业务链路；`.wpn` 校验或保存失败时回滚新写入的 CSV 行。
- 删除：`deleteWeaponRow()`
- 语义：先删除 CSV 行，再尝试删除 `.wpn`；`.wpn` 缺失时不报错、不恢复 CSV；真实删除错误时恢复 CSV 并报错。
- 边界：当前不存在独立删除 `.wpn` 的产品入口；删除武器记录必须走 `delete_weapon_row` 链路。

## 弹体链路

### 打开

- 入口：武器编辑器触发 `edit-projectile`，或后续专用弹体入口。
- 前端状态：`editors.openProjectile(id)` 设置 `projectileEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `ProjectileEditor.vue`。
- 数据来源：`project.data.projFiles[id]`。

### 保存规格

- 组件：`ProjectileEditor.vue`
- 前端服务：`saveProjectileSpec()`
- API adapter：`saveProjectile()`
- Tauri command：`save_proj`
- Rust service：`services::save_projectile`
- 文件落点：`data/weapons/proj/*.proj`
- 保存后：`editors.onProjectileSaved()` 更新 `project.data.projFiles[id]`。
- 边界：编辑器“保存 .proj”只保存 spec，不存在对应 CSV 保存链路。

弹体当前没有主表格记录的新建/删除链路；它跟随武器 spec 的 `projectileSpecId` 关系使用。

## 发射预览链路

- 入口：右侧详情面板或武器编辑器的预览操作。
- 前端状态：`editors.openPreview(id)` 设置 `previewWeaponId`。
- 宿主：`EditorsHost.vue` 挂载 `WeaponFirePreview.vue`。
- 数据来源：`tables.tables.weapons`、`project.data.wpnFiles`、`project.data.projFiles`。
- 文件写入：无。预览只读当前内存数据。
- 模块归属：preview 当前是 `editors` feature 的只读子能力，不单独拆 feature。

## 界面载体边界

- 右侧详情面板：上下文摘要和操作入口，不承载复杂编辑。
- 右侧详情预览：根据当前 tab 和当前记录即时派生缩略图状态；舰船、武器、舰船插件使用已加载贴图映射，联队和工业当前只显示模块占位。
- 缺失贴图：当当前记录或 spec 能推导出相对路径但对应数据未加载时，右侧详情显示“贴图缺失”和该路径；无法推导路径时显示“无预览”。
- Modal 弹窗：舰船、武器、弹体等复杂编辑和发射预览。
- 抽屉：当前不引入；未来若出现轻量编辑场景，应先定义和 modal 的分工。
- `EditorsHost.vue`：集中挂载编辑器/预览弹窗，并处理 spec 保存成功后的提示。
- 失败提示：具体编辑器本地 catch 并展示，保持错误上下文贴近操作来源。

## 联队链路

- 主数据：`data/hulls/wing_data.csv`
- 前端状态：`tables.store.ts` 的 `wings` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。
- 资源预览：暂无稳定资源来源，右侧详情只显示占位说明。
- 关联风险：`variant` 指向 `.variant` 文件，但当前没有联动创建、删除或编辑 `.variant` 的链路。

## 舰船插件链路

- 主数据：`data/hullmods/hull_mods.csv`
- 前端状态：`tables.store.ts` 的 `hullmods` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。
- 资源预览：右侧详情面板可根据 `project.data.hullmodSprites` 显示贴图。

## 工业链路

- 主数据：`data/campaign/industries.csv`
- 前端状态：`tables.store.ts` 的 `industries` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。
- 资源预览：右侧详情面板可根据 `image` 字段显示工业贴图；字段为空或资源缺失时显示对应占位或缺失路径。

## 贴图上传链路

- 前端 composable：`src/features/editors/composables/useSpriteUpload.ts`
- 前端服务：`uploadEditorSprite()`
- API adapter：`uploadSprite()`
- Tauri command：`upload_sprite`
- Rust filesystem：`src-tauri/src/filesystem/assets.rs`
- 目录规则：
  - 舰船：`graphics/ships/`
  - 武器：`graphics/weapons/`
  - 弹体：`graphics/missiles/`

上传只负责写入贴图文件并返回相对路径；对应 spec 字段仍由编辑器保存链路写回。

## 图片加载与预览链路

### 图片加载 fallback 链

- API：`loadImageDataUrl(modRoot, relPath, starsectorRoot?)`
- Tauri command：`load_image_data_url`
- Rust service：`services::load_image_as_data_url(mod_root, rel_path, starsector_root)`
- 查找顺序：
  1. `{modRoot}/{relPath}` — Mod 自有贴图
  2. `{starsectorRoot}/starsector-core/{relPath}` — 用户配置的游戏目录
  3. `{modRoot}/../../starsector-core/{relPath}` — 自动推断游戏目录
- 返回：base64 data URL 或 null

### starsector-core 图片索引

- API：`scanCoreGraphics(starsectorRoot)`
- Tauri command：`scan_core_graphics`
- Rust service：`services::scan_core_graphics` 遍历 `starsector-core/graphics/` 下所有 png/jpg
- 前端缓存：`useCoreGraphics` composable（模块级单例，启动时加载一次）
- 用途：`path-image` 字段的下拉候选列表，合并 Mod sprites + core graphics

### path-image 字段 UI

- 控件组合：可搜索下拉选择器 + 📂 文件选择器按钮
- 下拉候选来源：`appData.availableSprites`（Mod 贴图）+ `graphicsPaths`（core 贴图）
- 文件选择器默认定位：Mod 根目录，选取后自动计算相对路径
- 显示：文件名作为 label，完整路径作为 value

## 编辑器交互口径

- 舰船和武器编辑器内的快捷键只在编辑器作用域生效，表单控件聚焦时不抢输入。
- 画布内自动吸附负责快速选择最近可编辑目标；右侧检查器点击负责明确选择，下一次画布移动可以重新接管选择。
- 画布坐标和贴图锚点是编辑器内部显示语义，不改变 `.ship`、`.wpn`、`.proj` 的保存边界。

## 全局历史链路

### 事件模型

- `CsvCellEditEvent`：CSV 单元格修改（tab, rowKey, col, previousValue, newValue）。
- `EditorSaveEvent`：编辑器保存整体 spec（editorKind, id, previousSpec, newSpec 深拷贝）。
- `SpriteFieldWriteEvent`：贴图路径字段修改（editorKind, id, field, prev/new value）。

### 栈结构

- 每个 Mod 拥有独立的 `undoStack` 和 `redoStack`。
- 栈中可包含：`HistoryEntry`（可逆事件）、`HistoryBarrier`（不可逆屏障）、`HistoryCheckpoint`（保存检查点）。

### 触发点

| 操作           | 推入类型                                        | 触发位置                                                              |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| CSV 单元格编辑 | `pushEvent(CsvCellEditEvent)`                   | `tables.store.ts` → `finishCellEdit()`                                |
| 编辑器保存     | `pushEvent(EditorSaveEvent)` + `pushCheckpoint` | `EditorsHost.vue` → `onShipSaved`/`onWeaponSaved`/`onProjectileSaved` |
| CSV 保存       | `pushCheckpoint('csv-save')`                    | `tables.store.ts` → `saveChanges()`                                   |
| 新建行         | `pushBarrier('row-create')`                     | `tables.store.ts` → `addNewRow()`                                     |
| 删除行         | `pushBarrier('row-delete')`                     | `tables.store.ts` → `deleteSelected()`                                |
| 贴图覆盖       | `pushBarrier('sprite-overwrite')`               | `useSpriteUpload.ts`                                                  |

### 主界面 Ctrl+Z/Y

- 由 `useGlobalShortcuts()` composable 在 `App.vue` 中注册。
- 编辑器弹窗打开时让步（编辑器内 Ctrl+Z 使用局部 `useHistory`）。
- 输入控件聚焦时忽略。
- Undo 遇到 barrier 时停止并提示用户。

### 作用域规则

| 场景        | 行为                                               |
| ----------- | -------------------------------------------------- |
| 编辑器打开  | Ctrl+Z 使用编辑器内局部历史；全局栈不受影响        |
| 编辑器关闭  | Ctrl+Z 操作全局栈；编辑器保存事件作为一个原子条目  |
| 切换 Mod    | 各 Mod 历史栈独立；切换后 Ctrl+Z 操作目标 Mod 的栈 |
| 跨 Tab 切换 | 历史栈不受 Tab 切换影响；undo 修改数据模型而非视图 |

### 限制与裁剪

- 历史上限由 `settings.store.ts` 的 `historyLimit` 控制（默认 128，可在设置页配置）。
- `pushEvent` 和 `pushCheckpoint` 后均检查并裁剪超限条目（从最旧开始移除）。

## 当前缺口

- 联队、舰船插件、工业当前只有 CSV 表格编辑，没有专用编辑器。
- 联队的 `.variant` 关系未进入创建/删除一致性链路。
- 弹体没有独立主表格，新建/删除入口尚未系统化。
- CSV 与 `.ship/.wpn` 字段暂不自动联动；后续实现前必须先定义字段映射、冲突优先级、保存时机和失败处理。
- 主界面级快捷键和右键菜单仍需后续统一设计；全局 undo/redo 已实现，编辑器内已有局部 undo/redo 和快捷键作用域。
