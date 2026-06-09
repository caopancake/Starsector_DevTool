# 战术系统编辑器模块

## 定义

战术系统编辑器是在独立窗口中读取、编辑、导入和保存单个 `.system` spec 的结构化表单模块。

## 参考

- `src/app/EditorWindowContent.vue`：按 `kind=system` 挂载系统编辑器，并把窗口 ViewModel 的 system bundle 转为组件输入。
- `src/app/components/editors/SystemEditor.vue`：拥有系统 spec 本地 draft、type 条件区段、额外字段编辑和保存事件。
- `src/app/composables/use-draft-session.ts`：拥有编辑器窗口主 `.system` spec 的 base、draft、dirty、外部更新暂存和 draft revision。
- `src/app/composables/use-editor-window-view-model.ts`：拥有编辑器窗口 query、缺失 spec 选择、保存、跨窗口 spec 同步和本窗口 cache 刷新。
- `src/domain/editors/lib/normalize.ts`：拥有系统 spec 进入组件前的结构默认值归一化。
- `src/orchestrators/file-history-session.orchestrator.ts`：在主窗口保存事件链路中完成文件级 history 记录、ProjectSession 刷新和保存完成边界。
- `src/orchestrators/file-save.orchestrator.ts`：在主窗口消费编辑器保存事件并转交 File History Session。
- `src/services/editor.service.ts`：拥有系统编辑器 entity bundle 查询、默认 spec 构造、导入入口和 spec 保存 service。
- `src/shared/api/files-api.ts`：封装 `save_editor_spec` 与 `load_imported_editor_spec_file` 的 Tauri command 调用形状。
- `src-tauri/src/commands/files.rs`：校验 `sessionId + modRoot` 属于同一 ProjectSession 后调用 editor spec service。
- `src-tauri/src/services/editor_specs.rs`：按 `EditorSpecKind::System` 定位、清理、写入和导入 `.system` JSON-like spec。
- `src-tauri/src/services/project/cache/invalidation.rs`：按 `.system` 写盘路径刷新 ProjectSession 的 system spec 索引和统计。

## 边界

- CSV 表格详情只能作为打开系统编辑器的入口消费者，不拥有 `.system` draft、导入或保存语义。
- ProjectSession 拥有已加载 `.system` entity 索引，系统编辑器只能通过 entity query 消费该索引。
- Rust command 层只接收 payload、校验 session 与 Mod 归属并调用 service，不解析 system 字段。
- Rust editor spec service 拥有 `.system` 目标定位、ID 校验、内部字段剔除、文本渲染和 changeset 写盘。
- SystemEditor 组件拥有本窗口本地 draft、折叠区段、type 条件显隐和结构化字段集合。
- 编辑器窗口 ViewModel 通过 Draft Session 拥有 `.system` 的基准 spec、当前 draft、dirty 状态、外部更新暂存和 draft revision。
- SystemEditor 组件只能通过 `draft-changed` 汇报本地 working copy 并 emit 保存请求，不能调用 shared API、service、orchestrator 或写入跨窗口状态。
- `data/shipsystems/*.system` 是系统编辑器唯一持久化目标，不包含 `ship_systems.csv` 行、资源文件或其它 spec。
- `editor-spec-saved` 事件是编辑器窗口向主窗口和其它编辑器窗口同步保存结果的唯一窗口事件。
- `load_imported_editor_spec_file` 只读取用户选择的外部 `.system` 文件，不决定保存目标、不登记 history、不刷新 session。
- `modRoot + sessionId + systemId` 是系统编辑器窗口状态、事件消费和保存结果归属的身份边界。
- 主窗口拥有文件级 history 记录、ProjectSession refresh 和全局 query/resource cache 失效。
- 系统编辑器没有画布、资源 data URL、原版资源回退、sprite 上传或派生资源刷新职责。

## 链路

### 打开系统编辑器

