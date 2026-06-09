# 舰船编辑器模块

## 定义

舰船编辑器模块负责在独立编辑器窗口中读取、编辑、导入、保存和同步单个 `.ship` spec。

## 参考

- `src/app/EditorWindowContent.vue`：解析编辑器窗口 URL 参数，按 `kind=ship` 挂载舰船编辑器并转交保存事件。
- `src/app/components/editors/ShipEditor.vue`：拥有 `.ship` 本地草稿、画布交互、检查器控件、窗口内 undo/redo 和舰船贴图上传入口。
- `src/app/composables/use-draft-session.ts`：拥有编辑器窗口主 `.ship` spec 的 base、draft、dirty、外部更新暂存和 draft revision。
- `src/app/composables/use-editor-window-view-model.ts`：拥有编辑器窗口目标、bundle 读取、缺失 spec 处理、保存编排、保存事件应用和缓存失效响应。
- `src/domain/editors/editor-definitions.ts`：定义编辑器窗口 UI 定义表，包含窗口尺寸、标题、默认数据和缺失目标文案。
- `src/domain/editors/lib/normalize.ts`：定义舰船 spec 进入编辑器前的数组和对象字段归一化。
- `src/domain/tables/associated-specs.ts`：定义 ships 行关联 `.ship` 文本入口路径和舰船编辑器入口 kind；关联 `.ship` 写盘路径、扩展名、ID 字段和默认内容由后端实体/spec definition 拥有。
- `src/domain/tables/table-detail-actions.ts`：从 ships 表格行生成舰船编辑器窗口入口和文件编辑器入口，并保证文件编辑器入口排在操作栏最下方。
- `src/orchestrators/editor-window.orchestrator.ts`：封装编辑器 spec 保存事件的窗口广播和监听。
- `src/orchestrators/file-history-session.orchestrator.ts`：在主窗口保存事件链路中完成文件级 history 记录、ProjectSession 刷新和保存完成边界。
- `src/orchestrators/file-save.orchestrator.ts`：在主窗口消费编辑器保存事件并转交 File History Session。
- `src/services/editor.service.ts`：封装舰船 entity bundle 读取、贴图资源加载、导入 spec 读取和 spec 保存 service。
- `src/shared/api/files-api.ts`：封装 `load_imported_editor_spec_file` 和 `save_editor_spec` Tauri command。
- `src/shared/lib/starsector.ts`：定义新建舰船默认 spec 和基础字段读取工具。
- `src/windows/editor.window.ts`：定义舰船编辑器窗口请求、窗口单例 key、URL 参数和窗口尺寸。
- `src-tauri/src/commands/editor_config.rs`：校验保存命令的 ProjectSession 归属并调用 Rust editor spec service。
- `src-tauri/src/services/editor_config/spec_files.rs`：按后端实体/spec definition 定位、读取、校验、写入 `.ship` 文件并构造 changeset。
- `src-tauri/src/services/project/query/entities.rs`：从 ProjectSession 的 ship entity 输出 `.ship` spec 和资源引用。
- `src-tauri/src/services/project/resources/refs.rs`：从 `spriteName` 构造舰船贴图 `ResourceRef`。

## 边界

- DetailPane 只生成 ships 行的编辑入口，不拥有舰船编辑器窗口状态或 `.ship` 草稿。
- EditorWindowContent 只解析窗口参数、选择组件和转发事件，不拥有 entity query、保存、history 或 ProjectSession 刷新。
- Rust editor spec service 拥有 `.ship` spec definition、目标定位、候选目录遍历、候选 spec 解析、路径安全、ID 校验、JSON pretty 写入和 changeset 构造。
- Rust files command 拥有 `save_editor_spec` 写入前的 `sessionId + modRoot` 校验。
- ShipEditor 组件拥有舰船编辑界面的本地草稿、画布选择、拖拽状态、hover 状态、检查器展开状态、贴图尺寸显示和局部历史。
- 编辑器窗口 ViewModel 通过 Draft Session 拥有 `.ship` 的基准 spec、当前 draft、dirty 状态、外部更新暂存和 draft revision。
- ShipEditor 组件只通过 `draft-changed` 汇报本地 working copy，并通过 `save-requested` 请求保存当前 ViewModel draft，不调用 shared API、write service 或 history store。
- 主窗口保存事件监听只消费 `editor-spec-saved`，不拥有编辑器窗口草稿或资源派生状态。
- 舰船 entity bundle 读取归属 editor service；组件不得直接调用 query service、resource cache 或 Tauri command。
- 舰船缺失 spec 的新建、导入和取消流程归属编辑器窗口 ViewModel，不归属 ShipEditor 组件。
- 舰船贴图上传归属 sprite upload 链路；上传可更新本地 `spriteName` 和预览，但不等同于 `.ship` 保存。
- 舰船窗口保存后的本窗口状态应用归属编辑器窗口 ViewModel，主窗口成功提示归属主窗口保存事件监听。
- 舰船窗口局部 undo/redo 只覆盖窗口内 `.ship` 草稿，不进入文件级 history。
- 资源 data URL 是 `.ship` entity 的派生显示输入，不属于 `.ship` 写入数据。
- 窗口单例归属多窗口机制，舰船编辑器只消费 `kind + modRoot + id` 形成的目标身份。
- ProjectSession query 拥有 ship entity 数据和 `resourceRefs.sprite` 的输出边界；前端不得自行扫描磁盘补 `.ship`。

