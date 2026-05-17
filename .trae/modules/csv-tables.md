# CSV 表格系统

## 定义

CSV 表格系统负责展示和编辑 Starsector CSV 表，包括 ships、weapons、wings、hullmods、shipSystems 和 industries。它只管理草稿状态，不直接写盘。

## 边界

- `src/app/DataTable.vue` 渲染表格网格和单元格输入。
- `src/app/DetailPane.vue` 根据当前表和当前行显示右侧详情，并只发出语义化详情动作。
- `src/features/tables/tables-store.ts` 持有每个 Mod 的表格、原始表格、dirty、选择和编辑状态。
- `src/features/tables/table-row-key.ts` 负责 CSV 行身份。
- `src/features/tables/table-detail-actions.ts` 定义详情面板可发出的文件编辑器、spec 编辑器和预览动作。
- `src/features/tables/table-service.ts` 调用 CSV 保存和局部加载 API。
- `src/shared/types.ts` 定义 `TableKey`、`RowData` 和 `ModTableState`。
- `src-tauri/src/models/project.rs` 中 `CSV_TABLES` 定义表名到 CSV 路径的映射。

## 规范

- 表格状态按 `modRoot` 隔离。
- `_rowKey` 是前端行身份，不写入磁盘。
- 业务 ID 只能通过 `rowSpecId()` 或对应表字段计算，不能把 `_rowKey` 当业务 ID。
- 空行、全逗号空行和 `#` 注释行都必须保留为可编辑、可删除的行。
- 没有业务 ID 的行不能显示 spec 文件编辑入口。
- `tables.store.ts` 只管理草稿、dirty、选择和编辑状态。
- 写盘、副作用、文件级 history 和关联 spec 创建删除由表格保存 orchestrator 处理。

## 链路：编辑 CSV 单元格

1. 用户在 `DataTable.vue` 中开始编辑单元格。
2. `tables.store` 记录 editing 状态。
3. 用户提交编辑。
4. `tables.store.finishCellEdit()` 写入当前表格行。
5. `tables.store` 根据 original table 更新 dirty。
6. `tables.store` 推入 CSV 草稿历史事件。

## 链路：新增 CSV 行

1. 用户触发新增行。
2. `tables.store.addNewRow()` 根据当前表 header 创建空行。
3. `table-row-key.ts` 分配 `_rowKey`。
4. `tables.store` 把新行插入当前表。
5. `tables.store` 标记新行 dirty。
6. `tables.store` 推入 `row-create` 草稿历史事件。

## 链路：删除 CSV 行

1. 用户触发删除当前行。
2. `tables.store.deleteSelected()` 用 selected row key 查找行。
3. `tables.store` 从当前表移除行。
4. 原始表存在该行时写入 `_deleted` dirty 标记。
5. 原始表不存在该行时清除该行 dirty。
6. `tables.store` 推入 `row-delete` 草稿历史事件。
