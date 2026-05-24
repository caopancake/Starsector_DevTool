# 表格保存与关联文件 changeset 系统

## 定义

表格保存系统负责把 dirty CSV 写入磁盘，并在用户选择时把关联 spec 文件创建或删除纳入同一个 changeset。一次保存动作只产生一条文件级 history。

## 边界

- `src/orchestrators/table-save.orchestrator.ts` 是前端表格保存编排入口。
- `src/domain/tables/associated-file-candidates.ts` 推导 ships、weapons、shipSystems、skills 的关联文件创建和删除候选。
- `src/services/table.service.ts` 调用后端 CSV patch 保存 command。
- `src/shared/api/tables-api.ts` 封装 `save_csv_patch_with_history`。
- `src-tauri/src/services/project/mod.rs` 基于 session baseline 合成 CSV、构建 CSV 文件 changeset 和关联文件 changeset。
- `src-tauri/src/commands/tables.rs` 只暴露 CSV patch 保存 command。

## 规范

- 表格保存必须先结束当前单元格编辑。
- CSV 保存只写当前 session 的当前表对应 CSV。
- 前端只提交 rowKey patch，不提交整表 rows。
- 关联 spec 创建或删除只有进入 associated files payload 时才写盘。
- 关联 spec 创建或删除必须通过确认弹窗显式勾选后才进入 associated files payload。
- CSV 和关联文件必须在同一个 Rust changeset 中写盘。
- 保存成功后才能更新 original tables、清空 dirty、清空 CSV 草稿 history 和记录文件级 history。
- 后端必须拒绝绝对路径和 `..` 关联文件路径。

## 链路：保存当前表

1. 用户触发保存当前表。
2. `table-save.orchestrator.ts` 结束当前单元格编辑。
3. orchestrator 检查当前表 dirty，并只收集当前表的关联文件候选。
4. 需要创建或删除当前表关联 spec 文件时，前端弹出确认并要求用户勾选对应文件操作。
5. orchestrator 传入用户确认的 associated files。
6. `table.service.ts` 调用 `saveCsvPatchWithHistory()`。
7. Rust project service 用 session baseline 和 rowKey patch 合成 CSV 文本。
8. Rust project service 构建 CSV 文件 change。
9. Rust project service 构建关联文件 changes。
10. Rust `apply_file_change_set` 以 redo 写盘。
11. Rust 返回 changes 和新建行 key 映射。
12. orchestrator 标记当前表 saved。
13. orchestrator 清空当前表 CSV 草稿历史。
14. orchestrator 记录一条文件级 history。