## 链路

### 打开舰船编辑器

1. 用户在 ships 表格选中非注释行。
2. 详情面板调用表格详情 action domain。
3. 表格详情 action domain 从行数据提取舰船 ID，生成 `kind=ship` 的 editor window action，并追加关联 `.ship` 文本 file editor action。
4. 用户触发舰船编辑器 action 后，主窗口 shell action 调用通用编辑器窗口打开入口。
5. 窗口模块按 `ship + modRoot + id` 单例化编辑器窗口并写入 URL 参数。
6. 新窗口挂载编辑器窗口应用。
7. EditorWindowContent 解析 `kind`、`sessionId`、`modRoot`、`id` 和设置参数。
8. 编辑器窗口 ViewModel 初始化事件监听和缓存失效订阅。
9. 编辑器窗口 ViewModel 调用 editor service 查询 ship bundle。
10. editor service 通过 ProjectSession entity query 读取 ship entity。
11. editor service 按 `resourceRefs.sprite` 查询贴图 data URL。
12. EditorWindowContent 将 `.ship` 数据和贴图 data URL 传入 ShipEditor。

### 缺失舰船 spec

1. editor service 查询 ship entity 返回 null。
2. editor service 用目标 ID 构造默认舰船 spec 并标记 `isNew=true`。
3. 编辑器窗口 ViewModel 在首次加载时提示用户新建、导入或取消。
4. 用户选择导入时，ViewModel 通过文件选择得到路径。
5. ViewModel 调用 editor service 的导入读取入口。
6. shared files API 调用 Rust `load_imported_editor_spec_file`。
7. Rust editor spec service 校验导入路径是无 `..` 的绝对路径且扩展名为 `.ship`。
8. Rust 解析 JSON-like spec 并返回对象。
9. ViewModel 将导入对象写入当前 ship bundle。
10. 用户取消时，ViewModel 关闭当前编辑器窗口。

### 保存舰船 spec

1. 用户在 ShipEditor 触发保存。
2. ShipEditor emit `save-requested` 并传出当前 `.ship` 草稿。
3. EditorWindowContent 调用编辑器窗口 ViewModel 的保存入口。
4. ViewModel 捕获窗口目标 `sessionId + modRoot + id`。
5. ViewModel 调用 editor service 的 `saveEditorSpecByKind()`。
6. editor service 校验保存上下文并保证 `hullId` 字段存在。
7. write service 调用 shared files API 的 `save_editor_spec`。
8. Rust files command 校验 `sessionId + modRoot`。
9. Rust editor spec service 校验舰船 ID 并在 `data/hulls` 中定位已存在 `hullId` 匹配的 `.ship`。
10. Rust editor spec service 剥离内部字段、写入 pretty JSON 文本并返回 `WriteResult`。
11. ViewModel 通过 Draft Session 将保存后的 spec 提升为本窗口草稿基准，清空 dirty 和外部更新暂存。
12. ViewModel 广播 `editor-spec-saved`，携带 `sessionId + modRoot + kind + id + spec + WriteResult`。
13. 主窗口保存事件监听把保存事件交给 File History Session。
14. File History Session 校验当前 manifest session 仍匹配后记录文件级 history。
15. File History Session 按 `WriteResult.invalidation.paths` 刷新 ProjectSession 并广播 session invalidation。

### 刷新舰船窗口派生数据

1. 主窗口或其它编辑器窗口完成写入并广播 ProjectSession refresh 事件。
2. 舰船编辑器窗口接收与当前 `sessionId + modRoot` 匹配的 refresh 事件。
3. 编辑器窗口 ViewModel 将 refresh event 应用于本窗口 query cache 和 resource cache。
4. query cache 事件命中当前 ship entity detail 时，ViewModel 重新查询 ship bundle。
5. resource cache 事件命中当前 bundle 的 resource refs 时，ViewModel 只刷新资源 data URL。
6. 派生刷新返回后，ViewModel 校验 request id、bundle identity 和窗口目标仍一致。
7. dirty 为 false 时，ViewModel 通过 Draft Session 更新完整 ship bundle 和 draft；dirty 为 true 时，ViewModel 暂存外部 spec 并保留当前 draft。
8. 资源刷新只更新 bundle 的 `shipSpriteData`，不得改变 `.ship` draft revision。

