# Editor Flows

本文档记录舰船、武器、弹丸、联队、船插、工业等模块的当前调用链和文件落点。它描述现状，不替代 `module-map.md` 的模块边界说明。

## Shared Entry Flow

1. 用户在主表格选择一行。
2. `src/app/DetailPane.vue` 根据 `tables.currentTab` 展示右侧操作入口。
3. 需要弹窗编辑的模块通过 `src/features/editors/editors.store.ts` 记录当前编辑 id。
4. `src/app/EditorsHost.vue` 根据 store 中的 id 挂载对应编辑器组件。
5. 编辑器组件通过 `src/features/editors/editor.service.ts` 调用保存或上传能力。
6. `src/shared/api/tauri.ts` 统一封装 Tauri command。
7. Rust `src-tauri/src/commands/` 接收 payload，转交 `src-tauri/src/services/`。
8. Rust service 组合 parser、filesystem 和 models 执行读写。

## CSV Table Flow

- 前端状态：`src/features/tables/tables.store.ts`
- 前端服务：`src/features/tables/table.service.ts`
- API adapter：`saveCsv`、`addCsvRow`、`deleteCsvRow`
- Tauri commands：`save_csv`、`add_csv_row`、`delete_csv_row`
- Rust service：`src-tauri/src/services/tables.rs`
- CSV parser：`src-tauri/src/parsers/csv.rs`

顶部“保存 CSV”只保存当前 CSV 表格相关数据，不保存 `.ship`、`.wpn` 或 `.proj` spec 文件。CSV 写回必须保留表头、注释行和空字段语义。

## Ship Flow

### Open

