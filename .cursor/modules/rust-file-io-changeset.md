# Rust 文件 IO、路径校验与目录 changeset

## 定义

Rust 文件 IO、路径校验与目录 changeset 模块负责把后端文件读写、路径归属、文件级变更记录、目录快照、失败回滚和回滚失败报告收口为统一磁盘写入模型。

## 参考

- `src-tauri/src/commands/file_editor.rs`：接收文件编辑器读取和保存 command payload，并在进入 service 前校验 ProjectSession 与 Mod 根目录归属。`src-tauri/src/commands/file_changes.rs`：接收多文件保存和 changeset 回放 command payload，并在进入 service 前校验 ProjectSession 与 Mod 根目录归属。
- `src-tauri/src/io/file_changes.rs`：拥有 `FileChangeSetBuilder`、文件/目录 change 构建、目录快照、应用、回滚和失效路径展开规则。
- `src-tauri/src/io/paths.rs`：拥有 canonical root 边界、绝对/相对路径解析、parent-dir 拒绝、链接父链拒绝和路径身份规范化工具。
- `src-tauri/src/io/text.rs`：拥有文本字节读取、UTF-8 BOM 拒绝、已知 CP1252 字节归一化和 UTF-8 无 BOM 写入。
- `src-tauri/src/models/command_payloads.rs`：定义文件 command 的 wire 输入，强制保存和回放 payload 携带 `sessionId + modRoot`。
- `src-tauri/src/models/write.rs`：定义 `AssociatedFileChange`、`FileChangeRecord`、`FileChangeKind`、`FileSnapshot`、`FileChangeReplayDirection` 和 `WriteResult` 的跨前后端结构。
- `src-tauri/src/services/file_changes.rs`：拥有 command-facing 的文本文件读写、多文件保存、changeset 回放、modRoot 路径归属校验和 `WriteResult` 包装。
- `src/services/write.service.ts`：向前端保存编排层暴露领域化写入和回放入口，不拥有磁盘语义。
- `src/shared/api/files-api.ts`：以前端 command 薄包装形态传递文件 IO 和 changeset 回放 payload。

## 边界

- `AssociatedFileChange` 只表达从前端传入的 Mod 内相对文件变更，不能携带绝对目标语义。
- `FileChangeRecord` 是已写盘文件历史和回放的唯一持久化变更结构，前端 history 只能保存和回传它，不能重建磁盘状态。
- `FileChangeSetBuilder` 拥有从 canonical root 边界加相对路径构建文件或目录 change 的能力，业务 service 只提供已校验的保存意图和内容。
- `FileSnapshot` 只归目录 change 使用，`relPath` 必须是目录内部普通相对文件路径。
- `ProjectSession` 与 `modRoot` 匹配校验归 command 层进入写盘 service 前执行，service 层仍拥有每个 path 对 canonical `modRoot` 的边界校验。
- `WriteResult.invalidation.paths` 归 changeset 统一规则生成，消费方只能用它触发 session/cache 失效。
- `io/file_changes` 拥有 apply、rollback、目录恢复和二进制恢复，不能依赖 command、service、store 或前端历史状态。
- `io/paths` 拥有路径组件安全规则、canonical root 边界、链接父链拒绝和路径 key 规范化，业务 service 不得自行维护另一套路由、归属、链接或 parent-dir 判断。
- `io/text` 拥有文本文件编码边界，parser、service 和 command 不直接用裸 `fs::read_to_string` 或 `fs::write` 处理文本。
- `save_mod_files` 只接收 Mod 根目录内相对文件变更，不接收目录 change 或跨 Mod 目标。
- `save_text_file` 和 `load_editable_file` 只处理单个 Mod 根目录内绝对路径文本文件，不负责 ProjectSession history 移动。
- `services/file_changes` 是文件 IO command 的业务入口，不能承载 CSV、config、editor spec 或 sprite 的字段级语义。
- `前端 API/service` 只负责 payload 形状和调用命名，不拥有路径校验、写盘、删除、快照或回滚规则。

## 链路

### 文本文件读取

