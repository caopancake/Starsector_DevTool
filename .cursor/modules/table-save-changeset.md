# 表格保存与关联 spec changeset 系统

## 定义

表格保存与关联 spec changeset 系统负责把当前 CSV 表 dirty patch 和用户确认的关联 spec 动作意图写入同一次文件变更集。

## 参考

- `src/app/composables/use-workspace-shell-actions.ts`：拥有主窗口保存动作入口、关联 spec 确认弹窗、勾选状态和保存结果反馈。
- `src/domain/tables/associated-spec-candidates.ts`：拥有关联 spec 创建、删除和 ID 变更重命名动作候选推导，并只消费 manifest 中的后端关联 spec 能力表。
- `src/domain/tables/associated-specs.ts`：拥有 CSV 表到关联编辑器窗口 kind 的 UI 映射。
- `src/orchestrators/file-history-session.orchestrator.ts`：拥有 CSV 写盘成功后的文件级 history 记录、ProjectSession 刷新和保存完成边界。
- `src/orchestrators/project-session-refresh.orchestrator.ts`：拥有 `WriteResult.invalidation.paths` 到后端 session 刷新、前端缓存失效和窗口事件广播的转换。
- `src/domain/tables/csv-table-draft.ts`：拥有 CSV 表保存成功后的 rowKey 映射、baseline 提升、dirty 清理和文件级外部更新标记清理。
- `src/orchestrators/table-save.orchestrator.ts`：拥有表格保存目标捕获、dirty patch 构造、关联 spec 动作筛选、写盘结果应用和保存中状态编排。
- `src/services/csv-table.service.ts`：拥有 CSV table service 写入入口，把保存请求交给统一 write service。
- `src/shared/api/tables-api.ts`：拥有 `save_csv_patch` Tauri command 的前端 API 封装。
- `src/shared/types/write.types.ts`：拥有前端 `CsvRowPatch`、`AssociatedSpecChange`、`WriteResult` 和 rowKey 映射类型。
- `src/stores/tables.store.ts`：拥有 CSV 草稿表状态容器和保存后状态同步入口，具体 dirty / baseline 规则委托 CSV Table Draft Session。
- `src-tauri/src/commands/tables.rs`：拥有 Rust `save_csv_patch` command，并在写盘前校验 `sessionId + modRoot`。
- `src-tauri/src/io/file_changes.rs`：拥有 FileChangeSetBuilder、文件快照、UTF-8 文本写入、二进制快照、回滚和相对路径校验。
- `src-tauri/src/models/command_payloads.rs`：拥有 `SaveCsvPatchPayload` wire 模型和必填字段反序列化规则。
- `src-tauri/src/models/write.rs`：拥有 Rust `CsvRowPatch`、`AssociatedSpecChange`、`CsvRowKeyMapping`、`FileChangeRecord` 和 `WriteResult` 模型。
- `src-tauri/src/services/project/entity_definitions.rs`：拥有 CSV 表关联 spec 的路径、扩展名、ID 字段和默认内容定义。
- `src-tauri/src/services/project/write/csv_patch.rs`：拥有 CSV patch 应用、CSV 文本渲染、关联 spec 动作到文件 changeset 的转换、rowKey 映射和 session 表缓存更新。

## 边界