- 入口：右侧详情面板的“舰船编辑器”按钮。
- 前端状态：`editors.openShip(id)` 设置 `shipEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `ShipEditor.vue`。
- 数据来源：`project.data.shipFiles[id]`、`project.data.shipSprites[id]`、`project.data.availableSprites`。

### Save Spec

- 组件：`ShipEditor.vue`
- 前端服务：`saveShipSpec()`
- API adapter：`saveShip()`
- Tauri command：`save_ship`
- Rust service：`services::save_ship`
- 文件落点：`data/hulls/*.ship`
- 保存后：`editors.onShipSaved()` 更新 `project.data.shipFiles[id]`。
- 边界：编辑器“保存 .ship”只保存 spec，不同步写 `ship_data.csv`。

### Create/Delete Record

- 新建：`tables.addNewRow()` 在 `ships` tab 下生成 CSV 行和 `defaultShip(id)`。
- API adapter：`addShipRow()`
- Tauri command：`add_ship_row`
- Rust service：`add_ship_row()`
- 语义：CSV 行和 `.ship` 创建作为同一条后端业务链路；`.ship` 校验或保存失败时回滚新写入的 CSV 行。
- 删除：`deleteShipRow()`
- 语义：先删除 CSV 行，再尝试删除 `.ship`；`.ship` 缺失时不报错、不恢复 CSV；真实删除错误时恢复 CSV 并报错。

## Weapon Flow

### Open

- 入口：右侧详情面板的“武器编辑器”按钮。
- 前端状态：`editors.openWeapon(id)` 设置 `weaponEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `WeaponEditor.vue`。
- 数据来源：优先 `project.data.wpnFiles[id]`；缺失时由 `defaultWeapon(id, csvRow)` 生成临时默认 spec。
- 关联入口：武器编辑器可打开 projectile 编辑器，也可打开弹道预览。

### Save Spec

- 组件：`WeaponEditor.vue`
- 前端服务：`saveWeaponSpec()`
- API adapter：`saveWeapon()`
- Tauri command：`save_wpn`
- Rust service：`services::save_weapon`
- 文件落点：`data/weapons/*.wpn`
- 保存后：`editors.onWeaponSaved()` 更新 `project.data.wpnFiles[id]`。
- 边界：编辑器“保存 .wpn”只保存 spec，不同步写 `weapon_data.csv`。

### Create/Delete Record

- 新建：`tables.addNewRow()` 在 `weapons` tab 下生成 CSV 行和 `defaultWeapon(id, row)`。
- API adapter：`addWeaponRow()`
- Tauri command：`add_weapon_row`
- Rust service：`add_weapon_row()`
- 语义：CSV 行和 `.wpn` 创建作为同一条后端业务链路；`.wpn` 校验或保存失败时回滚新写入的 CSV 行。
- 删除：`deleteWeaponRow()`
- 语义：先删除 CSV 行，再尝试删除 `.wpn`；`.wpn` 缺失时不报错、不恢复 CSV；真实删除错误时恢复 CSV 并报错。

## Projectile Flow

### Open

- 入口：武器编辑器触发 `edit-projectile`，或后续专用 projectile 入口。
- 前端状态：`editors.openProjectile(id)` 设置 `projectileEditorId`。
- 宿主：`EditorsHost.vue` 挂载 `ProjectileEditor.vue`。
- 数据来源：`project.data.projFiles[id]`。

### Save Spec

- 组件：`ProjectileEditor.vue`
- 前端服务：`saveProjectileSpec()`
- API adapter：`saveProjectile()`
- Tauri command：`save_proj`
- Rust service：`services::save_projectile`
- 文件落点：`data/weapons/proj/*.proj`
- 保存后：`editors.onProjectileSaved()` 更新 `project.data.projFiles[id]`。
- 边界：编辑器“保存 .proj”只保存 spec，不存在对应 CSV 保存链路。

Projectile 当前没有主表格记录的新建/删除链路；它跟随武器 spec 的 `projectileSpecId` 关系使用。

## Ballistic Preview Flow

- 入口：右侧详情面板或武器编辑器的预览操作。
- 前端状态：`editors.openPreview(id)` 设置 `previewWeaponId`。
- 宿主：`EditorsHost.vue` 挂载 `BallisticPreview.vue`。
- 数据来源：`tables.tables.weapons`、`project.data.wpnFiles`、`project.data.projFiles`。
- 文件写入：无。预览只读当前内存数据。

## Wing Flow

- 主数据：`data/hulls/wing_data.csv`
- 前端状态：`tables.store.ts` 的 `wings` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。
- 关联风险：`variant` 指向 `.variant` 文件，但当前没有联动创建、删除或编辑 `.variant` 的链路。

## Hullmod Flow

- 主数据：`data/hullmods/hull_mods.csv`
- 前端状态：`tables.store.ts` 的 `hullmods` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。
- 资源预览：右侧详情面板可根据 `project.data.hullmodSprites` 显示贴图。

## Industry Flow

- 主数据：`data/campaign/industries.csv`
- 前端状态：`tables.store.ts` 的 `industries` 表。
- 保存：顶部保存通过 `save_csv` 写回 CSV。
- 新建/删除：当前只操作 CSV 行，通过 `add_csv_row` / `delete_csv_row`。
- 专用编辑器：暂无。

## Sprite Upload Flow

- 前端 composable：`src/features/editors/composables/useSpriteUpload.ts`
- 前端服务：`uploadEditorSprite()`
- API adapter：`uploadSprite()`
- Tauri command：`upload_sprite`
- Rust filesystem：`src-tauri/src/filesystem/assets.rs`
- 目录规则：
  - 舰船：`graphics/ships/`
  - 武器：`graphics/weapons/`
  - 导弹/弹丸：`graphics/missiles/`

上传只负责写入贴图文件并返回相对路径；对应 spec 字段仍由编辑器保存链路写回。

## Known Gaps

- 联队、船插、工业当前只有 CSV 表格编辑，没有专用编辑器。
- 联队的 `.variant` 关系未进入创建/删除一致性链路。
- 弹丸没有独立主表格，新建/删除入口尚未系统化。
- CSV 与 `.ship/.wpn` 字段暂不自动联动；后续实现前必须先定义字段映射、冲突优先级、保存时机和失败处理。
