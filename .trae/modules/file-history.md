# 文件级 history / changeset 系统

## 定义

文件级 history 记录已经写入磁盘的保存事件。每条保存事件是一个 `FileChangeRecord[]` changeset，可以包含文本文件、二进制文件、多文件或目录删除。

## 边界

- `src/features/file-history/file-history-store.ts` 持有每个 Mod 的文件级 undo/redo 栈和屏障。
- `src/features/file-history/file-history-types.ts` 定义 file-save entry 和 barrier。
- `src/features/file-history/file-save-orchestrator.ts` 是前端记录文件保存事件的统一入口。
- `src/features/file-history/file-history-replay-service.ts` 负责确认、调用 Rust 回放、刷新前端缓存、广播窗口事件和提交栈移动。
- `src/features/config/components/FileHistoryView.vue` 展示当前 Mod 文件历史并提供清空、撤销和重做。
- `src-tauri/src/services/file_changes.rs` 是 changeset 构建、写盘、目录快照、回滚和回放权威。

## 规范

- 文件级 history 只记录已经成功写盘的 changeset。
- 文件级 history 按 `modRoot` 隔离。
- undo/redo 必须先 peek entry，再弹窗确认，再调用 Rust 回放。
- Rust 回放成功后前端才能 commit 栈移动。
- Rust 回放失败时前端不能移动 undo/redo 栈。
- barrier 只用于真正不能表达为 changeset 的不可逆操作，不得用于 Mod 内普通文件保存。
- 单文件 changeset 可以用 `beforeText/afterText` 表达 UTF-8 无 BOM 文本，也可以用 `beforeDataBase64/afterDataBase64` 表达二进制内容。
- 贴图上传和覆盖必须作为普通文件 changeset 进入文件级 history。

## 链路：记录文件保存

1. 保存 orchestrator 或窗口事件处理器获得 Rust 返回的 `FileChangeRecord[]`。
2. 调用 `recordFileSave(modRoot, changes, label)`。
3. `file-save-orchestrator.ts` 调用 file history store。
4. file history store 把 entry 压入当前 Mod undo stack。
5. file history store 清空当前 Mod redo stack。
6. file history store 根据设置限制裁剪历史长度。

## 链路：文件级撤销

1. 用户在主窗口快捷键或 FileHistoryView 中触发撤销。
2. `file-history-replay-service.ts` peek 当前可撤销 entry。
3. 前端显示确认弹窗。
4. 用户确认。
5. `file-history-replay-service.ts` 调用 `applyFileChangeSet('undo', changes)`。
6. Rust `apply_file_change_set` 写回 before 状态。
7. 前端刷新受影响的文本文件编辑器、编辑器窗口、project cache 和 tables cache；二进制文件只写回磁盘。
8. file history store commit undo。
9. 前端显示成功消息。

## 链路：文件级重做

1. 用户在主窗口快捷键或 FileHistoryView 中触发重做。
2. `file-history-replay-service.ts` peek 当前可重做 entry。
3. 前端显示确认弹窗。
4. 用户确认。
5. `file-history-replay-service.ts` 调用 `applyFileChangeSet('redo', changes)`。
6. Rust `apply_file_change_set` 写回 after 状态。
7. 前端刷新受影响的文本文件编辑器、编辑器窗口、project cache 和 tables cache；二进制文件只写回磁盘。
8. file history store commit redo。
9. 前端显示成功消息。