### 上传舰船贴图

1. 用户在 ShipEditor 选择 PNG 文件。
2. ShipEditor 将文件读取为 base64，并以 `subfolder=ships` 调用 sprite upload composable。
3. sprite upload orchestrator 调用 editor service。
4. editor service 通过 write service 调用 sprite upload API。
5. Rust 资源写入链路返回上传状态和 `WriteResult`。
6. 上传成功且存在 changeset 时，sprite upload orchestrator 广播 `sprite-upload-saved`。
7. 主窗口保存事件监听把贴图保存事件交给 File History Session，完成文件级 history 记录和 ProjectSession 刷新。
8. ShipEditor 上传回调用返回路径更新本地 `spriteName`，并用本次 data URL 刷新预览。

## 规范

- `.ship` 保存 payload 必须携带 `sessionId`、`modRoot`、`kind=ship`、目标 ID 和完整 spec 对象。
- `.ship` 保存只允许写入目标 `.ship` 文件，不得隐式写入 `ship_data.csv` 或其它关联文件。
- `center`、`shieldCenter`、`moduleAnchor`、武器槽坐标、引擎坐标和 bounds 坐标必须以 `.ship` spec 的正式坐标字段保存。
- `hullId`、`hullName`、`hullSize`、`style`、`width`、`height`、`spriteName`、`center`、`collisionRadius`、`shieldCenter`、`shieldRadius`、`weaponSlots`、`engineSlots`、`bounds`、`builtInMods`、`builtInWeapons`、`builtInWings`、`viewOffset`、`coversColor` 和 `moduleAnchor` 必须保留为舰船检查器的正式编辑面。
- `hullSize` 控件必须覆盖 `FRIGATE`、`DESTROYER`、`CRUISER`、`CAPITAL_SHIP` 和 `FIGHTER`。
- `isNew=true` 只表示目标 ship entity 未在 ProjectSession 中存在；保存路径仍由 Rust editor spec service 决定。
- `spriteName` 上传回填只修改窗口内本地草稿；只有用户保存 `.ship` 后才写入 `.ship`。
- `style` 和 engine `style` 控件必须允许常用选项和自定义 tag 输入。
- Rust 定位 `.ship` 时，`data/hulls` 不是目录、候选遍历失败、候选 `.ship` 读取失败或解析失败必须返回错误。
- Rust 保存前必须先校验目标 ID 是配置 ID 正向模型接受的单段 ID。
- Rust 写入 `.ship` 前必须剥离 schema 或编辑器内部字段。
- ShipEditor 的未选中项、hover 项、拖拽目标和检查器锁定目标必须以 null 表达。
- ShipEditor 的局部 undo/redo 上限和栈内容只保存在编辑器窗口内存中，不持久化。
- ShipEditor 只能在 `draftRevision` 变化时用父级 draft 重置本地 working copy；资源 data URL 变化不得重置本地 working copy。
- 当前 `.ship` dirty 时，外部保存或主实体失效只能写入待载入外部版本提示，不能覆盖当前 draft。
- ViewModel 接收异步 bundle 或派生资源刷新结果前必须校验 request id 和当前窗口目标。
- 保存事件必须携带 `sessionId + modRoot + kind + id + spec + WriteResult`，不得只广播文件路径或 ID。
- 主窗口记录 `.ship` 保存 history 前必须确认 `modRoot` 仍加载且 session ID 与保存事件一致。
- 资源 cache 失效只刷新 `shipSpriteData`，不得覆盖未保存的 `.ship` 本地草稿。

## 陷阱

- 把舰船编辑器保存接到 CSV 保存链路，会把 `.ship` spec 保存错误地绑定到表格 dirty 状态。
- 把贴图上传成功当作 `.ship` 已保存，会丢失 `spriteName` 回填后的草稿修改。
- 候选 `.ship` 解析失败时继续写默认路径，会在损坏文件旁创建重复 spec。
- 用空字符串或负数索引表示未选中画布目标，会污染拖拽和删除语义。
- 在 ShipEditor 组件中直接调用 shared files API，会绕过窗口 ViewModel 的保存事件、history 和 session invalidation。
- 在资源 data URL 失效时重置完整 ship bundle，会覆盖窗口内未保存的 `.ship` 草稿。
- 在 dirty 状态下把外部保存事件直接应用到 ShipEditor props，会覆盖窗口内未保存的 `.ship` 草稿。
- 只用文件名定位保存目标会忽略已有嵌套 `.ship` 中的正式 `hullId`。
- 主窗口不校验 session 就记录保存事件，会把已关闭或重载 Mod 的 changeset 写入错误 history。