1. 用户从 `ship_systems.csv` 关联入口触发打开系统编辑器。
2. 主窗口调用 `openSystemEditorWindow()` 并传入 `sessionId + modRoot + systemId + settings`。
3. 窗口管理按 `system + modRoot + systemId` 单例化编辑器窗口。
4. 编辑器窗口入口挂载 `EditorWindowContent`。
5. `EditorWindowContent` 创建 `useEditorWindowViewModel({ kind: 'system' })`。
6. ViewModel 调用 `queryEditorEntityBundle(sessionId, 'system', systemId)`。
7. editor service 调用 `querySessionEntity(sessionId, 'system', systemId)`。
8. Rust entity query 从 ProjectSession `system_files` 读取同 ID `.system` 数据。
9. service 返回 `SystemEditorEntityBundle`，存在 spec 时使用查询数据，缺失时使用 `{ id, type: 'STAT_MOD' }` 默认 spec。
10. `EditorWindowContent` 把 bundle 中的 `system` 传给 `SystemEditor`。
11. `SystemEditor` 通过 `normalizeSystemSpec()` 建立本地 draft。

### 导入缺失系统 spec

1. ViewModel 收到 `isNew: true` 且允许提示时弹出新建、导入或取消选择。
2. 用户选择导入后，窗口 runtime 只允许选择 `.system` 文件。
3. ViewModel 调用 `loadImportedSpecFile('system', path)`。
4. shared API 调用 `load_imported_editor_spec_file`。
5. Rust service 校验导入路径为绝对路径、路径不含父目录段且扩展名为 `.system`。
6. Rust 以 JSON-like 读取并解析导入文件。
7. ViewModel 将导入数据写入当前 `SystemEditorEntityBundle.system`，不写盘、不记录 history、不刷新 session。
8. ViewModel 通过 Draft Session 写入导入数据并递增 draft revision，`SystemEditor` 只在该 revision 变化时重新归一化本地 working copy。

### 保存系统 spec

1. 用户在 `SystemEditor` 点击保存。
2. `SystemEditor` emit `save-requested`。
3. ViewModel 读取当前 `.system` draft 并调用 `saveEditorSpecByKind(sessionId, modRoot, 'system', systemId, data)`。
4. editor service 校验 `modRoot` 和 `systemId`，并确保 `data.id` 存在。
5. shared API 调用 `save_editor_spec`。
6. Rust command 校验 `sessionId + modRoot` 仍属于同一 ProjectSession。
7. Rust editor spec service 以 `EditorSpecKind::System` 校验 ID 并扫描 `data/shipsystems` 下 `.system` 文件。
8. Rust 读取候选 `.system` 并按 `id` 字段定位既有文件；未找到时使用 `data/shipsystems/{id}.system`。
9. Rust 剔除内部字段，将 spec 渲染为 pretty JSON 文本。
10. Rust 构建单文件 changeset 并通过 file changeset replay 写盘。
11. Rust 返回包含 `changes` 与 `invalidation` 的 `WriteResult`。
12. ViewModel 通过 Draft Session 将保存后的 spec 提升为本窗口草稿基准，清空 dirty 和外部更新暂存。
13. ViewModel emit `editor-spec-saved`，事件携带 `kind + sessionId + modRoot + id + spec + writeResult`。

### 保存后同步

1. 主窗口通过窗口保存监听器接收 `editor-spec-saved`。
2. 主窗口确认当前 manifest 的 `sessionId` 与事件一致。
3. 主窗口将保存事件交给 File History Session。
4. File History Session 将 `WriteResult.changes` 记录为文件级 history，标签为保存的 `.system` 文件。
5. File History Session 按 `WriteResult.invalidation.paths` 调用 ProjectSession refresh。
6. Rust session invalidation 将 `.system` 路径归一到当前 Mod 范围。
7. Rust 重新加载 `data/shipsystems/*.system` 到 `session.system_files`。
8. Rust 更新 manifest 的 systems 统计与 `shipSystems` 表 entity 统计。
9. 主窗口更新 project store 中对应 manifest。
10. 主窗口广播 `project-session-invalidated` 并清理本地 query/resource cache。
11. 系统编辑器窗口收到 ProjectSession refresh 事件后按本窗口 `sessionId + modRoot` 清理本地 cache。
12. 若 query cache 失效包含当前 `system + systemId` entity detail，ViewModel 静默重新查询当前 system bundle；dirty 为 false 时更新 draft，dirty 为 true 时暂存外部 spec。
13. 其它系统编辑器窗口收到同一 `editor-spec-saved` 且身份匹配时，按 dirty 状态应用或暂存外部版本。

