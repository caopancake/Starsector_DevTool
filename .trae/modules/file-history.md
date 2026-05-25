# 文件级 history / changeset 系统

## 定义

文件级 history 记录已经写入磁盘的保存事件。每条保存事件是一个 `FileChangeRecord[]` changeset，可以包含文本文件、二进制文件、多文件或目录删除。

## 边界

- `src/stores/file-history.store.ts` 持有每个 Mod 的文件级 undo/redo 栈。
- `src/shared/types/file-history.types.ts` 定义 file-save entry。
- `src/orchestrators/file-save.orchestrator.ts` 是前端记录文件保存事件的统一入口。
- `src/orchestrators/file-history-replay.orchestrator.ts` 负责确认、调用 Rust 回放、刷新前端缓存、广播窗口事件和提交栈移动。
- `src/app/components/config/ConfigFileHistoryView.vue` 展示当前 Mod 文件历史并提供清空、撤销和重做。
- `src-tauri/src/io/file_changes.rs` 是 changeset 构建、写盘、目录快照、回滚和回放权威。
- `src-tauri/src/services/file_changes.rs` 只保留 command-facing service 入口。
- 前端业务写入统一使用 `WriteResult`；`FileChangeRecord[]` 只在 file history entry 和 replay 内部流转。
- `WriteResult` 的 `changes`、`invalidatedPaths`、`keyMap`、`refreshedEntity` 和 `warnings` 字段必须作为统一写入结果的显式字段返回，前端不得用缺省字段兼容不同写入入口。
- `FileChangeRecord` 和 `FileSnapshot` 中由 Rust 序列化的可空内容字段必须在前端共享类型中保持显式 null，不得建模为可缺省字段。
- File history replay command 接收的 `FileChangeRecord` 和 `FileSnapshot` 必须显式提交所有可空内容字段和文件集合字段，不能依赖 Rust 默认值补齐 changeset 语义。
- history 栈长度由 settings persistence 编排层同步给 history store，history store 不直接读取 settings store。

## 规范

- 文件级 history 只记录已经成功写盘的 changeset。
- 保存、上传、spec 写入和配置写入完成后，缓存失效必须由 `WriteResult.invalidatedPaths` 驱动。
- 文件级 history 按 `modRoot` 隔离。
- 前端判断文件路径归属已加载 Mod 时必须使用共享路径工具，不能在保存记录和回放刷新链路中各自拼接前缀规则。
- undo/redo 必须先 peek entry，再弹窗确认，再调用 Rust 回放。
- file history replay direction 必须使用正式撤销/重做方向模型，不得用裸字符串在 service 层解析。
- Rust 回放成功后前端才能 commit 栈移动。
- schema 配置 entity 的单文件保存回放后，前端必须同步对应 project cache；当前包括装配和舰船皮肤。
- Rust 回放失败时前端不能移动 undo/redo 栈。
- 单文件 changeset 可以用 `beforeText/afterText` 表达 UTF-8 无 BOM 文本，也可以用 `beforeDataBase64/afterDataBase64` 表达二进制内容。
- 贴图上传和覆盖必须作为普通文件 changeset 进入文件级 history。

## 链路：记录文件保存

1. 保存 orchestrator 或窗口事件处理器获得 Rust 返回的 `WriteResult`。
2. 调用 `recordFileSave(modRoot, result, label)`。
3. `file-save.orchestrator.ts` 调用 file history store。
4. file history store 把 entry 压入当前 Mod undo stack。
5. file history store 清空当前 Mod redo stack。
6. file history store 根据设置限制裁剪历史长度。

## 链路：文件级撤销

1. 用户在主窗口快捷键或 ConfigFileHistoryView 中触发撤销。
2. `file-history-replay.orchestrator.ts` peek 当前可撤销 entry。
3. 前端显示确认弹窗。
4. 用户确认。
5. `file-history-replay.orchestrator.ts` 调用 `replayFileChangeSet('undo', changes)`。
6. Rust `apply_file_change_set` 写回 before 状态并返回 `WriteResult`。
7. 前端刷新受影响的文本文件编辑器、编辑器窗口、project cache 和 tables cache；二进制文件只写回磁盘。
8. file history store commit undo。
9. 前端显示成功消息。

## 链路：文件级重做

1. 用户在主窗口快捷键或 ConfigFileHistoryView 中触发重做。
2. `file-history-replay.orchestrator.ts` peek 当前可重做 entry。
3. 前端显示确认弹窗。
4. 用户确认。
5. `file-history-replay.orchestrator.ts` 调用 `replayFileChangeSet('redo', changes)`。
6. Rust `apply_file_change_set` 写回 after 状态并返回 `WriteResult`。
7. 前端刷新受影响的文本文件编辑器、编辑器窗口、project cache 和 tables cache；二进制文件只写回磁盘。
8. file history store commit redo。
9. 前端显示成功消息。
