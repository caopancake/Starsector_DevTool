# CSV 草稿历史系统

## 定义

CSV 草稿历史系统负责在前端内存中记录和回放未保存 CSV 表格编辑。

## 参考

- `src/app/composables/use-main-window-shortcuts.ts`：拥有主窗口键盘事件入口，把正式历史 command 交给主窗口历史命令编排。
- `src/domain/workspace/main-window-commands.ts`：拥有 Primary+Z、Primary+Y 和 Primary+Shift+Z 到主窗口历史 command 的纯解析规则。
- `src/domain/tables/csv-table-draft.ts`：拥有 CSV draft operation 回放和 dirty 状态变更规则。
- `src/domain/tables/csv-edit-history.ts`：拥有 CSV 草稿历史 entry 到 CSV Table Draft Session 回放入口的适配。
- `src/orchestrators/main-history-command.orchestrator.ts`：拥有主窗口历史命令分派顺序，先消费当前 CSV 表草稿历史，再进入文件级历史回放。
- `src/orchestrators/settings-persistence.orchestrator.ts`：拥有 historyLimit 设置同步入口，把设置快照中的历史长度同步到 CSV 草稿历史 store。
- `src/orchestrators/table-save.orchestrator.ts`：拥有 CSV 保存后的草稿历史清理边界，只在实际写盘 changeset 产生后清空当前表草稿历史。
- `src/shared/types/tables-edit-history.types.ts`：拥有 CSV 草稿历史 entry 和 draft operation 的结构化类型定义。
- `src/stores/tables-edit-history.store.ts`：拥有按 `modRoot -> tableKey` 隔离的 CSV 草稿 undo/redo 栈、栈移动、长度裁剪和清理入口。
- `src/stores/tables.store.ts`：拥有 CSV 表格状态容器和编辑动作入口，并在 CSV Table Draft Session 返回 operation 后推入草稿历史栈。

## 边界

- CSV 草稿历史的持久化边界是无持久化；进程退出、Mod 移除、加载失败回滚或工作区关闭后不得恢复。
- CSV 草稿历史的读取边界是当前主窗口运行态；独立编辑器窗口、文件编辑器窗口和 Rust 后端不得读取该栈。
- CSV 草稿历史的输入只来自 CSV Table Draft Session 返回的 draft operation；组件、service、Rust command 和文件历史不得直接构造 operation。
- CSV 草稿历史的输出只允许请求 CSV Table Draft Session 回放 operation；不得直接修改 dirty、产生磁盘写入、changeset 或后端失效事件。
- CSV 草稿历史的状态 owner 是 `tables-edit-history.store`；`tables.store` 只能推入、查询和请求回放，不能拥有 undo/redo 栈。
- CSV 草稿历史按 `modRoot -> tableKey` 二级 Map 隔离；不同 Mod、不同表之间不得共享、拼接或回放同一个栈。
- CSV draft operation owner 是 `tables-edit-history.types.ts`；operation 结构只表达单元格前后值、新建行快照、删除行快照、行位置和 rowKey。
- CSV 草稿回放规则 owner 是 `csv-table-draft.ts`；history store 只负责栈顶选择和栈移动，不负责解释 operation 语义。
- CSV 保存边界属于表格保存编排；草稿历史只在保存编排确认当前表实际产生 `result.changes` 后清空当前 `modRoot + tableKey` 栈。
- file history 的 owner 是文件级 history store 和回放编排；CSV 草稿历史只能在主窗口撤销 / 重做分派中排在 file history 之前，不能写入、移动或确认 file history 栈。
- historyLimit 的配置 owner 是 settings；CSV 草稿历史 store 只接收同步后的数值并裁剪已有 undo 栈，不读取设置 store 或工具私有配置文件。
- rowKey 解析 owner 是 table-row-key 规则；CSV 草稿历史回放不得按事件里的行号、id 字段或数组下标自行判定行身份。

## 链路

### 单元格编辑入栈

1. CSV 单元格组件提交编辑值。
2. `tables.store` 结束当前编辑并定位当前 `ModTableState`、当前 `tableKey`、`rowKey` 和列名。
3. CSV Table Draft Session 比较当前值、原始值和新值，更新 `tables` 与 `dirty`。
4. CSV Table Draft Session 在新值不同于当前值时返回 `cell-value-set` operation。
5. `tables.store` 调用 `pushCsvDraftOperation(modRoot, tableKey, operation, label)`。
6. `tables-edit-history.store` 创建 entry，压入当前 `modRoot -> tableKey` 的 undo 栈。
7. `tables-edit-history.store` 清空当前表 redo 栈，并按 historyLimit 裁剪 undo 栈头部。

