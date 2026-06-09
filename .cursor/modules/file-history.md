# 文件级 history / changeset 系统

## 定义

文件级 history / changeset 系统负责记录已写盘保存事件，并按用户确认把对应文件变更集撤销或重做到磁盘。

## 参考

- `src/app/components/config/ConfigFileHistoryView.vue`：拥有文件历史检查页的列表展示、文件变更摘要和撤销 / 重做按钮。
- `src/app/composables/use-file-history-view-model.ts`：拥有文件历史页面 ViewModel，读取当前 Mod 栈、清空当前 Mod 文件历史并触发单步回放。
- `src/orchestrators/file-history-replay.orchestrator.ts`：拥有文件级 undo/redo 的确认 UI 和反馈，不拥有回放执行、窗口同步或栈提交。
- `src/orchestrators/file-history-session.orchestrator.ts`：拥有 File History Session，统一处理保存记录、session 校验、Rust 回放、ProjectSession 刷新、窗口文本同步和栈提交。
- `src/orchestrators/file-save.orchestrator.ts`：拥有保存事件到 File History Session 的入口，不直接写 history store 或刷新 session。
- `src/orchestrators/main-history-command.orchestrator.ts`：拥有主窗口历史命令分派，在当前 CSV 草稿历史为空时进入文件级 history。
- `src/orchestrators/project-session-refresh.orchestrator.ts`：拥有回放后按 invalidation.paths 刷新已加载 ProjectSession、查询缓存、资源缓存和窗口事件的边界。
- `src/orchestrators/settings-persistence.orchestrator.ts`：拥有 historyLimit 设置同步入口，把设置快照中的历史长度同步到文件历史 store。
- `src/shared/api/files-api.ts`：拥有 `apply_file_change_set` Tauri command 的前端 API 封装。
- `src/shared/types/file-history.types.ts`：拥有文件历史 entry 类型和 file-save entry 判定。
- `src/shared/types/history.types.ts`：拥有前端 `FileChangeRecord`、`FileSnapshot` 和 replay direction 的显式字段模型。
- `src/shared/types/write.types.ts`：拥有 `WriteResult` 统一写入结果类型。
- `src/stores/file-history.store.ts`：拥有按 modRoot 隔离的文件级 undo/redo 栈、peek、commit、清空和长度裁剪。
- `src-tauri/src/commands/files.rs`：拥有 `apply_file_change_set` command，并在回放前校验 `sessionId + modRoot`。
- `src-tauri/src/io/file_changes.rs`：拥有 changeset 构建、文件/目录快照、UTF-8 文本写入、二进制回放、路径失效展开和失败回滚。
- `src-tauri/src/models/write.rs`：拥有 Rust `FileChangeRecord`、`FileSnapshot`、`FileChangeReplayDirection` 和 `WriteResult` 模型。
- `src-tauri/src/services/file_changes.rs`：拥有 command-facing 文件写入和 changeset 回放 service，负责路径归属校验和回放结果构造。

## 边界

