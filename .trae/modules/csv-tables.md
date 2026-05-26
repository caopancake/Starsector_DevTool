# CSV 表格系统

## 定义

CSV 表格系统负责展示和编辑已注册的 Starsector CSV 表，并按 CSV 列 schema 资产渲染确定类型、引用和多值字段。

## 边界

- `src/app/DataTable.vue` 是 CSV 表格薄壳，只渲染 CSV Grid 和空状态。
- `src/app/composables/use-csv-table-view-model.ts` 统一编排 CSV window query、source option query、grid model、搜索、势力筛选和性能日志。
- `src/app/components/tables/` 承载 CSV Grid、虚拟 body、行和单元格控件。
- `src/app/DetailPane.vue` 根据当前表、当前行和 CSV 列 schema 显示右侧字段速览，并只发出语义化详情动作。
- `src/stores/tables.store.ts` 持有每个 Mod 的表格、原始表格、dirty row、选择和编辑状态。
- `src/domain/tables/csv-grid-model.ts` 生成 CSV Grid 的列、行和 source 索引。
- `src/domain/tables/csv-source-options.ts` 解析 CSV source 并管理已 query 的 source option 索引。
- `src/domain/tables/table-row-key.ts` 负责 CSV 行身份。
- `src/domain/tables/table-detail-actions.ts` 定义详情面板可发出的文件编辑器和编辑器窗口动作。
- `src/domain/tables/associated-specs.ts` 注册公开 CSV 表到关联 spec 文件、默认创建内容和编辑器窗口 kind 的映射。
- `src/domain/tables/csv-column-schema.ts` 加载 CSV 列 schema 资产并提供列控件查询。
- `schemas/csv/*.columns.json` 存放 CSV 列 schema 资产。
- `src/services/csv-table.service.ts` 调用 CSV window query、source query 和当前表 patch 保存能力。
- `src/services/write.service.ts` 把 CSV patch 保存统一转换为写入结果模型。
- `src/shared/types/` 定义 `TableKey`、`RowData` 和 `ModTableState`。
- `src-tauri/src/models/project.rs` 中 `CsvTableKey` 和 `CSV_TABLES` 定义表名到 CSV 路径的映射。

## 规范