1. 前端文件编辑器 service 调用 `loadEditableFile(sessionId, modRoot, path)`。
2. shared API 调用 `load_editable_file` command。
3. Rust command 反序列化 `LoadEditableFilePayload`。
4. Rust command 调用 ProjectSession 校验，确认 `sessionId + modRoot` 仍匹配同一打开 session。
5. Rust command 调用 `services::file_changes::load_editable_file(modRoot, path)`。
6. file changes service 通过 canonical `modRoot` 边界解析 `path`，并拒绝 parent-dir、root 外路径和链接父链。
7. text IO 读取字节并拒绝已有链接文件和 UTF-8 BOM。
8. text IO 将 UTF-8 文本返回；遇到已知 CP1252 引号或短横字节时归一化后再返回。
9. service 返回 `EditableFileData { path, text }`。

### 文本文件保存

1. 前端文件编辑器 service 调用 `writeEditableFileText(sessionId, modRoot, path, text)`。
2. write service 调用 shared API 的 `saveTextFile(sessionId, modRoot, path, text)`。
3. Rust command 反序列化 `SaveTextFilePayload`。
4. Rust command 校验 `sessionId + modRoot` 仍匹配同一打开 session。
5. Rust command 调用 `services::file_changes::save_text_file(modRoot, path, text)`。
6. file changes service 通过 canonical `modRoot` 边界解析 `path`，并拒绝 parent-dir、root 外路径和链接父链。
7. file changes service 用 `build_text_change` 读取当前文件状态并生成单个 file change。
8. changeset apply 按 redo 写入 UTF-8 无 BOM 文本。
9. apply 成功后 service 用 changeset 失效路径规则生成 `WriteResult`。
10. 前端保存编排通过 File History Session 记录 file history，并按 `invalidation.paths` 刷新 ProjectSession。

### 多文件保存

1. 前端保存编排调用 `writeModFiles(sessionId, modRoot, files)`。
2. write service 调用 shared API 的 `saveModFiles(sessionId, modRoot, files)`。
3. Rust command 反序列化 `SaveModFilesPayload`。
4. Rust command 校验 `sessionId + modRoot` 仍匹配同一打开 session。
5. Rust command 调用 `services::file_changes::save_mod_files(modRoot, files)`。
6. file changes service 以 `modRoot` 创建带 canonical root 边界的 `FileChangeSetBuilder`。
7. builder 逐个校验 `AssociatedFileChange.relPath` 是非空普通相对文件路径，并确认目标父链不经过链接或 reparse point。
8. builder 读取每个目标当前状态，生成 file change。
9. builder apply 按 redo 写入文本、写入二进制或删除文件。
10. apply 成功后 service 返回包含 changes 和统一 invalidation.paths 的 `WriteResult`。

### 业务保存消费 changeset

1. 业务 service 按自身模型完成 ID、字段、索引、目标和内容校验。
2. 业务 service 以自身声明拥有的保存根目录创建带 canonical root 边界的 `FileChangeSetBuilder` 或构造单个 text change。
3. 业务 service 向 builder 添加文本文件、二进制文件、目录删除或目录复制产生的目标 change。
4. builder 在添加相对路径 change 时统一拒绝空路径、`.`、`..`、绝对路径和 Windows prefix，并拒绝目标父链链接逃逸。
5. builder 在构建 change 时捕获 before 状态，文本可读时记录 text，文本不可读时记录 base64。
6. builder apply 按 redo 执行 changeset。
7. `WriteResult` 从 changes 生成 `invalidation.paths`。
8. 业务 service 返回包含 changes、invalidation、业务刷新实体、keyMap 或 warnings 的 `WriteResult`。

### changeset 回放

1. 前端 file history replay orchestrator 读取当前 `modRoot` 和 sessionId。
2. 前端从 file history store peek 当前方向栈顶 file-save entry。
3. 用户确认后，前端再次确认栈顶 entry 未变化，并确认当前 sessionId 未变化。
4. 前端调用 `replayFileChangeSet(sessionId, modRoot, direction, entry.changes)`。
5. shared API 调用 `apply_file_change_set` command。
6. Rust command 反序列化 `ApplyFileChangeSetPayload`。
7. Rust command 校验 `sessionId + modRoot` 仍匹配同一打开 session。
8. file changes service 用当前 canonical `modRoot` 重新解析每个 `FileChangeRecord.path`，拒绝 parent-dir、root 外路径和链接父链。
9. file changes service 校验每个目录快照 `FileSnapshot.relPath` 是目录内普通相对文件路径，并在恢复时继续拒绝链接父链。
10. file changes service 将 replay direction 映射为 undo 或 redo。
11. changeset apply 对每个 change 先记录当前状态作为 rollback。
12. file change 按 direction 选择 before 或 after，写入文本、写入二进制或删除文件。
13. directory change 按 direction 选择 before 或 after，删除现有目录并恢复快照文件。
14. 任一 change 应用失败时，apply 按已记录的当前状态逆序回滚已应用 change，并收集每个回滚失败。
15. 回滚全部成功时，apply 返回原始写入错误。
16. 回滚存在失败时，apply 返回包含原始写入错误和回滚失败详情的复合错误，并明确磁盘状态可能部分改变。
17. apply 成功后 service 返回 `WriteResult`。
18. 前端通知打开的文件编辑窗口同步文本 change，并按 `invalidation.paths` 刷新已加载 session。