### 新建行入栈

1. 主窗口动作入口调用 `tables.addNewRow()`。
2. `tables.store` 定位当前 `ModTableState`、当前 `tableKey` 和 header。
3. CSV Table Draft Session 创建新行、生成内部 rowKey、写入当前表 rows、更新行数、选中行和整行 dirty 状态。
4. CSV Table Draft Session 返回 `row-created` operation。
5. `tables.store` 调用 `pushCsvDraftOperation(modRoot, tableKey, operation, label)`。
6. `tables-edit-history.store` 压入当前表 undo 栈，清空 redo 栈并按 historyLimit 裁剪。

### 删除行入栈

1. 主窗口动作入口调用 `tables.deleteSelected()`。
2. `tables.store` 定位当前 `ModTableState`、当前 `tableKey` 和当前选中 rowKey。
3. CSV Table Draft Session 定位当前表行和行位置。
4. CSV Table Draft Session 从当前表 rows 移除该行。
5. CSV Table Draft Session 根据 originalTables 是否存在该 rowKey 写入 deleted dirty row 或删除新建行 dirty，并清空当前选中行。
6. CSV Table Draft Session 返回 `row-deleted` operation。
7. `tables.store` 调用 `pushCsvDraftOperation(modRoot, tableKey, operation, label)`。
8. `tables-edit-history.store` 压入当前表 undo 栈，清空 redo 栈并按 historyLimit 裁剪。

### 主窗口撤销

1. 主窗口全局 keydown 收到 undo history command。
2. `use-main-window-shortcuts.ts` 阻止浏览器默认行为并调用 `dispatchMainUndoCommand(feedback)`。
3. `main-history-command.orchestrator.ts` 读取 active modRoot、当前 tableKey 和当前表状态。
4. `tables-edit-history.store` 检查当前 `modRoot + tableKey` 是否存在可撤销 entry。
5. 存在 CSV 草稿 undo 时，`tables-edit-history.store` 取 undo 栈顶 entry。
6. `csv-edit-history.ts` 请求 CSV Table Draft Session 按 operation 和 undo 方向回放到当前 `ModTableState`。
7. 回放成功后 `tables-edit-history.store` 从 undo 栈弹出 entry，并压入 redo 栈。
8. 回放失败时 `main-history-command.orchestrator.ts` 只发出 CSV 撤销失败反馈。
9. 不存在 CSV 草稿 undo 时，`main-history-command.orchestrator.ts` 调用文件级 undo 回放入口。

### 主窗口重做

1. 主窗口全局 keydown 收到 redo history command。
2. `use-main-window-shortcuts.ts` 阻止浏览器默认行为并调用 `dispatchMainRedoCommand(feedback)`。
3. `main-history-command.orchestrator.ts` 读取 active modRoot、当前 tableKey 和当前表状态。
4. `tables-edit-history.store` 检查当前 `modRoot + tableKey` 是否存在可重做 entry。
5. 存在 CSV 草稿 redo 时，`tables-edit-history.store` 取 redo 栈顶 entry。
6. `csv-edit-history.ts` 请求 CSV Table Draft Session 按 operation 和 redo 方向回放到当前 `ModTableState`。
7. 回放成功后 `tables-edit-history.store` 从 redo 栈弹出 entry，并压入 undo 栈。
8. 回放失败时 `main-history-command.orchestrator.ts` 只发出 CSV 重做失败反馈。
9. 不存在 CSV 草稿 redo 时，`main-history-command.orchestrator.ts` 调用文件级 redo 回放入口。

### 保存后清理

1. `table-save.orchestrator.ts` 捕获当前 active manifest、modRoot、tableKey、table state 和关联 spec 动作候选。
2. 保存确认后，保存编排构造当前表 dirty patches。
3. 保存编排调用 CSV table service 写入当前 CSV patch 和被选择的关联 spec 动作。
4. 后端返回写入结果后，保存编排确认当前保存目标仍然匹配。
5. `result.changes.length > 0` 时，保存编排先请求 File History Session 记录文件级 save history 并刷新 ProjectSession。
6. File History Session 完整成功后，`tables.store` 应用后端返回的 rowKey 映射。
7. `tables.store` 请求 CSV Table Draft Session 把当前表 rows 提升为 originalTables，并清空当前表 dirty。
8. `tables-edit-history.store` 清空当前 `modRoot + tableKey` 草稿历史。

