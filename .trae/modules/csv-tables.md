# CSV 表格系统

## 定义

CSV 表格系统负责展示和编辑已注册的 Starsector CSV 表，并按 CSV 列 schema 资产渲染确定类型、引用和多值字段。

## 边界

- `src/app/DataTable.vue` 连接表格 store、active Mod 数据和 CSV Grid。
- `src/app/components/tables/` 承载 CSV Grid、虚拟 body、行和单元格控件。
- `src/app/DetailPane.vue` 根据当前表、当前行和 CSV 列 schema 显示右侧字段速览，并只发出语义化详情动作。
- `src/stores/tables.store.ts` 持有每个 Mod 的表格、原始表格、dirty、选择和编辑状态。
- `src/domain/tables/csv-grid-model.ts` 生成 CSV Grid 的列、行和 source 索引。
- `src/domain/tables/csv-source-options.ts` 统一解析 CSV schema source、引用选项和引用索引。
- `src/domain/tables/table-row-key.ts` 负责 CSV 行身份。
- `src/domain/tables/table-detail-actions.ts` 定义详情面板可发出的文件编辑器、spec 编辑器和预览动作。
- `src/domain/tables/csv-column-schema.ts` 加载 CSV 列 schema 资产并提供列控件查询。
- `schemas/csv/*.columns.json` 存放 CSV 列 schema 资产。
- `src/services/table.service.ts` 调用 CSV 保存和局部加载 API。
- `src/shared/types/` 定义 `TableKey`、`RowData` 和 `ModTableState`。
- `src-tauri/src/models/project.rs` 中 `CSV_TABLES` 定义表名到 CSV 路径的映射。

## 规范

- 表格状态按 `modRoot` 隔离。
- `_rowKey` 是前端行身份，不写入磁盘。
- 业务 ID 只能通过 `rowSpecId()` 或对应表字段计算，不能把 `_rowKey` 当业务 ID。
- 空行、全逗号空行和 `#` 开头行都必须保留为可编辑、可删除的行。
- `#` 开头行不得作为其它字段、schema source、关联文件或编辑器入口的合法引用。
- `#` 开头行只允许 CSV 内容编辑；右侧详情不得提供引用预览、文件编辑器或专用编辑器动作。
- CSV 列 schema 是文件资产，不得把字段 schema 内联在组件、store 或 domain 代码常量中。
- CSV 列 schema 只覆盖确定类型、确定引用和确定多值语义；未覆盖列继续作为普通文本单元格编辑。
- CSV Grid 使用正式虚拟化渲染层，只负责可视行与编辑承载，不得改变表格行高、列宽、控件外观、选中态或 dirty 态。
- CSV Grid 的虚拟化只影响渲染成本，不得改变首屏可见内容、滚动跳变后的即时可读性或编辑语义。
- CSV Grid 列宽按列内容与表头计算并固定，不能在滚动过程中变化。
- CSV Grid 的业务编辑、选择和 dirty 状态必须以 row key 为索引。
- 右侧字段速览可以读取 CSV 列 schema 增强展示，但不得修改单元格、dirty 或保存状态。
- 没有业务 ID 的行不能显示 spec 文件编辑入口。
- `tables.store.ts` 只管理草稿、dirty、选择和编辑状态。
- 写盘、副作用、文件级 history 和关联 spec 创建删除由表格保存 orchestrator 处理。

## 链路：编辑 CSV 单元格

1. 用户在 CSV Grid 中开始编辑单元格。
2. Grid cell 根据 CSV 列 schema 选择结构化控件或普通文本编辑。
3. 普通文本编辑由 `tables.store` 记录 editing 状态。
4. 用户提交编辑。
5. `tables.store.finishCellEdit()` 或结构化控件更新当前表格行。
6. `tables.store` 根据 original table 更新 dirty。
7. `tables.store` 推入 CSV 草稿历史事件。
8. Grid 的虚拟化层只负责裁剪渲染范围，不改变已编辑值或行身份。

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
