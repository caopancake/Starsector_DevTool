# CSV 草稿历史系统

## 定义

CSV 草稿历史记录未保存的表格内编辑，包括单元格修改、新建行和删除行。它只回放内存状态，不写磁盘。

## 边界

- `src/stores/tables-edit-history.store.ts` 持有按 `modRoot + tableKey` 隔离的 undo/redo 栈。
- `src/shared/types/tables-edit-history.types.ts` 定义草稿历史事件。
- `src/domain/tables/csv-edit-history.ts` 执行草稿 undo/redo。
- `src/orchestrators/main-undo-redo.orchestrator.ts` 优先调用 CSV 草稿历史，再调用文件级 history。
- history 栈长度由 settings persistence 编排层同步给草稿 history store，草稿 history store 不直接读取 settings store。

## 规范

- CSV 草稿历史不能包含文件 changeset。
- CSV 草稿历史按结构化 `modRoot -> tableKey` 隔离，不能用分隔符拼接字符串 key。
- 保存当前 CSV 成功后必须清空当前 `modRoot + tableKey` 的 CSV 草稿历史。
- 草稿 undo/redo 失败时不能移动草稿历史栈。
- 草稿 history 的 `_rowKey` 必须通过 `table-row-key.ts` 解析。
- 草稿回放生成 dirty 字段时必须使用共享内部字段规则，不能自行判断内部字段前缀。
- 草稿回放生成 dirty row 时必须使用正式 dirty row 模型，不能把删除状态写成单元格字段。

## 链路：CSV 草稿撤销

1. 主窗口收到 Ctrl+Z。
2. `main-undo-redo.orchestrator.ts` 获取当前 Mod、当前表和 table state。
3. CSV 草稿 history store 检查当前表能否撤销。
4. `csv-edit-history.ts` 回放草稿事件。
5. 回放成功后草稿 history store 移动 undo/redo 栈。

## 链路：CSV 草稿重做

1. 主窗口收到 Ctrl+Shift+Z。
2. `main-undo-redo.orchestrator.ts` 获取当前 Mod、当前表和 table state。
3. CSV 草稿 history store 检查当前表能否重做。
4. `csv-edit-history.ts` 回放草稿事件。
5. 回放成功后草稿 history store 移动 undo/redo 栈。