- Changeset 模型边界属于 Rust `FileChangeRecord`；前端只能保存和回放后端返回的完整 changes 数组，不得自行合成磁盘快照。
- File history 持久化边界是无持久化；它是当前进程内按 Mod 隔离的运行态，不写 workspace、settings 或 Mod 文件。
- File history 记录边界属于已成功写盘的 `WriteResult.changes`；未写盘草稿、空 changes 和失败写入不得进入文件历史，保存编排无法记录 history 时必须作为保存完成链路失败处理。
- File History Session owner 是 `file-history-session.orchestrator.ts`；保存编排和回放编排只能请求 session 记录保存或执行回放，不能直接 push、commit、写盘、刷新或广播文本同步。
- File history 栈 owner 是 `file-history.store`；视图只能读取、peek 或清空，File History Session 才能 push 和 commit。
- ProjectSession 校验边界属于写入和回放入口；记录保存事件或回放文件历史时必须确认 `sessionId + modRoot` 未变。
- Rust 回放边界属于 `apply_file_change_set`；前端不得直接写 before/after 文件内容或删除目录。
- WriteResult 消费边界属于调用方；文件历史 entry 只保存 changes，不保存 invalidation、warnings、keyMap 或 refreshedEntity。
- 主窗口撤销 / 重做分派边界属于主窗口编排；文件历史只能在当前 CSV 草稿历史没有可消费 entry 时执行。
- 目录 changeset 边界属于目录级 FileChangeRecord；目录快照中的文件路径必须是目录内相对路径。
- 视图展示边界属于当前 active Mod；文件历史页面不得展示、清空或回放非当前 Mod 的栈。
- 路径归属边界属于 Rust service；回放前必须验证每个 change.path 是当前 modRoot 内绝对路径，并验证目录 snapshot 相对路径不越界。
- 文件编辑器同步边界属于窗口事件；回放普通文本文件时只通知匹配 `modRoot + path` 的已打开文件编辑器，二进制内容不注入文本窗口。
- 缓存失效边界属于 ProjectSession refresh 编排；File History Session 只能调用 refresh 编排，不得自行刷新 project、query、resource 或 editor window 缓存。
- 设置边界属于 settings persistence；文件历史 store 只接收同步后的 historyLimit，不读取 settings store 或 app data。
- 栈提交边界属于 File History Session；Rust 回放失败、session refresh 失败、窗口文本同步失败或栈顶变化时不得移动 undo/redo 栈。

## 链路

### 记录文件保存

1. 保存编排或窗口保存事件处理器获得 Rust 返回的 `WriteResult`。
2. 调用方把 modRoot、sessionId、WriteResult 和 label 传给 File History Session。
3. File History Session 拒绝空 modRoot、空 sessionId 或空 changes，并以明确错误停止保存完成链路。
4. File History Session 读取当前 manifest 并确认 sessionId 仍匹配；不匹配时以明确错误停止保存完成链路。
5. File History Session 调用 file history store 写入 file-save entry。
6. file history store 按 modRoot 获取或创建当前 Mod 栈。
7. file history store 创建带 id、timestamp、kind、changes 和 label 的 entry。
8. file history store 把 entry 压入 undo 栈。
9. file history store 清空 redo 栈。
10. file history store 按当前 historyLimit 裁剪 undo 栈头部。
11. File History Session 在 history 记录成功后触发 ProjectSession 写后刷新。
12. 保存编排只能在 File History Session 完整成功后提交本地草稿 baseline 或发送保存完成语义。

### 文件历史页面读取

1. 用户进入文件历史配置页。
2. 文件历史 ViewModel 读取当前 active manifest。
3. 文件历史 ViewModel 按 active manifest 的 modRoot 从 file history store 读取 undo/redo 栈。
4. 文件历史 ViewModel 反转栈顺序生成页面展示列表。
5. 页面组件按 entry id、change kind 和 change path 生成结构化行 key。
6. 页面组件展示每条 changeset 的文件/目录类型、二进制标记和 before/after 存在状态。

### 清空当前 Mod 文件历史

1. 用户点击文件历史页面的清空按钮。
2. 文件历史 ViewModel 确认当前 active manifest 存在且 historyCount 非零。
3. 反馈入口显示清空确认弹窗。
4. 用户确认后，ViewModel 调用 file history store 清空当前 modRoot。
5. file history store 只清空该 Mod 的 undo/redo 栈。
6. 清空操作完成后显示成功反馈。

### 文件级撤销

