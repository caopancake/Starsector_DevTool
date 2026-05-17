# Rust 文件 IO、路径校验与目录 changeset

## 定义

Rust 文件 IO 系统负责 UTF-8 无 BOM 读写、文本文件 changeset、目录删除快照、失败回滚和路径安全。

## 边界

- `src-tauri/src/filesystem/text.rs` 负责 UTF-8 无 BOM 文本读写。
- `src-tauri/src/filesystem/json_files.rs` 负责 JSON-like 文件读取和内部字段剥离。
- `src-tauri/src/services/file_changes.rs` 负责 FileChangeRecord 构建、应用、目录快照和回滚。
- `src-tauri/src/models/payloads.rs` 定义 `FileChangeRecord`、`FileChangeKind` 和 `FileSnapshot`。
- `src-tauri/src/commands/files.rs` 暴露文本保存、JSON 保存、多文件保存和 changeset 回放 command。

## 规范

- 所有文本文件按 UTF-8 无 BOM 读取和写入。
- 相对路径必须拒绝绝对路径和 `..`。
- 单文件、多文件和目录删除共用 `FileChangeRecord[]`。
- 目录删除必须使用 `FileChangeKind::Directory`。
- 目录快照中文本文件保存 text，非文本文件保存 base64。
- apply 过程中失败时必须尽量回滚已经应用的 change。
- 前端历史栈移动不由 Rust 执行。

## 链路：应用 changeset

1. 前端调用 `applyFileChangeSet(direction, changes)`。
2. Rust command 调用 `apply_file_change_set()`。
3. Rust 解析 direction。
4. Rust 对每个 change 记录当前状态用于 rollback。
5. Rust 按 direction 选择 before 或 after 状态。
6. 文件 change 写入文本或删除文件。
7. 目录 change 删除或恢复目录快照。
8. 任一 change 失败时 Rust 回滚已应用 change。
9. Rust 返回成功或错误。
