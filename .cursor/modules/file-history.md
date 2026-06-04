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
- File history replay command 必须显式提交 `sessionId`、`modRoot`、`FileChangeRecord` 和 `FileSnapshot`；Rust 回放前必须先校验 `sessionId + modRoot` 仍匹配同一 ProjectSession，再重新校验每个 change path 归属该 `modRoot`，并且所有可空内容字段和文件集合字段都必须显式提交，不能依赖 Rust 默认值补齐 changeset 语义。
- history 栈长度由 settings persistence 编排层同步给 history store，history store 不直接读取 settings store。

## 规范

- 文件级 history 只记录已经成功写盘的 changeset。
- 写盘结果记录 history 时，如果调用方提供发起时捕获的 session，必须确认当前 `modRoot` 仍对应同一 session；目标已移除或重载时不得重新创建 history 状态或写入旧 session 的保存记录。
- 保存、上传、spec 写入和配置写入完成后，缓存失效必须由 `WriteResult.invalidatedPaths` 驱动。
- 文件级 history 按 `modRoot` 隔离。
- 文件级 history 视图中的 changeset 行身份必须保留 history entry、change kind 和 path 的结构边界，不能用分隔符拼接。
- 文件级 history 的 peek、commit 和回放必须使用显式 `sessionId + modRoot`，不得在确认回调或异步回放过程中重新读取当前 active Mod 作为归属。
- 文件级 history 回放时，相对 `invalidatedPaths` 只归属当前 history 栈的 `modRoot`；绝对 `invalidatedPaths` 按已加载 Mod root 归属判定。
- 文件级 history 回放不得自行刷新 ProjectSession、resource cache 或 query cache，必须通过 ProjectSession 失效编排入口完成。
- 前端判断文件路径归属已加载 Mod 时必须使用共享路径工具，不能在保存记录和回放刷新链路中各自拼接前缀规则。
- undo/redo 必须先 peek entry，再弹窗确认，再调用 Rust 回放。
- 文件级 history 确认后写盘前必须重新确认当前栈顶仍是被确认的 entry，并确认 `modRoot` 仍对应确认时捕获的 session；栈或 session 已变化时不得写盘。
- file history replay direction 必须使用正式撤销/重做方向模型，不得用裸字符串在 service 层解析。
- Rust 回放成功后前端才能 commit 栈移动；commit 只能移动当前栈顶 entry，不能为了寻找旧 entry 弹出多条历史。
- 文件级 history 回放通知已打开文件编辑器时必须携带 `modRoot` 和 path，文件编辑器只能在两者同时匹配时应用文本快照。
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
5. `file-history-replay.orchestrator.ts` 校验当前 undo 栈顶仍是已确认 entry。
6. `file-history-replay.orchestrator.ts` 调用 `replayFileChangeSet(sessionId, modRoot, 'undo', changes)`。
7. Rust command 校验 `sessionId + modRoot` 后，`apply_file_change_set` 校验 changeset 路径归属当前 `modRoot`，写回 before 状态并返回 `WriteResult`。
8. 前端刷新受影响的文本文件编辑器，并通过 ProjectSession 失效编排入口刷新 project cache、resource cache、query cache 和编辑器窗口；二进制文件只写回磁盘。
9. file history store commit undo。
10. 前端显示成功消息。

## 链路：文件级重做

1. 用户在主窗口快捷键或 ConfigFileHistoryView 中触发重做。
2. `file-history-replay.orchestrator.ts` peek 当前可重做 entry。
3. 前端显示确认弹窗。
4. 用户确认。
5. `file-history-replay.orchestrator.ts` 校验当前 redo 栈顶仍是已确认 entry。
6. `file-history-replay.orchestrator.ts` 调用 `replayFileChangeSet(sessionId, modRoot, 'redo', changes)`。
7. Rust command 校验 `sessionId + modRoot` 后，`apply_file_change_set` 校验 changeset 路径归属当前 `modRoot`，写回 after 状态并返回 `WriteResult`。
8. 前端刷新受影响的文本文件编辑器，并通过 ProjectSession 失效编排入口刷新 project cache、resource cache、query cache 和编辑器窗口；二进制文件只写回磁盘。
9. file history store commit redo。
10. 前端显示成功消息。