- Associated spec 候选边界属于前端 domain；候选只表达后端 manifest 声明支持的本次保存可选动作意图，不携带持久化路径、扩展名、ID 字段或文件文本。
- CSV patch 边界属于 CSV Table Draft Session 维护的当前表 dirty rows；前端只提交 rowKey、patch action 和清理内部字段后的行数据，不提交整表 rows。
- CSV 表目标边界属于捕获的 `ProjectManifest + modRoot + ModTableState + tableKey`；确认回调不得重新读取当前 active Mod 或当前 active table 作为保存目标。
- File changeset 写盘边界属于 Rust；前端不得直接写 CSV、spec 文件或自行拼接磁盘绝对路径执行写入。
- ProjectSession 边界属于后端 session；Rust command 在保存前必须确认 payload 的 `sessionId + modRoot` 指向同一个已加载 session。
- WriteResult 消费边界属于保存编排和 File History Session；只有 File History Session 完整完成后，后端返回的 `keyMap` 才能驱动 CSV 本地 baseline 提交。
- 保存中状态边界属于 `tables.store.saving`；保存编排只在本次写盘 promise 生命周期内设置和释放。
- 保存结果边界属于单次当前表保存；一次 CSV 保存最多记录一条文件级 history，且只在 `result.changes.length > 0` 时记录。
- 关联 spec 确认边界属于主窗口动作入口；确认弹窗只能提交用户勾选的候选项，不能自动加入未确认候选。
- 关联 spec 持久化边界属于 Rust 实体定义；路径、默认内容、ID 字段和重命名文件内容重写不得由前端生成。
- 关联 spec 重命名边界由 `previousId` 表达；后端按定义定位旧路径和新路径，读取旧 spec 或生成默认 spec 后写入新 ID。
- 后端缓存边界属于 ProjectSession；CSV patch 写盘后 Rust 只更新当前 session 的该表 rows/header，前端 session 刷新由 invalidation.paths 编排触发。
- 文件级 history 边界属于已写盘 changeset；CSV 草稿 history 只在 File History Session 完整成功后清空当前表，不能记录磁盘 changeset。
- 失败语义边界属于调用层级；Rust 写盘失败或 File History Session 失败时，前端不得请求 CSV Table Draft Session 更新 originalTables、清空 dirty、清空草稿 history 或显示保存完成。

## 链路

### 捕获保存目标

1. 主窗口保存动作调用 `captureActiveTableSaveTarget(project.activeManifest)`。
2. 保存编排读取当前 `tables.activeModRoot` 和 active `ModTableState`。
3. 保存编排确认 manifest 存在、modRoot 存在、state 存在，并且 `manifest.modRoot === modRoot`。
4. 保存编排调用 `tables.finishCellEdit()` 结束当前单元格编辑。
5. 保存编排读取 state 中的当前 tableKey。
6. 保存编排调用关联 spec 候选推导入口，生成本次保存目标绑定的候选列表。
7. 保存编排返回包含 manifest、modRoot、state、tableKey 和候选列表的捕获目标。

### 关联 spec 候选推导

1. 候选推导收到捕获的 `ModTableState`、tableKey 和正式 rowKey 解析函数。
2. 候选推导跳过 manifest 中没有声明关联 spec 能力的表。
3. 候选推导遍历当前表 dirty rows。
4. dirty row 是删除时，候选推导从 originalTables 读取原始行和原始业务 ID。
5. 删除行存在业务 ID 时，候选推导生成 delete 候选，携带 table、id、action 和原始 row。
6. dirty row 是已有行 upsert 时，候选推导比较 originalTables 中的旧业务 ID 和当前 rows 中的新业务 ID。
7. 已有行业务 ID 变化时，候选推导生成 rename 候选，携带 table、id、previousId、action 和当前 row。
8. dirty row 是新建行 upsert 时，候选推导按当前行业务 ID 生成 create 候选，携带 table、id、action 和当前 row。

### 用户确认关联 spec

1. 主窗口保存动作收到捕获目标。
2. 主窗口动作入口读取捕获目标中的关联 spec 候选。
3. 没有关联 spec 候选时，主窗口动作入口直接调用保存编排并传入空数组。
4. 存在关联 spec 候选时，主窗口动作入口为本次弹窗创建独立勾选集合。
5. 用户确认后，主窗口动作入口只把已勾选候选映射为 `AssociatedSpecChange[]`。
6. 主窗口动作入口调用 `saveCapturedTableChanges(target, selectedAssociatedSpecs)`。

### 构造并提交 CSV patch