### 切换系统 type

1. 用户在 `SystemEditor` 改变 `type`。
2. 组件读取旧 type 与新 type。
3. 组件只删除旧 type 拥有且新 type 不拥有的专属字段。
4. 组件保留通用字段、额外字段和内部字段。
5. 组件写入新的 `type` 值。

## 规范

- 导入失败只影响当前编辑器窗口，不能创建保存结果、history 或 session invalidation。
- 额外字段必须由结构化字段集合之外、且非内部 JSON 字段的 key 构成。
- 缺失 `.system` 时，新建选择只建立本地默认 draft；只有保存链路允许写盘。
- 前端保存前只能补齐 `data.id`，不能决定最终磁盘路径。
- 切换 `type` 时只能清除旧类型专属字段，不能清除通用字段、额外字段或内部字段。
- 系统 spec entity query 只读取当前 Mod ProjectSession 的 `system_files`，不使用 Core fallback。
- 系统 spec 保存必须使用 `EditorSpecKind::System`，不能在 service 层用裸字符串决定目录或扩展名。
- 系统 spec 保存必须先校验 ID 为可移植配置 ID，再扫描候选目录和构建目标路径。
- 系统 spec 保存目标只能是 `data/shipsystems` 下 ID 匹配的既有 `.system` 或 `{id}.system` 新文件。
- 系统 spec 写盘结果必须以 Rust 返回的 `WriteResult` 为准，前端不得自行构造 changeset 或 invalidation.paths。
- 系统编辑器窗口保存成功后必须广播 `editor-spec-saved`，不能直接写主窗口 project store 或 file history。
- 系统编辑器组件的本地 draft 是窗口内临时状态，不持久化，不跨 Mod 复用。
- SystemEditor 只能在 `draftRevision` 变化时用父级 draft 重置本地 working copy。
- 当前 `.system` dirty 时，外部保存或主实体失效只能写入待载入外部版本提示，不能覆盖当前 draft。
- 系统编辑器组件允许在无效 JSON 编辑过程中保留文本输入状态，但无效 JSON 不能写入对应对象字段。
- 系统编辑器组件显示高度约束必须保证窗口体区域可滚动，避免表单内容溢出不可达。
- File History Session 记录 history 和刷新 session 时必须验证事件 `sessionId + modRoot` 仍匹配当前 manifest。
- 候选目录不是目录、候选遍历失败、候选 `.system` 读取失败或解析失败都必须作为保存错误返回。

## 陷阱

- 把 `ship_systems.csv` 行保存和 `.system` spec 保存合并，会污染 CSV 表格模块与 spec 编辑器的写入边界。
- 把导入文件当作最终保存路径，会绕过 Mod 内 `data/shipsystems` 的持久化边界。
- 把文件级 history 写在编辑器窗口内，会让独立窗口在 session 已切换后记录到错误 Mod。
- 按 `_` 前缀识别内部字段，会误删合法额外字段或保留真实内部字段污染写盘。
- 保存后只更新本窗口 draft 而不广播 `editor-spec-saved`，会导致主窗口 history、session cache 和其它窗口不同步。
- 在 dirty 状态下把外部保存事件直接应用到 SystemEditor props，会覆盖窗口内未保存的 `.system` 草稿。
- 在 type 切换时删除所有隐藏区段字段，会丢失跨 type 合法复用的通用系统参数。
- 遇到候选 `.system` 解析失败后改写默认 `{id}.system`，会隐藏已有文件错误并制造重复 ID。