- 表格状态按 `modRoot` 隔离。
- 前后端 CSV query 和保存边界必须使用正式表 key 模型，不得用裸字符串承载表选择语义。
- CSV 势力筛选必须使用正式筛选模型，不能用裸字符串在组件、store 或后端 query 中推断“不筛选”语义。
- CSV 势力筛选内部字段只属于支持势力筛选的表和真实数据行；其它表、空行和注释行不得注入 `_faction`。
- CSV query 的可空过滤字段必须显式提交 null，不能依赖缺省参数表达 wire 语义。
- 前端公开 CSV 表 key 列表归属共享类型模型；store 只能消费共享 `TABLE_KEYS`，不得自行维护另一份表 key 注册表。
- 公开 CSV 表格摘要必须以注册表 key 为边界，不能混入其它 entity query 使用的内部 CSV 索引。
- rowKey 是 session 内 CSV 行身份，不写入磁盘；保存时 upsert 只能引用已存在 rowKey 或当前表的正式临时新增 rowKey，不能把任意未知 rowKey 追加成新行。
- CSV 选中行缺失必须以 null 表达，不能用空字符串伪装 rowKey。
- 业务 ID 只能通过 `rowSpecId()` 或对应表字段计算，不能把 `_rowKey` 当业务 ID。
- CSV 行内部字段必须通过共享内部字段规则识别，表格列推断、dirty 生成和草稿回放不得各自判断 `_` 前缀。
- 空行、全逗号空行和 `#` 开头行都必须保留为可编辑、可删除的行。
- `#` 开头行不得作为其它字段、schema source、关联文件或编辑器入口的合法引用。
- `#` 开头行只允许 CSV 内容编辑；右侧详情不得提供引用预览、文件编辑器或专用编辑器动作。
- CSV 列 schema 是文件资产，不得把字段 schema 内联在组件、store 或 domain 代码常量中。
- CSV 列 schema 只覆盖确定类型、确定引用和确定多值语义；未覆盖列继续作为普通文本单元格编辑。
- CSV Grid 表头显示 `schema.label`（中文名），没有 schema 时回退显示英文原始 `key`；原始 key 通过 `title` 属性保留在 tooltip 中供查阅。
- CSV Grid 列宽计算基于实际显示文本（label 或 key），确保中文表头不溢出。
- CSV 列 schema 的 label 只影响 UI 显示层，不影响数据读写、保存、patch、dirty、搜索或任何后端链路。
- CSV 列控件的显示名、原生输入、picker、引用、布尔选项、布尔显示、多值判断和多值拆分写回归属 CSV schema domain，组件不得各自维护控件类型集合或字段值解释规则。
- 新增 CSV 表默认接入通用表格体系；只有存在明确专用语义时才允许新增详情动作或专用编辑器。
- 表到关联 spec 文件、默认创建内容和编辑器窗口 kind 的映射只能归属关联 spec 注册表，组件、保存编排和详情动作不得各自维护表名分支。
- CSV Grid 使用正式虚拟化渲染层，只负责可视行与编辑承载，不得改变表格行高、列宽、控件外观、选中态或 dirty 态。
- CSV Grid 的虚拟化只影响渲染成本，不得改变首屏可见内容、滚动跳变后的即时可读性或编辑语义。
- CSV window 缓存中的未加载位置必须是显式空 slot，不能伪装成带 rowKey 的 CSV 行。
- CSV Grid 只能给已加载真实行分配 rowKey；占位渲染 slot 不能进入选择、编辑、dirty、详情或保存链路。
- CSV Grid 常态显示和激活编辑必须共用同一个单元格视觉 frame；激活只替换 frame 内部内容，不得产生内容偏移。
- CSV Grid 的智能选择使用 CSV 专用 picker，不使用 Naive select 作为单元格控件。
- CSV Grid 列宽按列内容与表头计算并固定，不能在滚动过程中变化。
- CSV Grid 的业务编辑、选择和 dirty row 状态必须以 row key 为索引。
- CSV Grid 虚拟滚动中缺失的编辑行索引必须以 `null` 表达，不能用负数索引表示。
- CSV dirty row 必须使用显式 `upsert` / `delete` 模型；删除状态不能伪装成 CSV 单元格字段值。
- 顶部“撤销”“重做”和“保存”只作用于当前表，不得跨表恢复、重做或保存其它 dirty CSV。
- CSV source 选项必须通过后端 `query_csv_source_options` 获取；前端不得从完整项目数据或原版引用全集派生。
- CSV source 选项查询必须校验 source 声明列存在于 CSV header；缺失列不能返回空候选项伪装为合法 source。
- 右侧字段速览可以读取 CSV 列 schema 增强展示，但不得修改单元格、dirty 或保存状态。
- 右侧字段速览必须消费 CSV ViewModel / GridModel 已构建的 source 索引，不能在组件内重建缺少已加载选项的 source index。
- 右侧预览资源查询必须使用当前选中 rowKey，不得把整行传给 service 再读取内部 `_rowKey` 字段。
- 没有业务 ID 的行不能显示 spec 文件编辑入口。
- `tables.store.ts` 只管理草稿、dirty row、选择和编辑状态。
- 写盘、副作用、文件级 history 和关联 spec 创建删除由表格保存 orchestrator 处理。
- 表格保存 orchestrator 只能根据写入结果的 `invalidatedPaths` 触发缓存失效，不能自行猜测路径。
- 打开 Mod 时不得解析或下发完整 CSV 行集；CSV 行只能通过当前 session 的 window query 获取。
- 单元格编辑器在输入期间使用本地缓冲，只在提交时（blur / Enter）写入 store，避免响应式级联导致编辑器卸载。

## 链路：编辑 CSV 单元格

1. 用户在 CSV Grid 中点击单元格激活编辑。
2. Grid cell 根据 CSV 列 schema 选择结构化控件或普通文本编辑。
3. 普通文本编辑在 `CsvGridCellEditor` 内使用本地 ref 缓冲输入值，不触发 store 更新。
4. 用户提交编辑（blur 或 Enter）。
5. `CsvGridCellEditor` 将最终值通过 `update-cell` 事件提交到 `tables.store`。
6. `tables.store.applyCellValue()` 更新行数据和 dirty 状态。
7. `tables.store` 推入 CSV 草稿历史事件。
8. Grid 的虚拟化层只负责裁剪渲染范围，不改变已编辑值或行身份。

## 链路：新增 CSV 行

1. 用户触发新增行。
2. `tables.store.addNewRow()` 根据当前表 header 创建空行。
3. `table-row-key.ts` 分配临时 rowKey。
4. `tables.store` 把新行插入当前表。
5. `tables.store` 标记新行 dirty。
6. `tables.store` 推入 `row-create` 草稿历史事件。

## 链路：删除 CSV 行

1. 用户触发删除当前行。
2. `tables.store.deleteSelected()` 用 selected row key 查找行。
3. `tables.store` 从当前表移除行。
4. 原始表存在该行时写入 delete dirty row。
5. 原始表不存在该行时清除该行 dirty。
6. `tables.store` 推入 `row-delete` 草稿历史事件。