1. 保存编排收到捕获目标和关联 spec 动作列表。
2. 保存编排检查当前没有其它表格保存正在进行。
3. 保存编排确认捕获目标仍绑定同一个 session 和同一个 `ModTableState` 对象。
4. 保存编排设置 `tables.saving = true`。
5. 保存编排检查捕获表 dirty；没有 dirty 时返回 `noop`。
6. 保存编排过滤关联 spec 动作列表，只保留属于捕获表的动作。
7. 保存编排遍历当前表 dirty rows，构造 `CsvRowPatch[]`。
8. 删除 dirty row 转换为 `action: delete` 和空 row。
9. upsert dirty row 从当前 rows 按 rowKey 定位行，删除内部 rowKey 字段后提交 row。
10. 保存编排调用 CSV table service 保存 table patch。

### Rust 写入 changeset

1. 前端 API 调用 `save_csv_patch` command，payload 包含 sessionId、modRoot、table、patches 和 associatedSpecs。
2. Rust command 校验 `sessionId + modRoot` 仍对应同一 ProjectSession。
3. Rust project write service 取得 session、当前表路径、header 和已加载 rows。
4. Rust project write service 按 patch 顺序应用 CSV row patch。
5. delete patch 删除匹配 rowKey 的 session row。
6. upsert patch 更新已存在 rowKey；新建 rowKey 必须匹配当前表的 `table:new:*` 形状，否则返回错误。
7. 新建 upsert patch 写入 session rows，并产生前端临时 rowKey 到正式 rowKey 的 keyMap。
8. Rust project write service 使用 CSV parser render 规则按 header 渲染 CSV 文本。
9. Rust project write service 创建以 modRoot 为根的 FileChangeSetBuilder。
10. FileChangeSetBuilder 加入当前 CSV 文件文本 change。
11. Rust project write service 遍历 associatedSpecs 构建关联 spec 文件 changes。
12. create 动作按统一实体定义生成目标路径和默认 spec 内容。
13. delete 动作按统一实体定义生成目标路径并构建删除 change。
14. rename 动作按统一实体定义定位旧路径和新路径；旧文件存在时通过 JSON-like parser 改写 ID 字段，旧文件不存在时按当前 row 生成默认 spec。
15. FileChangeSetBuilder 以 redo 方向应用全部 changes，并在失败时回滚已应用文件状态。
16. Rust project write service 把写入后的 rows/header 更新回当前 ProjectSession 表缓存。
17. Rust project write service 返回 `WriteResult`，其中 changes 是完整文件变更集，invalidation.paths 由 changeset 生成，keyMap 包含新建行映射。

### 前端应用保存结果

1. 保存编排收到 Rust 返回的 `WriteResult`。
2. 保存编排再次确认捕获目标仍绑定同一个 session 和同一个 `ModTableState` 对象。
3. 捕获目标已失效时，保存编排返回 `saved`，不把旧结果应用到当前运行态。
4. `result.changes.length > 0` 时，保存编排把 result、modRoot、sessionId 和 label 交给 File History Session。
5. File History Session 记录一条文件级 save history。
6. File History Session 按 `result.invalidation.paths` 刷新 ProjectSession、前端查询缓存、资源缓存和相关窗口。
7. File History Session 完整成功且捕获目标仍有效时，`tables.store` 请求 CSV Table Draft Session 应用 `result.keyMap` 到当前表 rows、originalTables 和 selectedRowKey。
8. `tables.store` 请求 CSV Table Draft Session 把当前表 rows 克隆为 originalTables。
9. CSV Table Draft Session 清空当前表 dirty 和文件级外部更新标记。
10. 保存编排清空当前 `modRoot + tableKey` 的 CSV 草稿 history。
11. 保存编排释放 `tables.saving`。

## 规范

