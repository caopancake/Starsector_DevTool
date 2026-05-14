# Editor Flows

本文档记录舰船、武器、弹体、联队、船插、工业等模块的当前调用链和文件落点。它描述现状，不替代 `module-map.md` 的模块边界说明。术语口径以 `.trae/terminology.md` 为准。

## 共享入口链路

1. 用户在主表格选择一行。
2. `src/app/DetailPane.vue` 根据 `tables.currentTab` 展示右侧操作入口。
3. 需要弹窗编辑的模块通过 `src/features/editors/editors.store.ts` 记录当前编辑 id。
4. `src/app/EditorsHost.vue` 根据 store 中的 id 挂载对应编辑器组件。
5. 编辑器组件通过 `src/features/editors/editor.service.ts` 调用保存或上传能力。
6. `src/shared/api/tauri.ts` 统一封装 Tauri command。
7. Rust `src-tauri/src/commands/` 接收 payload，转交 `src-tauri/src/services/`。
8. Rust service 组合 parser、filesystem 和 models 执行读写。

## 项目打开链路

- 入口：`App.vue` 的“打开 Mod 目录”按钮。
- 前端状态：`src/features/project/project.store.ts` 管理 `data`、`loading`、`projectName` 和 `isOpen`。
- 前端服务：`src/features/project/project.service.ts`
- 目录选择：`pickModRoot()` 调用 Tauri dialog 插件。
- 数据加载：`loadProject()` 调用 shared API adapter 的 `loadModData()`。
- Tauri command：`load_mod_data`
- Rust service：项目加载 service 负责扫描 Mod、读取 CSV/spec/sprite 和装配 `AppData`。
- 保存边界：打开项目只加载数据，不写入任何 Mod 文件。

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
- 数据来源：`project.data.shipFiles[id]`、`project.data.shipSprites[id]`、`project.data.availableSprites`。
- 画布渲染：武器槽、碰撞边界、中心、护盾和引擎使用编辑器共享绘制 helper；组件仍负责舰船专属 hit detection、拖拽和数据修改。

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
- 关联入口：武器编辑器可打开弹体编辑器，也可打开发射预览。
- 画布渲染：炮口和角度指示使用编辑器共享绘制 helper；组件仍负责 barrel hit detection、拖拽和 offset / angle 数据修改。

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
- 右侧详情预览：根据当前 tab 和当前记录即时派生缩略图状态；舰船、武器、船插使用已加载贴图映射，联队和工业当前只显示模块占位。
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

## 船插链路

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

## 当前缺口

- 联队、船插、工业当前只有 CSV 表格编辑，没有专用编辑器。
- 联队的 `.variant` 关系未进入创建/删除一致性链路。
- 弹体没有独立主表格，新建/删除入口尚未系统化。
- CSV 与 `.ship/.wpn` 字段暂不自动联动；后续实现前必须先定义字段映射、冲突优先级、保存时机和失败处理。
- 全局 undo/redo、快捷键和右键菜单分别留给 Phase 9、Phase 10 和 Phase 11。
