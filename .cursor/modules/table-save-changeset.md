# 表格保存与关联文件 changeset 系统

## 定义

表格保存与关联文件 changeset 系统负责把当前 CSV 表 dirty patch 和用户确认的关联 spec 文件操作写入同一次文件变更集。

## 参考

- `src/app/composables/use-workspace-shell-actions.ts`：拥有主窗口保存动作入口、关联文件确认弹窗、勾选状态和保存结果反馈。
- `src/domain/tables/associated-file-candidates.ts`：拥有关联 spec 创建、删除和 ID 变更重命名候选推导。
- `src/domain/tables/associated-specs.ts`：拥有支持关联 spec 的 CSV 表、关联 spec 相对路径、默认创建文本和详情窗口类型定义。
- `src/orchestrators/file-save.orchestrator.ts`：拥有文件级 history 记录入口和写盘后 ProjectSession 失效入口。
- `src/orchestrators/project-session-invalidation.orchestrator.ts`：拥有 `WriteResult.invalidatedPaths` 到后端 session 刷新、前端缓存失效和窗口事件广播的转换。
- `src/orchestrators/table-save.orchestrator.ts`：拥有表格保存目标捕获、dirty patch 构造、关联文件筛选、写盘结果应用和保存中状态编排。
- `src/services/csv-table.service.ts`：拥有 CSV table service 写入入口，把保存请求交给统一 write service。
- `src/shared/api/tables-api.ts`：拥有 `save_csv_patch` Tauri command 的前端 API 封装。
- `src/shared/types/write.types.ts`：拥有前端 `CsvRowPatch`、`AssociatedFileChange`、`WriteResult` 和 rowKey 映射类型。
- `src/stores/tables.store.ts`：拥有 CSV 草稿表状态、dirty 状态、保存后 rowKey 映射应用和 originalTables 更新。
- `src-tauri/src/commands/tables.rs`：拥有 Rust `save_csv_patch` command，并在写盘前校验 `sessionId + modRoot`。
- `src-tauri/src/io/file_changes.rs`：拥有 FileChangeSetBuilder、文件快照、UTF-8 文本写入、二进制快照、回滚和相对路径校验。
- `src-tauri/src/models/command_payloads.rs`：拥有 `SaveCsvPatchPayload` wire 模型和必填字段反序列化规则。
- `src-tauri/src/models/write.rs`：拥有 Rust `CsvRowPatch`、`AssociatedFileChange`、`CsvRowKeyMapping`、`FileChangeRecord` 和 `WriteResult` 模型。
- `src-tauri/src/services/project/write/csv_patch.rs`：拥有 CSV patch 应用、CSV 文本渲染、关联文件 changeset 构造、rowKey 映射和 session 表缓存更新。

## 边界

- Associated spec 候选边界属于前端 domain；候选只表达本次保存可选的文件操作，不具备写盘能力。
- CSV patch 边界属于当前表 dirty rows；前端只提交 rowKey、patch action 和清理内部字段后的行数据，不提交整表 rows。
- CSV 表目标边界属于捕获的 `ProjectManifest + modRoot + ModTableState + tableKey`；确认回调不得重新读取当前 active Mod 或当前 active table 作为保存目标。
- File changeset 写盘边界属于 Rust；前端不得直接写 CSV、spec 文件或自行拼接磁盘绝对路径执行写入。
- ProjectSession 边界属于后端 session；Rust command 在保存前必须确认 payload 的 `sessionId + modRoot` 指向同一个已加载 session。
- WriteResult 消费边界属于保存编排；只有后端返回的 `changes`、`invalidatedPaths` 和 `keyMap` 能驱动前端保存后状态同步。
- 保存中状态边界属于 `tables.store.saving`；保存编排只在本次写盘 promise 生命周期内设置和释放。
- 保存结果边界属于单次当前表保存；一次 CSV 保存最多记录一条文件级 history，且只在 `result.changes.length > 0` 时记录。
- 关联文件确认边界属于主窗口动作入口；确认弹窗只能提交用户勾选的候选项，不能自动加入未确认候选。
- 关联文件路径边界属于相对 Mod 路径；Rust FileChangeSetBuilder 必须拒绝空路径、`.`、绝对路径和包含 `..` 的路径。
- 关联文件重命名边界由 `previousRelPath` 表达；非 null 时表示读取旧路径、写入新路径并删除旧路径，不是普通覆盖。
- 后端缓存边界属于 ProjectSession；CSV patch 写盘后 Rust 只更新当前 session 的该表 rows/header，前端 session 刷新由 invalidatedPaths 编排触发。
- 文件级 history 边界属于已写盘 changeset；CSV 草稿 history 只在保存成功后清空当前表，不能记录磁盘 changeset。
- 失败语义边界属于调用层级；Rust 写盘失败返回错误，前端不得更新 originalTables、清空 dirty、清空草稿 history 或记录 file history。

## 链路

### 捕获保存目标