- `AssociatedSpecChange` 必须显式提交 action、id、previousId 和 row；previousId 只允许 rename 使用。
- `CsvRowPatch` 必须显式提交 `rowKey`、正式 patch action 和 row；删除 patch 的 row 必须是空对象。
- `SaveCsvPatchPayload` 必须显式提交 `sessionId`、`modRoot`、table、patches 和 associatedSpecs。
- CSV patch 只能修改捕获表对应 CSV 文件；不能通过关联 spec 动作写入其它表的 CSV。
- CSV patch action 必须使用正式 `upsert | delete` 模型，不能在前后端用自定义裸字符串扩展语义。
- CSV 保存请求必须携带 associatedSpecs 数组；没有关联 spec 动作时必须传空数组。
- CSV 文本写回必须由 Rust CSV render 规则按 session table header 生成，前端不得自行渲染 CSV 文本。
- dirty rows 转 patch 时必须使用正式 dirty row 模型；deleted row 转 delete patch，dirty cells 或新建行转 upsert patch。
- ID 变更导致的关联 spec 重命名必须被候选推导覆盖，不能只处理新建行和删除行。
- ProjectSession refresh 必须由 `WriteResult.invalidation.paths` 驱动；前端不得用 tableKey 反推需要刷新的文件集合。
- result keyMap 必须在 File History Session 完整成功后、CSV Table Draft Session 标记表 saved 前应用，否则新建行临时 rowKey 会进入 originalTables。
- result changes 为空时不得清空 CSV 草稿 history、不得记录 file history、不得触发保存后 ProjectSession refresh。
- Rust 关联 spec 重命名必须用 JSON-like parser 读取旧文件，并按表的正式 ID 字段写入新 ID。
- Rust 必须拒绝未知的非新建 rowKey upsert；不能把未知 rowKey 静默追加为新行。
- Rust 必须通过 FileChangeSetBuilder 构造 CSV 和关联 spec 文件 changes，并一次 apply。
- Rust 返回错误时前端只能显示保存失败，不能应用 rowKey 映射、dirty 清理、history 记录或缓存失效。
- File History Session 返回错误时前端只能显示保存失败，不能应用 rowKey 映射、dirty 清理或 CSV 草稿 history 清理。
- 保存编排必须在确认弹窗前结束当前单元格编辑，保证弹窗中候选和 dirty patch 来自同一个捕获状态。
- 保存编排必须在写盘前和写盘返回后校验捕获目标，目标不匹配时不得把旧结果写入当前 state。
- 关联 spec 候选 key 必须保持 table、动作类型和业务 ID 的结构边界，不能依赖分隔符拼接。
- 前端不得为关联 spec 生成 relPath、默认文本或 ID 字段；只有用户确认后进入 associatedSpecs 的动作才允许由后端转成文件 changes。
- 前端不得用本地表枚举决定关联 spec 写盘能力；候选推导必须消费 ProjectManifest 中由后端返回的 associatedSpecTables。

## 陷阱

- 把关联 spec 候选自动写入 associatedSpecs，会绕过用户确认并把可选 spec 操作变成隐式磁盘写入。
- 把保存确认回调里的目标改为重新读取 active Mod 或 active table，会在弹窗期间切换 Mod、切表或重载 session 后写错目标。
- 把 CSV 保存拆成 CSV 写盘和关联 spec 写盘两次 changeset，会破坏一次保存只产生一条文件级 history 的边界。
- 把前端 rows 整表提交给后端，会绕过 rowKey patch、session baseline 和后端未知 rowKey 校验。
- 把临时新建 rowKey 直接保留为保存后的正式 rowKey，会让后续 dirty、选择、草稿 history 和窗口 query 对不上后端 session。
- 忽略 `previousId` 会把 ID 变更误处理成只创建新 spec，旧 spec 会残留在磁盘和 history 中。
- 在 Rust 中用字符串替换改旧 spec ID，会破坏 Starsector JSON-like 文件的解析边界和内部字段清理规则。
- 在保存失败后清空 dirty 或草稿 history，会让未写盘编辑在界面上消失。
- 在 `result.changes.length === 0` 时记录 file history，会产生不可回放的空保存历史。
- 用前端路径拼接替代后端实体定义和 FileChangeSetBuilder 相对路径校验，会允许绝对路径、父级跳出或非法相对路径污染 Mod 外文件。
- 用 tableKey 推断 invalidation.paths，会漏掉关联 spec 新路径、旧路径或未来扩展的多文件变更。
