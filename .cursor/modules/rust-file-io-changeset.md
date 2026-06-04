# Rust 文件 IO、路径校验与目录 changeset

## 定义

Rust 文件 IO 系统负责 UTF-8 无 BOM 读写、文本文件 changeset、目录删除快照、失败回滚和路径安全。

## 边界

- `src-tauri/src/io/text.rs` 负责 UTF-8 无 BOM 文本读写。
- `src-tauri/src/io/json_files.rs` 负责 JSON-like 文件读取和内部字段剥离。
- `src-tauri/src/io/paths.rs` 负责跨 IO/service 复用的绝对路径、parent-dir 和规范化路径身份工具。
- `src-tauri/src/io/file_changes.rs` 负责 FileChangeRecord 构建、应用、目录快照、失败回滚和 changeset 失效路径生成。
- `src-tauri/src/services/file_changes.rs` 负责文件保存、文件读取和 changeset 回放的 command-facing service 入口。
- `src-tauri/src/models/write.rs` 定义 `FileChangeRecord`、`FileChangeKind` 和 `FileSnapshot`。
- `src-tauri/src/commands/files.rs` 暴露文本保存、JSON 保存、多文件保存和 changeset 回放 command。

## 规范

- 所有文本文件按 UTF-8 无 BOM 读取和写入。
- 文本文件读取必须接收 `sessionId + modRoot`，并在读盘前校验两者仍匹配同一 ProjectSession，再校验目标 path 是归属该 `modRoot` 的绝对路径。
- 文本文件保存必须接收 `sessionId + modRoot`，并在写盘前校验两者仍匹配同一 ProjectSession，再校验目标 path 是归属该 `modRoot` 的绝对路径。
- Rust 路径归属、parent-dir 判断和缓存身份规范化必须复用 IO 层路径工具，不能在各 service 内维护分叉规则。
- 相对路径必须由统一 IO 路径工具校验，只允许非空普通相对组件，拒绝绝对路径、盘符 prefix、`.` 和 `..`。
- 单文件、多文件和目录删除共用 `FileChangeRecord[]`。
- `WriteResult.invalidatedPaths` 必须由 changeset 统一规则生成；目录 change 必须同时包含目录路径和目录快照内的具体文件路径。
- changeset 回放必须接收 `sessionId + modRoot`，并在写盘前校验两者仍匹配同一 ProjectSession，再校验每个 `FileChangeRecord.path` 是归属该 `modRoot` 的绝对路径。
- changeset 回放必须在任何写盘或删除前校验目录快照内每个 `FileSnapshot.relPath` 是目录内相对文件路径。
- 目录删除必须使用 `FileChangeKind::Directory`。
- 目录快照中文本文件保存 text，非文本文件保存 base64。
- apply 过程中失败时必须尽量回滚已经应用的 change。
- apply 失败时必须把错误返回给前端。
- 前端历史栈移动不由 Rust 执行。

## 链路：应用 changeset

1. 前端 history replay service 调用 `replayFileChangeSet(sessionId, modRoot, direction, changes)`。
2. Rust command 校验 `sessionId + modRoot` 仍匹配同一 ProjectSession。
3. Rust command 调用 `apply_file_change_set()`。
4. Rust 校验每个 change path 归属 `modRoot`。
5. Rust 解析 direction。
6. Rust 对每个 change 记录当前状态用于 rollback。
7. Rust 按 direction 选择 before 或 after 状态。
8. 文件 change 写入文本或删除文件。
9. 目录 change 删除或恢复目录快照。
10. 任一 change 失败时 Rust 回滚已应用 change。
11. Rust 返回 `WriteResult` 或错误。
