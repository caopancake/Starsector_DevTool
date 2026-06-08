# CSV 表格系统

## 定义

CSV 表格系统按 session window query 展示和编辑已注册 Starsector CSV 表，并把未保存修改作为按 Mod 隔离的草稿状态。

## 参考

- `schemas/csv/*.columns.json`：拥有 CSV 列 schema 资产，定义列 label、控件、source、枚举和多值语义。
- `src/app/DataTable.vue`：拥有 CSV 表格页面薄壳，只承载 Grid 和空状态。
- `src/app/DetailPane.vue`：消费当前表、当前行、schema 和 source index，拥有右侧字段速览与详情动作入口。
- `src/app/components/tables/`：拥有 CSV Grid、虚拟 body、行、单元格、编辑器和 picker 的渲染层。
- `src/app/composables/use-csv-table-view-model.ts`：拥有 CSV window query、source option query、本地派生索引、列宽和 query cache 失效响应。
- `src/domain/tables/associated-specs.ts`：拥有公开 CSV 表到关联 spec 路径、默认创建文本和编辑器窗口 kind 的映射。
- `src/domain/tables/csv-column-schema.ts`：拥有 CSV 列 schema 加载、控件判定、多值拆分和布尔显示规则。
- `src/domain/tables/csv-grid-model.ts`：拥有 Grid 列、行 slot、source index 和列宽模型。
- `src/domain/tables/csv-source-options.ts`：拥有 CSV source 解析、source option 索引和值集合。
- `src/domain/tables/table-detail-actions.ts`：拥有右侧详情动作的结构化模型和动作 key。
- `src/domain/tables/table-row-key.ts`：拥有 CSV 行身份字段、临时 rowKey 和 rowKey 解析规则。
- `src/orchestrators/table-save.orchestrator.ts`：拥有保存目标捕获、patch 构造、关联文件确认后写入、rowKey 映射和 history/cache 触发。
- `src/services/csv-table.service.ts`：拥有 CSV table window、source options、row preview 和 table patch 保存 service 入口。
- `src/stores/tables.store.ts`：拥有按 modRoot 隔离的 CSV 表格草稿、dirty、选择、编辑、窗口 rows 和当前表状态。
- `src-tauri/src/services/project/query/csv_window.rs`：拥有 Rust CSV window query、row preview、搜索和势力筛选。
- `src-tauri/src/services/project/write/csv_patch.rs`：拥有 Rust CSV patch 应用、关联文件 changeset 和 rowKey 映射。

## 边界

- CSV column schema 归 schema 资产和 domain 加载器拥有，组件不得内联字段 schema。
- CSV source option 归 Rust query 与前端 source index 共同拥有，前端不得从完整项目数据派生候选项。
- DetailPane 只消费 ViewModel 和 GridModel 派生数据，不修改 dirty、rows 或保存状态。
- Grid 渲染层只承载展示、虚拟化和编辑控件，不拥有写盘、history 或关联文件语义。
- ModTableState 归 tables store 拥有，必须按 modRoot 隔离。
- RowData 中的 rowKey 是运行态身份，不写入磁盘。
- TableKey 归共享类型和 Rust CsvTableKey 拥有，前端 store 不得维护独立表注册表。
- ViewModel 拥有本地 window key、source option index 和列宽派生状态，底层 query cache 失效后必须重建。
- WriteResult 归保存 service 返回，表格保存编排只能按 WriteResult 驱动 history 和 cache 失效。
- 关联 spec 映射归 associated spec domain 拥有，组件和保存编排只能消费映射结果。
- 势力筛选归正式 CsvFactionFilter 模型拥有，不用裸字符串表达无筛选。
- 右侧详情动作归 detail action domain 拥有，动作 payload 必须携带 modRoot、sessionId 和业务目标。
- 保存目标归 table save orchestrator 捕获，确认回调不得重新读取当前活动表决定写盘目标。
- 后端 CSV rows 归 Rust session lazy cache 拥有，前端只能通过 window query 加载可见窗口。

## 链路

### CSV window 加载

1. 当前 session、当前表、搜索文本或势力筛选变化。
2. CSV ViewModel 增加 window request id。
3. CSV ViewModel 清空本地 window key 和 source option index。
4. CSV ViewModel 重置当前表窗口 rows、dirty 和选择状态。
5. CSV ViewModel 构造结构化 window key。
6. CSV ViewModel 调用 CSV table service。
7. CSV table service 调用 query service。
8. query service 通过 query cache 调用 shared API。
9. shared API 调用 Rust CSV table window command。
10. Rust query 确保 session 中对应注册表 rows 已加载。
11. Rust query 按搜索和势力筛选过滤 rows。
12. Rust query 返回 header、totalRows、filteredRows、start 和 window rows。
13. CSV ViewModel 校验 request id、session、表、搜索和筛选仍匹配当前目标。
14. tables store 把 window rows 合并进对应表的 slot 数组和 original rows。

### 单元格编辑

1. 用户激活 Grid 单元格。
2. Grid 根据 CSV column schema 选择普通输入、picker 或结构化控件。
3. 单元格编辑器在本地缓冲输入值。
4. 用户 blur 或 Enter 提交最终值。
5. Grid 发出 update-cell 事件。
6. tables store 按当前表和 rowKey 查找已加载真实行。
7. tables store 写入单元格值。
8. tables store 对比 original row 生成或清理 dirty cells。
9. tables store 清除 editing 状态。
10. tables store 推入 CSV 草稿历史事件。

### source option 加载