1. 主窗口保存动作调用 `captureActiveTableSaveTarget(project.activeManifest)`。
2. 保存编排读取当前 `tables.activeModRoot` 和 active `ModTableState`。
3. 保存编排确认 manifest 存在、modRoot 存在、state 存在，并且 `manifest.modRoot === modRoot`。
4. 保存编排调用 `tables.finishCellEdit()` 结束当前单元格编辑。
5. 保存编排读取 state 中的当前 tableKey。
6. 保存编排调用关联文件候选推导入口，生成本次保存目标绑定的候选列表。
7. 保存编排返回包含 manifest、modRoot、state、tableKey 和候选列表的捕获目标。

### 关联文件候选推导

1. 候选推导收到捕获的 `ModTableState`、tableKey 和正式 rowKey 解析函数。
2. 候选推导跳过没有关联 spec 定义的表。
3. 候选推导遍历当前表 dirty rows。
4. dirty row 是删除时，候选推导从 originalTables 读取原始行和原始业务 ID。
5. 删除行存在关联 spec 路径时，候选推导生成 delete 候选，`afterText`、`afterDataBase64` 和 `previousRelPath` 均为 null。
6. dirty row 是已有行 upsert 时，候选推导比较 originalTables 中的旧业务 ID 和当前 rows 中的新业务 ID。
7. 已有行业务 ID 变化时，候选推导生成 create 候选，并携带新 spec 路径、默认创建文本和旧 spec 路径作为 `previousRelPath`。
8. dirty row 是新建行 upsert 时，候选推导按当前行业务 ID 生成 create 候选，并携带默认创建文本。

### 用户确认关联文件

1. 主窗口保存动作收到捕获目标。
2. 主窗口动作入口读取捕获目标中的关联文件候选。
3. 没有关联文件候选时，主窗口动作入口直接调用保存编排并传入空数组。
4. 存在关联文件候选时，主窗口动作入口为本次弹窗创建独立勾选集合。
5. 用户确认后，主窗口动作入口只把已勾选候选映射为 `AssociatedFileChange[]`。
6. 主窗口动作入口调用 `saveCapturedTableChanges(target, selectedAssociatedFiles)`。

### 构造并提交 CSV patch

1. 保存编排收到捕获目标和关联文件列表。
2. 保存编排检查当前没有其它表格保存正在进行。
3. 保存编排确认捕获目标仍绑定同一个 session 和同一个 `ModTableState` 对象。
4. 保存编排设置 `tables.saving = true`。
5. 保存编排检查捕获表 dirty；没有 dirty 时返回 `noop`。
6. 保存编排过滤关联文件列表，只保留路径属于捕获表的关联文件。
7. 保存编排遍历当前表 dirty rows，构造 `CsvRowPatch[]`。
8. 删除 dirty row 转换为 `action: delete` 和空 row。
9. upsert dirty row 从当前 rows 按 rowKey 定位行，删除内部 rowKey 字段后提交 row。
10. 保存编排调用 CSV table service 保存 table patch。

### Rust 写入 changeset

1. 前端 API 调用 `save_csv_patch` command，payload 包含 sessionId、modRoot、table、patches 和 associatedFiles。
2. Rust command 校验 `sessionId + modRoot` 仍对应同一 ProjectSession。
3. Rust project write service 取得 session、当前表路径、header 和已加载 rows。
4. Rust project write service 按 patch 顺序应用 CSV row patch。
5. delete patch 删除匹配 rowKey 的 session row。
6. upsert patch 更新已存在 rowKey；新建 rowKey 必须匹配当前表的 `table:new:*` 形状，否则返回错误。
7. 新建 upsert patch 写入 session rows，并产生前端临时 rowKey 到正式 rowKey 的 keyMap。
8. Rust project write service 使用 CSV parser render 规则按 header 渲染 CSV 文本。
9. Rust project write service 创建以 modRoot 为根的 FileChangeSetBuilder。
10. FileChangeSetBuilder 加入当前 CSV 文件文本 change。
11. Rust project write service 遍历 associatedFiles 构建关联文件 changes。
12. 普通关联文件 change 直接按 relPath 和 after content 创建、覆盖或删除文件。
13. 重命名关联文件 change 在旧路径存在时读取旧 spec、移除内部字段、按当前表正式 ID 字段写入新 ID，并构建删除旧路径和写入新路径 changes。
14. 重命名关联文件 change 在旧路径不存在时要求 `afterText` 非 null，并用该文本写入新路径。
15. FileChangeSetBuilder 以 redo 方向应用全部 changes，并在失败时回滚已应用文件状态。
16. Rust project write service 把写入后的 rows/header 更新回当前 ProjectSession 表缓存。
17. Rust project write service 返回 `WriteResult`，其中 changes 是完整文件变更集，invalidatedPaths 包含 CSV 路径和关联文件新旧相对路径，keyMap 包含新建行映射。

### 前端应用保存结果