1. 用户通过主窗口快捷键或文件历史页面触发文件级撤销。
2. 回放编排读取当前 active modRoot。
3. 回放编排读取当前 modRoot 的 sessionId。
4. 回放编排从 file history store peek 当前可撤销 file-save entry。
5. 回放编排显示确认弹窗，列出 label 和涉及路径数量。
6. 用户确认后，回放编排把 replay plan 交给 File History Session。
7. File History Session 再次 peek 当前 undo 栈顶 entry。
8. 当前栈顶 id 不等于已确认 entry id 时，File History Session 返回栈状态变化错误并停止。
9. File History Session 再次读取当前 modRoot 的 sessionId。
10. 当前 sessionId 不等于确认前捕获的 sessionId 时，File History Session 返回 ProjectSession 变化错误并停止。
11. File History Session 调用 write service，以 `undo` direction 提交 sessionId、modRoot 和 entry.changes。
12. 前端 API 调用 Rust `apply_file_change_set` command。
13. Rust command 校验 `sessionId + modRoot`。
14. Rust file changes service 校验 changeset 所有路径归属当前 modRoot，并校验目录 snapshot 相对路径。
15. Rust io 按 undo 方向写回 before 状态，失败时回滚已应用文件状态。
16. Rust 返回新的 `WriteResult`。
17. File History Session 按回放结果 invalidation.paths 刷新受影响 ProjectSession、query cache、resource cache 和窗口。
18. File History Session 按 undo 方向通知已打开文件编辑器应用 before 文本。
19. 回放影响当前 active Mod 时，File History Session 清空当前表选中行。
20. File History Session commit undo 栈顶 entry，把它移动到 redo 栈。
21. commit 成功后回放编排显示撤销成功反馈。

### 文件级重做

1. 用户通过主窗口快捷键或文件历史页面触发文件级重做。
2. 回放编排读取当前 active modRoot。
3. 回放编排读取当前 modRoot 的 sessionId。
4. 回放编排从 file history store peek 当前可重做 file-save entry。
5. 回放编排显示确认弹窗，列出 label 和涉及路径数量。
6. 用户确认后，回放编排把 replay plan 交给 File History Session。
7. File History Session 再次 peek 当前 redo 栈顶 entry。
8. 当前栈顶 id 不等于已确认 entry id 时，File History Session 返回栈状态变化错误并停止。
9. File History Session 再次读取当前 modRoot 的 sessionId。
10. 当前 sessionId 不等于确认前捕获的 sessionId 时，File History Session 返回 ProjectSession 变化错误并停止。
11. File History Session 调用 write service，以 `redo` direction 提交 sessionId、modRoot 和 entry.changes。
12. 前端 API 调用 Rust `apply_file_change_set` command。
13. Rust command 校验 `sessionId + modRoot`。
14. Rust file changes service 校验 changeset 所有路径归属当前 modRoot，并校验目录 snapshot 相对路径。
15. Rust io 按 redo 方向写回 after 状态，失败时回滚已应用文件状态。
16. Rust 返回新的 `WriteResult`。
17. File History Session 按回放结果 invalidation.paths 刷新受影响 ProjectSession、query cache、resource cache 和窗口。
18. File History Session 按 redo 方向通知已打开文件编辑器应用 after 文本。
19. 回放影响当前 active Mod 时，File History Session 清空当前表选中行。
20. File History Session commit redo 栈顶 entry，把它移动到 undo 栈。
21. commit 成功后回放编排显示重做成功反馈。

### 设置同步与长度裁剪

1. 主窗口启动 settings persistence。
2. settings persistence 读取当前 settings snapshot。
3. settings persistence 把 `historyLimit` 传给 file history store。
4. file history store 更新内存 historyLimit。
5. file history store 遍历所有 Mod 的 undo 栈。
6. file history store 只按 file-save entry 数量裁剪 undo 栈头部。

## 规范

