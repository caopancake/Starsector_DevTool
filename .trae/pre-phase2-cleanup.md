# Phase 2 前整理计划

## 背景

项目即将进入 Phase 2（多 Mod 工作区），该阶段涉及大范围的状态模型升级。在此之前，需要收敛现有代码中的臃肿、碎片化、重复模式和调用链异味，使代码库进入一个干净、一致的状态，降低后续改动的风险。

本次整理不改变架构，只做以下四类工作：

1. 收敛过度拆分的碎片文件
2. 消除重复模式
3. 统一不一致的调用风格
4. 清理 CSS 异味

---

## 1. 收敛碎片化的 lib 文件

### 问题

- `src/features/editors/lib/editor-utils.ts` 仅 8 行（`toOptions` + `snapToStep`）
- `src/features/editors/lib/editor-theme.ts` 仅 6 行（一个 Naive UI 主题覆盖常量）
- 两个文件独立存在没有稳定语义，增加导入噪音

### 方案

将两者合并为 `src/features/editors/lib/editor-constants.ts`，统一承载编辑器小型常量和工具函数。

**涉及文件：**

- 删除：`src/features/editors/lib/editor-utils.ts`
- 删除：`src/features/editors/lib/editor-theme.ts`
- 新建：`src/features/editors/lib/editor-constants.ts`
- 更新导入：`ShipEditor.vue`、`WeaponEditor.vue`（各 2 处 import 修改）

---

## 2. 修复跨 store 直接修改 appData 的耦合

### 问题

`editors.store.ts` 的 `onShipSaved` / `onWeaponSaved` / `onProjectileSaved` 接收 `project.data` 引用并直接写入：

```ts
function onShipSaved(appData: AppData | null, id: string, ship: RowData) {
  if (!appData) return;
  appData.shipFiles[id] = deepClone(ship); // ← editors store 修改了 project store 的数据
}
```

这是跨 store 的隐式耦合。`EditorsHost.vue` 负责连接两个 store，但实际数据修改不该穿透。

### 方案

1. 在 `project.store.ts` 新增三个更新方法：
   ```ts
   function updateShipFile(id: string, ship: RowData) { ... }
   function updateWeaponFile(id: string, weapon: RowData) { ... }
   function updateProjectileFile(id: string, projectile: RowData) { ... }
   ```
2. 从 `editors.store.ts` 中移除 `onShipSaved` / `onWeaponSaved` / `onProjectileSaved`
3. `EditorsHost.vue` 的 `onShipSaved` 等函数直接调用 `project.updateShipFile(id, ship)`

**涉及文件：**

- `src/features/project/project.store.ts`：新增 3 个方法
- `src/features/editors/editors.store.ts`：删除 3 个方法 + `deepClone` import
- `src/app/EditorsHost.vue`：调用方从 `editors.onShipSaved(project.data, ...)` 改为 `project.updateShipFile(id, ...)`

---

## 3. Rust 后端：提取事务辅助函数

### 问题

`src-tauri/src/services/tables.rs` 中：

- `add_ship_row`（第 34-58 行）和 `add_weapon_row`（第 78-103 行）使用完全相同的模式：追加 CSV → 提取 id → 验证 spec → 保存 JSON → 失败则回滚 CSV
- `delete_ship_row`（第 61-76 行）和 `delete_weapon_row`（第 105-120 行）使用完全相同的模式：备份 CSV → 删除 CSV → 删除 JSON → 失败则恢复 CSV

每对之间仅差异：表名 (`"ships"` / `"weapons"`)、id 字段 (`"hullId"` / `"id"`)、目录 (`"data/hulls"` / `"data/weapons"`)、扩展名 (`"ship"` / `"wpn"`)、验证函数。

### 方案

在文件内提取两个私有辅助函数：

```rust
/// 追加 CSV → 验证 spec → 保存 JSON；失败时回滚 CSV
fn add_row_with_spec(
    mod_root: &Path, table: &str, header: &[String], row: &Map<String, Value>,
    spec: &Value, id_field: &str, dir: &str, ext: &str,
    validate: fn(&Value) -> AppResult<()>,
) -> AppResult<()>

/// 备份 CSV → 删除 CSV 行 → 删除 JSON；失败时恢复 CSV
fn delete_row_with_spec(
    mod_root: &str, table: &str, id: &str,
    dir: &str, ext: &str, id_field: &str,
) -> AppResult<()>
```

原 `add_ship_row`、`add_weapon_row`、`delete_ship_row`、`delete_weapon_row` 改为调用辅助函数的薄包装。公开 API 签名不变，现有测试直接验证。

**涉及文件：**

- `src-tauri/src/services/tables.rs`

---

## 4. CSS：提取画布背景色为变量

### 问题

`src/styles/editors.css` 第 115 行：`background: #0b1020;` 是魔法值。

### 方案

- `base.css` 亮色主题添加 `--color-canvas-bg: #1a1d2e;`
- `base.css` 暗色主题添加 `--color-canvas-bg: #0b1020;`
- `editors.css` 改为 `background: var(--color-canvas-bg);`

**涉及文件：**

- `src/styles/base.css`
- `src/styles/editors.css`

---

## 5. CSS：移除未使用的变量

### 问题

`base.css` 定义了 `--color-primary-hover` 和 `--color-danger-soft`（亮色+暗色共 4 行），全项目无任何 `var(...)` 引用。

### 方案

删除这 4 行定义。

**涉及文件：**

- `src/styles/base.css`

---

## 6. CSS：合并重复的 `.editor-footer span` 规则

### 问题

`editors.css` 第 58-61 行和第 63-66 行分别定义了 `.editor-footer span` 的样式，前者在组合选择器中只设 `margin-right: auto`，后者设 `line-height` 和 `white-space`。

### 方案

合并为一条规则：

```css
.editor-footer span {
  margin-right: auto;
  line-height: 1.35;
  white-space: pre-line;
}
```

保留 `.spacer` 作为独立规则。

**涉及文件：**

- `src/styles/editors.css`

---

## 审视后决定不做的项

以下经过审视后判断为当前合理保留，不执行变更：

| 项                       | 保留理由                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- |
| ShipEditor.vue 1419 行   | 虽然大，但业务聚合价值高，module-map 明确允许保留；Phase 2 编辑器重构时自然收敛 |
| WeaponEditor.vue 857 行  | 同上                                                                            |
| project.service.ts 14 行 | Phase 2 会扩展此文件；当前边界正确                                              |
| undo/redo 初始化模式重复 | 两处 reset 逻辑不同，强行抽取会引入泛化回调                                     |
| inspector 展开/收起模式  | 逻辑量小，Phase 2 检查器独立面板时自然收敛                                      |
| canvas-visuals.ts 343 行 | 职责单一（绘制 helper），大小合理                                               |
| normalize.ts 27 行       | 功能明确，保持独立                                                              |
| tables.store.ts 283 行   | 密集但必要，Phase 2 状态隔离时会拆分                                            |

---

## 验证步骤

完成所有改动后按序执行：

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run encoding:check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri\Cargo.toml --check
```

全部通过视为整理完成。