1. CSV ViewModel 从当前可见列读取 schema source。
2. CSV ViewModel 对可见 source 去重。
3. CSV ViewModel 调用 CSV table service 查询 source options。
4. CSV table service 调用 session source option query。
5. CSV table service 收集 option 中的 ResourceRef。
6. CSV table service 调用 resource cache 查询缩略图 data URL。
7. CSV table service 把 source option 和 sprite 合并为 hydrated options。
8. CSV ViewModel 校验 request id、session 和 table 仍匹配。
9. CSV ViewModel 写入 loaded source options。
10. GridModel 用 loaded options 建立 source index。

### 新增和删除行

1. 用户触发新增或删除行。
2. tables store 读取当前 ModTableState 和当前表。
3. 新增行时 tables store 按当前表 header 创建空行。
4. 新增行时 tables store 分配 `${table}:new:*` 临时 rowKey。
5. 新增行时 tables store 标记整行 dirty 并选中新行。
6. 删除行时 tables store 按 selectedRowKey 查找已加载真实行。
7. 删除行时 tables store 从当前表 rows 中移除该行。
8. 删除原始已存在行时 tables store 写入 delete dirty row。
9. 删除未保存新增行时 tables store 清除该 rowKey 的 dirty。
10. tables store 推入 row-create 或 row-delete 草稿历史事件。

### 保存当前表

1. 用户触发保存。
2. workspace shell 调用 capture active table save target。
3. table save orchestrator 结束当前单元格编辑。
4. table save orchestrator 捕获 manifest、modRoot、ModTableState、table 和关联文件候选。
5. 需要关联文件确认时 workspace shell 打开确认对话。
6. 用户确认后调用 save captured table changes。
7. table save orchestrator 校验捕获 state 和 session 仍是当前目标。
8. table save orchestrator 过滤当前表关联文件。
9. table save orchestrator 从 dirty 构造 CsvRowPatch。
10. CSV table service 调用写入 service 保存 CSV patch。
11. Rust write 先确保 session rows 已加载。
12. Rust write 应用 upsert/delete patch 并校验 rowKey。
13. Rust write 渲染 CSV 文本并构造关联文件 changeset。
14. Rust write 应用 changeset 并返回 WriteResult 和 rowKey keyMap。
15. table save orchestrator 应用 rowKey 映射。
16. tables store 标记捕获表已保存并清理 dirty。
17. 保存编排记录文件级 history。
18. 保存编排按 WriteResult.invalidatedPaths 刷新 ProjectSession 和前端 cache。

### query cache 失效响应

1. ProjectSession invalidation 清理 query cache。
2. query cache 发布失效事件。
3. CSV ViewModel 校验事件 sessionId 是否匹配当前 active session。
4. 当前表 csv-table-window 失效时 CSV ViewModel 重载当前 table window。
5. 可见 csv-source-options 失效时 CSV ViewModel 重载 source options。
6. loaded source option 持有的 resource-data-urls 失效时 CSV ViewModel 重载 source options。
7. 当前 session 消失时 CSV ViewModel 清空 window key、source option index 和列宽派生状态。

## 规范

- CSV Grid 只能给已加载真实行分配 rowKey，占位 slot 不得进入选择、编辑、dirty、详情或保存链路。
- CSV column schema label 只影响 UI 显示，不影响数据读写、patch、dirty、搜索或后端链路。
- CSV dirty row 必须使用显式 upsert/delete 模型。
- CSV query 的可空过滤字段必须显式提交 null。
- CSV source option 查询必须校验 source 声明列存在于 CSV header。
- CSV source 选项只有 id 列可以携带实体资源引用。
- CSV window 本地 key 必须保留 session、table、search、faction、start 和 count 的结构化边界。
- RowKey 是 session 内 CSV 行身份，不写入磁盘。
- 保存时 upsert 只能引用已存在 rowKey 或当前表正式临时新增 rowKey。
- 顶部撤销、重做和保存只作用于当前表。
- 右侧详情动作必须携带发起时的 modRoot、sessionId、starsectorRoot、编辑器 kind 和业务 id。
- 右侧详情不得为注释行或缺少业务 ID 的行提供 spec 文件或专用编辑器入口。
- 表格状态必须按 modRoot 隔离。
- 表格列宽持久化必须使用 modRoot、table、column 的结构化层级。
- 表格保存必须捕获发起时的 manifest、modRoot、state 和 table。
- 打开 Mod 时不得下发完整 CSV 行集。
- 空行、全逗号空行和注释行必须作为 CSV 内容保留。
- 注释行不得作为引用、source、关联文件或编辑器入口的合法目标。
- 势力筛选内部字段只允许作用于支持筛选的真实数据行。
- 单元格编辑器只在提交时写入 store。

## 陷阱

- 把占位 slot 当成真实行，会产生不可保存 rowKey 和错误 dirty 状态。
- 把 rowKey 当业务 ID，会把运行态身份写入 spec 路径或编辑器窗口目标。
- 在确认保存回调中重新读取当前表，会把用户确认的保存目标切到其它 Mod 或其它表。
- 组件内维护表到 spec 的分支，会和关联 spec 注册表产生保存与详情动作分裂。
- source option index 在底层 query 失效后继续复用，会显示旧候选项和旧资源缩略图。
- 用 CSV 总行数作为实体数量，会把空行和注释行计入导航计数。
- 跳过 Rust window query 直接读取完整 CSV，会破坏 session cache、筛选和 query cache 边界。
- 注释行显示编辑器入口，会把注释文本误判为业务实体。