## 规范

- `AssociatedFileChange.afterText` 和 `afterDataBase64` 必须显式可空；两者都为空表示删除文件。
- `FileChangeKind::Directory` 的 before/after 文件内容只能存放在 `beforeFiles` 和 `afterFiles`，不能塞进单文件 text/base64 字段。
- `FileChangeKind::File` 的 `path` 必须是绝对路径；builder 从相对路径构造时必须先通过 canonical root 边界解析到 `modRoot` 内。
- `FileChangeRecord.beforeExists`、`afterExists`、nullable 内容字段和快照集合必须在 wire payload 中显式存在。
- `FileSnapshot` 中文本文件优先保存 `text`；无法按文本读取的文件保存 `dataBase64`。
- `WriteResult.changes` 必须是实际写盘成功后可用于 undo/redo 的完整 change 列表。
- `WriteResult.invalidation.paths` 对 file change 包含该文件绝对路径；对 directory change 同时包含目录路径和快照内每个文件的绝对路径。
- `apply_changes` 在执行每个 change 前必须捕获当前状态；失败回滚只能用捕获的当前状态恢复，不读取前端历史推断状态。
- `apply_changes` 不得吞掉回滚失败；原始写入错误和回滚失败详情必须共同进入最终错误。
- `apply_file_change_set` 在任何写入或删除前必须完整校验所有 change path 和所有目录快照 relPath。
- `load_editable_file` 的失败语义必须返回 Rust 错误字符串，不能在前端静默降级为外部读取。
- `modRoot` 归属判断必须以 canonical root 为权威，拒绝绝对路径缺失、parent-dir 组件、root 外路径、最近存在父目录不在 root 内和任一已有父链链接或 reparse point。
- `read_utf8_no_bom` 必须拒绝 UTF-8 BOM；只允许已知 CP1252 智能引号和短横字节归一化为 ASCII 后继续解析。
- `save_text_file` 保存成功必须返回单个 file change；无变化判断不在该 service 内特判。
- `validate_safe_relative_path` 只允许非空普通相对组件，拒绝空路径、`.`、`..`、绝对路径、空分段和 Windows 盘符 prefix。
- `write_utf8_no_bom` 写入文本时只能写入 `text.as_bytes()`，不能添加 BOM 或跨层改写换行策略。

## 陷阱

- 把前端传入的 `path` 当成已可信绝对路径，会绕过 canonical `modRoot`、链接父链、parent-dir 和 ProjectSession 边界。
- 把目录删除展开成多个 file change，会丢失目录级快照、目录恢复顺序和目录路径本身的失效语义。
- 在 `apply_file_change_set` 开始写盘后才校验目录快照 relPath，会让恶意快照先触发目录删除再依赖回滚补救。
- 在业务 service 手工拼 `invalidation.paths`，会让目录 change 的嵌套文件失效漏报。
- 用前端 history 移动代替 Rust apply 结果，会让磁盘失败时 undo/redo 栈与真实文件系统分离。
- 用 parser 或 command 直接写文件，会绕过统一编码、changeset、回滚和路径归属规则。
- 用普通字符串 `starts_with`、未 canonicalize 的路径 key 或最近父目录推断替代 root boundary，会在大小写、斜杠、尾部分隔符和 symlink/junction/reparse point 上误判路径归属。
- 遍历目录时静默跳过链接项，会隐藏链接逃逸风险；读写、删除、目录快照和扫描入口都必须把链接项作为错误处理。
- 用文本字段保存二进制快照，或用 base64 字段保存可读文本，会破坏文件编辑器同步和历史展示语义。
- 在 change 构建前创建目录，会让非法 base64、非法路径或业务校验失败留下空目录副作用。
- 在回放时根据当前文件存在状态重建 before/after，会污染已记录的历史语义并破坏可重复 undo/redo。