1. 保存编排收到 Rust 返回的 `WriteResult`。
2. 保存编排再次确认捕获目标仍绑定同一个 session 和同一个 `ModTableState` 对象。
3. 捕获目标已失效时，保存编排返回 `saved`，不把旧结果应用到当前运行态。
4. 捕获目标仍有效时，`tables.store` 应用 `result.keyMap` 到当前表 rows、originalTables 和 selectedRowKey。
5. `tables.store` 把当前表 rows 克隆为 originalTables。
6. `tables.store` 清空当前表 dirty。
7. `result.changes.length > 0` 时，保存编排清空当前 `modRoot + tableKey` 的 CSV 草稿 history。
8. `result.changes.length > 0` 时，保存编排记录一条文件级 save history。
9. `result.changes.length > 0` 时，保存编排按 `result.invalidatedPaths` 刷新 ProjectSession、前端查询缓存、资源缓存和相关窗口。
10. 保存编排释放 `tables.saving`。

## 规范

- `AssociatedFileChange` 必须显式提交 `relPath`、`afterText`、`afterDataBase64` 和 `previousRelPath`，未使用字段必须为 null。
- `CsvRowPatch` 必须显式提交 `rowKey`、正式 patch action 和 row；删除 patch 的 row 必须是空对象。
- `SaveCsvPatchPayload` 必须显式提交 `sessionId`、`modRoot`、table、patches 和 associatedFiles。
- CSV patch 只能修改捕获表对应 CSV 文件；不能通过关联文件列表写入其它表的 CSV。
- CSV patch action 必须使用正式 `upsert | delete` 模型，不能在前后端用自定义裸字符串扩展语义。
- CSV 保存请求必须携带 associatedFiles 数组；没有关联文件时必须传空数组。
- CSV 文本写回必须由 Rust CSV render 规则按 session table header 生成，前端不得自行渲染 CSV 文本。
- dirty rows 转 patch 时必须使用正式 dirty row 模型；deleted row 转 delete patch，dirty cells 或新建行转 upsert patch。
- ID 变更导致的关联 spec 重命名必须被候选推导覆盖，不能只处理新建行和删除行。
- ProjectSession 失效必须由 `WriteResult.invalidatedPaths` 驱动；前端不得用 tableKey 反推需要刷新的文件集合。
- result keyMap 必须在标记表 saved 前应用，否则新建行临时 rowKey 会进入 originalTables。
- result changes 为空时不得清空 CSV 草稿 history、不得记录 file history、不得触发保存后 ProjectSession 失效。
- Rust 关联 spec 重命名必须用 JSON-like parser 读取旧文件，并按表的正式 ID 字段写入新 ID。
- Rust 必须拒绝未知的非新建 rowKey upsert；不能把未知 rowKey 静默追加为新行。
- Rust 必须通过 FileChangeSetBuilder 构造 CSV 和关联文件 changes，并一次 apply。
- Rust 返回错误时前端只能显示保存失败，不能应用 rowKey 映射、dirty 清理、history 记录或缓存失效。
- 保存编排必须在确认弹窗前结束当前单元格编辑，保证弹窗中候选和 dirty patch 来自同一个捕获状态。
- 保存编排必须在写盘前和写盘返回后校验捕获目标，目标不匹配时不得把旧结果写入当前 state。
- 关联文件候选 key 必须保持 table、动作类型和业务 ID 的结构边界，不能依赖分隔符拼接。
- 关联文件创建文本只表示默认 spec 内容；只有用户确认后进入 associatedFiles 的项才允许写盘。

## 陷阱

- 把关联文件候选自动写入 associatedFiles，会绕过用户确认并把可选 spec 操作变成隐式磁盘写入。
- 把保存确认回调里的目标改为重新读取 active Mod 或 active table，会在弹窗期间切换 Mod、切表或重载 session 后写错目标。
- 把 CSV 保存拆成 CSV 写盘和关联文件写盘两次 changeset，会破坏一次保存只产生一条文件级 history 的边界。
- 把前端 rows 整表提交给后端，会绕过 rowKey patch、session baseline 和后端未知 rowKey 校验。
- 把临时新建 rowKey 直接保留为保存后的正式 rowKey，会让后续 dirty、选择、草稿 history 和窗口 query 对不上后端 session。
- 忽略 `previousRelPath` 会把 ID 变更误处理成只创建新 spec，旧 spec 会残留在磁盘和 history 中。
- 在 Rust 中用字符串替换改旧 spec ID，会破坏 Starsector JSON-like 文件的解析边界和内部字段清理规则。
- 在保存失败后清空 dirty 或草稿 history，会让未写盘编辑在界面上消失。
- 在 `result.changes.length === 0` 时记录 file history，会产生不可回放的空保存历史。
- 用前端路径拼接替代 FileChangeSetBuilder 相对路径校验，会允许绝对路径、父级跳出或非法相对路径污染 Mod 外文件。
- 用 tableKey 推断 invalidatedPaths，会漏掉关联 spec 新路径、旧路径或未来扩展的多文件变更。