- `ApplyFileChangeSetPayload` 必须显式提交 `sessionId`、`modRoot`、direction 和完整 changes 数组。
- `FileChangeRecord` 必须显式提交 kind、path、before/after exists、before/after 文本、before/after 二进制和 before/after 目录文件集合。
- `FileHistoryItem` 当前只允许 file-save entry；新增 entry kind 必须重新定义 peek、commit、视图展示和裁剪语义。
- `FileSnapshot` 必须显式提交 relPath、text 和 dataBase64；文本和二进制内容未使用时必须是 null。
- `WriteResult` 必须显式返回 changes、invalidation、keyMap、refreshedEntity 和 warnings；文件历史只消费 changes。
- changeset 回放 direction 必须使用正式 `undo | redo` 模型，不能用自定义字符串在 service 层解释。
- commit 只能移动当前栈顶且 id 匹配的 file-save entry，不能搜索栈内旧 entry 或弹出多条历史。
- file history 按 modRoot 隔离；activate、record、peek、commit、clear 和 remove 都不得跨 Mod 读写。
- historyLimit 只裁剪 undo 栈；新保存 entry 入栈时必须清空 redo 栈。
- 保存结果记录 history 时必须拒绝空 changes；空保存不能生成可撤销项，也不能伪装成已记录 history 的保存完成事件。
- 提供 expectedSessionId 的保存记录必须确认当前 manifest sessionId 仍匹配，避免旧窗口保存污染新 session history。
- 保存编排必须把 File History Session 失败当作正式失败；不得清空草稿 history、提交 baseline 或发送保存成功语义。
- 文件历史清空只清空内存 undo/redo 栈，不写磁盘、不回放 changeset、不刷新 ProjectSession。
- 文件历史回放必须先确认、再由 File History Session 复核栈顶和 session、再调用 Rust 写盘。
- 文件历史回放成功后必须先通过 ProjectSession refresh 编排处理 invalidation.paths，再广播文件编辑器文本同步，最后移动 undo/redo 栈。
- 文件历史回放通知文件编辑器时必须携带 modRoot 和绝对 path；文件编辑器只能在两者同时匹配时应用文本。
- 二进制文件回放不得向文件编辑器发送 dataBase64 文本；目录 changeset 不发送单文件文本应用事件。
- Rust 回放前必须验证 change.path 是当前 modRoot 内绝对路径，且 path 和 modRoot 都不得包含父级跳出。
- Rust 回放前必须验证目录 snapshot relPath 是合法相对路径。
- Rust 回放失败、session refresh 失败或文件编辑器文本同步失败时前端不得移动 undo/redo 栈，不得显示成功反馈。
- 主窗口文件级 undo/redo 只能在当前表 CSV 草稿 history 没有对应 entry 时执行。

## 陷阱

- 把文件历史写入 settings 或 workspace persistence，会把进程内撤销栈误变成长期审计日志。
- 把未写盘 CSV 草稿或编辑器本地草稿写入 file history，会让磁盘回放操作缺少真实 before/after 文件状态。
- 把 `WriteResult.invalidation.paths` 存入 history entry 并回放旧路径集合，会在目录 changeset、跨 Mod 路径归属或未来写入结果扩展时刷新错误缓存。
- 在确认弹窗打开后不复核栈顶 entry，会把用户确认的旧 entry 应用到已经变化的 history 栈。
- 在确认弹窗打开后不复核 sessionId，会把旧 ProjectSession 的 changeset 写到新加载的 Mod 状态中。
- 在 Rust 回放失败后 commit 栈移动，会造成磁盘内容和 undo/redo 栈方向不一致。
- 在 session refresh 或文件编辑器同步失败后 commit 栈移动，会让窗口、cache 和 history 方向不一致。
- 为了寻找已确认 entry 而弹出多条历史，会破坏 history 的栈模型和用户可预期的撤销顺序。
- 用前端路径判断替代 Rust 路径归属校验，会允许外部绝对路径或父级跳出通过回放写盘。
- 向文件编辑器广播二进制内容，会把不可显示数据污染成文本编辑状态。
- 清空文件历史时顺带回滚磁盘，会把“清空记录”和“撤销文件”两个用户动作混在一起。