### 设置同步与长度裁剪

1. 主窗口启动 settings persistence。
2. settings persistence 读取当前 settings snapshot。
3. settings persistence 把 `historyLimit` 传给 CSV 草稿历史 store。
4. `tables-edit-history.store` 更新内存中的 historyLimit。
5. `tables-edit-history.store` 遍历所有 `modRoot -> tableKey` 状态并裁剪 undo 栈头部。

### Mod 状态清理

1. Mod 加载失败回滚、Mod 移除或工作区关闭进入工作区动作编排。
2. 工作区动作编排移除 workspace、tables、editors、file history 和 project 中对应 Mod 状态。
3. 工作区动作编排调用 `tables-edit-history.store.clearForMod(modRoot)`。
4. `tables-edit-history.store` 删除该 modRoot 下全部表的 CSV 草稿历史状态。

## 规范

- CSV draft operation 的 `tab` 必须和入栈时的 tableKey 一致；回放不得把 operation 应用到其它表。
- CSV 草稿 history entry 必须包含唯一 id、timestamp、operation 和 label；id 只用于前端栈身份，不得作为行身份或文件身份。
- CSV 草稿 historyLimit 只裁剪 undo 栈；新动作入栈必须清空 redo 栈。
- CSV 草稿入栈必须发生在 CSV Table Draft Session 已更新当前草稿和 dirty 状态之后。
- CSV 草稿历史不得包含 `FileChangeRecord`、`WriteResult`、changeset、session invalidation 或确认弹窗状态。
- CSV 草稿历史栈移动必须以后放回放成功为前提；`applyCsvEditUndo()` 或 `applyCsvEditRedo()` 返回 false 时不得 pop、push 或清空任何栈。
- CSV 草稿回放单元格值时必须同时维护当前 row 值和 dirty cells；新值等于 originalTables 中原始值时必须移除对应 dirty cell。
- CSV 草稿回放删除原始行时必须写入 deleted dirty row；删除未保存新建行时必须移除该行的 dirty 状态。
- CSV 草稿回放插入行时必须深拷贝 operation 中的 row，并把正式 rowKey 写入内部 rowKey 字段。
- CSV 草稿回放生成整行 dirty 时必须跳过共享内部字段规则认定的内部字段。
- CSV 草稿回放定位行必须使用正式 rowKey 解析规则，并忽略未加载的 placeholder row。
- CSV 草稿历史按 active modRoot 工作；没有 modRoot 时不得创建或移动草稿历史。
- CSV 保存成功后的 rowKey 映射必须在 File History Session 完整成功后应用到 `tables`、`originalTables` 和 selectedRowKey，再标记表已保存和清空草稿历史。
- CSV 保存没有实际 changes 时不得清空 CSV 草稿历史、不得记录文件级 history、不得触发保存后的历史污染。
- 主窗口撤销 / 重做必须优先消费当前表 CSV 草稿历史；只有当前表没有对应草稿 entry 时才能进入文件级 history。

## 陷阱

- 把 CSV 草稿历史写入 settings、workspace persistence、Mod 文件或后端缓存，会把未保存内存态误变成持久化协议。
- 把 CSV 草稿 history 和 file history 合并成同一个栈，会让未写盘编辑和已写盘 changeset 的确认、回放和失败语义错位。
- 按字符串拼接 `modRoot + tableKey` 作为 key，会在路径包含分隔符或表名变化时破坏 Mod / 表隔离。
- 在回放失败后移动 undo/redo 栈，会造成界面状态、dirty 状态和历史栈状态永久不一致。
- 在保存 noop 时清空草稿历史，会丢失仍然未写入磁盘的用户编辑回放能力。
- 绕过 table-row-key 规则用数组下标回放行事件，会在窗口分页、筛选、空行或保存后 rowKey 映射场景中改错行。
- 在草稿回放中直接调用 service、shared api、Rust command 或 query invalidation，会把内存级撤销误升级为磁盘级写入链路。
- 在输入框、textarea、select 或 contenteditable 内拦截 Primary+Z，会抢走原生文本编辑撤销能力并污染 CSV 表级历史。
- 在独立编辑器窗口消费主窗口 CSV 草稿历史，会跨窗口改写主窗口表格运行态并破坏保存边界。
