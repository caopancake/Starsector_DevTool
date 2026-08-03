# 表格草稿历史

## 定义

记录未写盘 CSV draft operation 的、按 Mod/表隔离的内存 undo/redo。

## Owner 与链路

- `tables.store` 在 Draft Session 成功修改后 push operation；history store 按 `modRoot -> tableKey` 管理栈和 historyLimit。
- 主窗口命令先尝试当前表 CSV history；无 entry 才进入文件级 history。回放委托 Draft Session，成功后才移动栈。
- 保存有 changes 且 File History Session 成功后才应用 rowKey 映射、提升 original、清 dirty/history；移除 Mod 时清该 Mod 栈。

## 不变量

- 只存内存 operation，不存 changeset/WriteResult/确认状态；row 定位只用正式 rowKey 规则。
- 新动作清 redo、limit 只裁 undo；回放失败不动任一栈。noop 保存不清草稿历史。
- 新建、删除及其 undo/redo 都经同一行变更边界维护虚拟表的 total/filtered 行数；回放移除当前选中或正在编辑行时同时清理失效的行身份。
