# 武器编辑器模块

## 定义

武器编辑器模块负责在独立编辑器窗口中读取、编辑、导入、保存和同步单个 `.wpn` spec 及其预览所需派生数据。

## 参考

- `src/app/EditorWindowContent.vue`：解析编辑器窗口 URL 参数，按 `kind=weapon` 挂载武器编辑器并打开弹体编辑器或发射预览窗口。
- `src/app/components/editors/WeaponEditor.vue`：拥有 `.wpn` 本地草稿、炮塔/固定视图、发射点画布交互、贴图字段、检查器和局部 undo/redo。
- `src/app/components/editors/WeaponFirePreview.vue`：消费 weapon bundle 的 `.wpn`、CSV row、关联 projectile specs 和贴图 data URL 执行只读发射预览。
- `src/app/composables/use-draft-session.ts`：拥有编辑器窗口主 `.wpn` spec 的 base、draft、dirty、外部更新暂存和 draft revision。
- `src/app/composables/use-editor-window-view-model.ts`：拥有编辑器窗口目标、weapon bundle 读取、缺失 spec 处理、保存编排、弹体依赖刷新和缓存失效响应。
- `src/domain/editors/editor-definitions.ts`：定义编辑器窗口 UI 定义表，包含窗口尺寸、标题、默认数据和缺失目标文案。
- `src/domain/editors/lib/normalize.ts`：定义武器 spec 进入编辑器前的发射点数组归一化。
- `src/domain/editors/lib/weapon-sprite-fields.ts`：定义武器贴图字段集合、炮塔/固定视图字段分组和绘制顺序。
- `src/domain/tables/associated-specs.ts`：定义 weapons 行关联 `.wpn` 文本入口路径、武器编辑器入口和发射预览入口；关联 `.wpn` 写盘路径、扩展名、ID 字段和默认内容由后端实体/spec definition 拥有。
- `src/domain/tables/table-detail-actions.ts`：从 weapons 表格行生成武器编辑器窗口入口、发射预览入口和文件编辑器入口，并保证文件编辑器入口排在操作栏最下方。
- `src/orchestrators/editor-window.orchestrator.ts`：封装编辑器 spec 保存事件的窗口广播和监听。
- `src/orchestrators/file-history-session.orchestrator.ts`：在主窗口保存事件链路中完成文件级 history 记录、ProjectSession 刷新和保存完成边界。
- `src/orchestrators/file-save.orchestrator.ts`：在主窗口消费编辑器保存事件并转交 File History Session。
- `src/services/editor.service.ts`：封装 weapon entity bundle 读取、弹体依赖读取、贴图资源加载、导入 spec 读取和 spec 保存 service。
- `src/shared/api/files-api.ts`：封装 `load_imported_editor_spec_file` 和 `save_editor_spec` Tauri command。
- `src/shared/lib/starsector.ts`：定义缺失 `.wpn` 时由 weapon CSV row 派生的默认武器 spec。
- `src/windows/editor.window.ts`：定义武器编辑器和发射预览窗口请求、窗口单例 key、URL 参数和窗口尺寸。
- `src-tauri/src/commands/editor_config.rs`：校验保存命令的 ProjectSession 归属并调用 Rust editor spec service。
- `src-tauri/src/services/editor_config/spec_files.rs`：按后端实体/spec definition 定位、读取、校验、写入 `.wpn` 文件并构造 changeset。
- `src-tauri/src/services/project/query/entities.rs`：从 ProjectSession 的 weapon CSV 注册行构造 weapon entity、`.wpn` spec 和 CSV row。
- `src-tauri/src/services/project/resources/refs.rs`：从武器贴图字段构造 weapon `ResourceRef`。

## 边界

- DetailPane 只生成 weapons 行的编辑和预览入口，不拥有武器窗口状态、`.wpn` 草稿或预览运行态。
- EditorWindowContent 只解析窗口参数、选择组件、转发保存事件和打开关联窗口，不拥有 weapon entity query、保存、history 或资源缓存。
- Rust editor spec service 拥有 `.wpn` spec definition、目标定位、候选目录遍历、候选 spec 解析、路径安全、ID 校验、JSON pretty 写入和 changeset 构造。
- Rust files command 拥有 `save_editor_spec` 写入前的 `sessionId + modRoot` 校验。
- Rust ProjectSession query 拥有 weapon entity 的注册边界：weapon entity 必须来自 `weapon_data.csv` 的正式注册行。
- WeaponEditor 组件拥有武器编辑界面的本地草稿、炮塔/固定视图、发射点选择、拖拽状态、贴图字段输入、检查器展开状态和局部历史。
- 编辑器窗口 ViewModel 通过 Draft Session 拥有 `.wpn` 的基准 spec、当前 draft、dirty 状态、外部更新暂存和 draft revision。
- WeaponEditor 组件只通过 `draft-changed` 汇报本地 working copy，并通过 `save-requested` 请求保存当前 ViewModel draft，不调用 shared API、write service 或 history store。
- WeaponFirePreview 只消费传入的 `.wpn`、weapon CSV row、弹体 specs 和贴图 data URL，不保存任何文件。
- 主窗口保存事件监听只消费 `editor-spec-saved`，不拥有编辑器窗口草稿、弹体缓存或预览状态。
- 武器 entity bundle 读取归属 editor service；组件不得直接调用 query service、resource cache 或 Tauri command。
- 武器缺失 `.wpn` 的新建、导入和取消流程归属编辑器窗口 ViewModel，不归属 WeaponEditor 组件。
- 武器贴图上传归属 sprite upload 链路；上传可更新本地贴图字段和预览，但不等同于 `.wpn` 保存。
- 武器窗口的弹体编辑入口只打开 projectile 独立窗口；武器窗口不保存 `.proj`。
- 武器窗口的发射预览入口只打开 weapon-preview 独立窗口；预览窗口不参与 `.wpn` 保存链路。
- 武器窗口局部 undo/redo 只覆盖窗口内 `.wpn` 草稿，不进入文件级 history。
- 资源 data URL 和 projectile options 是 weapon bundle 的派生显示输入，不属于 `.wpn` 写入数据。

## 链路

### 打开武器编辑器

1. 用户在 weapons 表格选中非注释行。
2. 详情面板调用表格详情 action domain。
3. 表格详情 action domain 从行数据提取武器 ID，生成 `kind=weapon` 的 editor window action、发射预览 action，并追加关联 `.wpn` 文本 file editor action。
4. 用户触发武器编辑器 action 后，主窗口 shell action 调用通用编辑器窗口打开入口。
5. 窗口模块按 `weapon + modRoot + id` 单例化编辑器窗口并写入 URL 参数。
6. 新窗口挂载编辑器窗口应用。
7. EditorWindowContent 解析 `kind`、`sessionId`、`modRoot`、`id` 和设置参数。
8. 编辑器窗口 ViewModel 初始化事件监听和缓存失效订阅。
9. 编辑器窗口 ViewModel 调用 editor service 查询 weapon bundle。
10. editor service 通过 ProjectSession entity query 读取 weapon entity。
11. Rust ProjectSession query 确认目标 ID 存在于 `weapon_data.csv` 注册行。
12. Rust ProjectSession query 返回 `spec`、`csvRow` 和武器贴图字段 resource refs。
13. editor service 校验 `spec` 和 `csvRow` 是对象。
14. editor service 按 `projectileSpecId` 查询已关联 projectile entity。
15. editor service 查询 projectile entity-list 生成 projectile options。
16. editor service 按武器贴图 resource refs 查询 data URL。
17. EditorWindowContent 将 `.wpn`、CSV row、弹体 specs、projectile options 和贴图 data URL 传入 WeaponEditor。

### 缺失武器 spec

1. Rust weapon entity query 返回已注册 weapon 的空 `spec` 对象。
2. editor service 将 bundle 标记为 `isNew=true`。
3. 编辑器窗口 ViewModel 在首次加载时提示用户新建、导入或取消。
4. 用户选择新建时，ViewModel 保留空 spec bundle。
5. EditorWindowContent 用目标 ID 和 weapon CSV row 派生默认 weapon spec。
6. 用户选择导入时，ViewModel 通过文件选择得到路径。
7. ViewModel 调用 editor service 的导入读取入口。
8. shared files API 调用 Rust `load_imported_editor_spec_file`。
9. Rust editor spec service 校验导入路径是无 `..` 的绝对路径且扩展名为 `.wpn`。
10. Rust 解析 JSON-like spec 并返回对象。
11. ViewModel 将导入对象写入当前 weapon bundle。
12. 用户取消时，ViewModel 关闭当前编辑器窗口。

### 保存武器 spec

1. 用户在 WeaponEditor 触发保存。
2. WeaponEditor emit `save-requested` 并传出当前 `.wpn` 草稿。
3. EditorWindowContent 调用编辑器窗口 ViewModel 的保存入口。
4. ViewModel 捕获窗口目标 `sessionId + modRoot + id`。
5. ViewModel 调用 editor service 的 `saveEditorSpecByKind()`。
6. editor service 校验保存上下文并保证 `id` 字段存在。
7. write service 调用 shared files API 的 `save_editor_spec`。
8. Rust files command 校验 `sessionId + modRoot`。
9. Rust editor spec service 校验武器 ID 并在 `data/weapons` 中定位已存在 `id` 匹配的 `.wpn`。
10. Rust editor spec service 剥离内部字段、写入 pretty JSON 文本并返回 `WriteResult`。
11. ViewModel 通过 Draft Session 将保存后的 spec 提升为本窗口草稿基准，清空 dirty 和外部更新暂存。
12. ViewModel 广播 `editor-spec-saved`，携带 `sessionId + modRoot + kind + id + spec + WriteResult`。
13. 主窗口保存事件监听把保存事件交给 File History Session。
14. File History Session 校验当前 manifest session 仍匹配后记录文件级 history。
15. File History Session 按 `WriteResult.invalidation.paths` 刷新 ProjectSession 并广播 session invalidation。

### 刷新武器窗口派生数据

1. 主窗口或其它编辑器窗口完成写入并广播 ProjectSession refresh 事件。
2. 武器编辑器窗口接收与当前 `sessionId + modRoot` 匹配的 refresh 事件。
3. 编辑器窗口 ViewModel 将 refresh event 应用于本窗口 query cache 和 resource cache。
4. query cache 事件命中当前 weapon entity detail 时，ViewModel 重新查询 weapon bundle；dirty 为 false 时通过 Draft Session 更新 draft，dirty 为 true 时暂存外部 spec 并保留当前 draft。
5. query cache 事件命中已加载 projectile detail 时，ViewModel 只刷新 `projectileSpecs`。
6. query cache 事件命中 projectile entity-list 时，ViewModel 只刷新 `projectileOptions`。
7. resource cache 事件命中当前 bundle 的 weapon resource refs 时，ViewModel 只刷新 `weaponSpriteData`。
8. 派生刷新返回后，ViewModel 校验 request id、bundle identity 和窗口目标仍一致。
9. ViewModel 更新弹体依赖、projectile options 或贴图 data URL；派生刷新不得改变 `.wpn` draft revision。

### 打开关联弹体

1. 用户在 WeaponEditor 的 projectile 区触发编辑弹体。
2. WeaponEditor emit `editProjectile` 并传出 `projectileSpecId`。
3. EditorWindowContent 校验 projectile ID 和当前窗口目标存在。
4. EditorWindowContent 调用 projectile 编辑器窗口打开入口。
5. 窗口模块按 `projectile + modRoot + projectileId` 单例化弹体编辑器窗口。

### 打开发射预览

1. 用户在 WeaponEditor 的 projectile 或 beam 区触发预览。
2. WeaponEditor emit `preview` 并传出 weapon ID。
3. EditorWindowContent 校验 weapon ID 和当前窗口目标存在。
4. EditorWindowContent 调用 weapon-preview 窗口打开入口。
5. 预览窗口使用与 weapon editor 相同的 weapon bundle 读取链路。
6. WeaponFirePreview 以 `.wpn`、weapon CSV row、projectile specs 和贴图 data URL 运行只读发射模拟。

### 上传武器贴图

1. 用户在 WeaponEditor 的任一武器贴图字段选择 PNG 文件。
2. WeaponEditor 将文件读取为 base64，并以 `subfolder=weapons` 调用 sprite upload composable。
3. sprite upload orchestrator 调用 editor service。
4. editor service 通过 write service 调用 sprite upload API。
5. Rust 资源写入链路返回上传状态和 `WriteResult`。
6. 上传成功且存在 changeset 时，sprite upload orchestrator 广播 `sprite-upload-saved`。
7. 主窗口保存事件监听把贴图保存事件交给 File History Session，完成文件级 history 记录和 ProjectSession 刷新。
8. WeaponEditor 上传回调用返回路径更新本地贴图字段，并用本次 data URL 刷新对应贴图预览。

## 规范

- `.wpn` 保存 payload 必须携带 `sessionId`、`modRoot`、`kind=weapon`、目标 ID 和完整 spec 对象。
- `.wpn` 保存只允许写入目标 `.wpn` 文件，不得隐式写入 `weapon_data.csv`、`.proj` 或其它关联文件。
- `barrelMode`、`animationType`、`specClass`、`type`、`size`、发射点 offsets、发射角 offsets、贴图字段、beam 字段和 sound 字段必须保留为武器检查器的正式编辑面。
- `hardpointOffset` 和 `turretOffset` 的坐标数组必须以每两个数字表示一个发射点，角度数组按同一 index 对齐。
- `isNew=true` 对 weapon 表示目标 ID 已由 `weapon_data.csv` 注册但 `.wpn` spec 缺失。
- `projectileOptions` 只来自 projectile entity-list；不得从当前 `.wpn` 文本或 CSV row 拼接候选列表。
- `projectileSpecId` 缺失或关联 projectile entity 缺失时，`projectileSpecs` 必须保持缺失，不得构造空 projectile spec。
- `spriteName` 类武器贴图字段上传回填只修改窗口内本地草稿；只有用户保存 `.wpn` 后才写入 `.wpn`。
- `WEAPON_SPRITE_FIELDS`、炮塔/固定字段分组和绘制顺序必须由同一 domain 定义供编辑器和预览复用。
- Rust 定位 `.wpn` 时，`data/weapons` 不是目录、候选遍历失败、候选 `.wpn` 读取失败或解析失败必须返回错误。
- Rust 保存前必须先校验目标 ID 是配置 ID 正向模型接受的单段 ID。
- Rust 写入 `.wpn` 前必须剥离 schema 或编辑器内部字段。
- WeaponEditor 的未选中发射点、hover 发射点、active 发射点和检查器锁定目标必须以 null 表达。
- WeaponEditor 的局部 undo/redo 上限和栈内容只保存在编辑器窗口内存中，不持久化。
- WeaponEditor 只能在 `draftRevision` 变化时用父级 draft 重置本地 working copy；贴图 data URL、projectile options 和已加载 projectile specs 变化不得重置本地 working copy。
- 当前 `.wpn` dirty 时，外部保存或主实体失效只能写入待载入外部版本提示，不能覆盖当前 draft。
- WeaponFirePreview 必须保持只读，不得发出 `save-requested`、`editor-spec-saved` 或 sprite upload saved 事件。
- ViewModel 接收异步 bundle、弹体依赖或资源刷新结果前必须校验 request id、bundle identity 和当前窗口目标。
- 保存事件必须携带 `sessionId + modRoot + kind + id + spec + WriteResult`，不得只广播文件路径或 ID。
- 主窗口记录 `.wpn` 保存 history 前必须确认 `modRoot` 仍加载且 session ID 与保存事件一致。
- 资源 cache 失效只刷新 `weaponSpriteData`，不得覆盖未保存的 `.wpn` 本地草稿。
- weapon entity 查询中 `weapon_data.csv` 的空行和注释行不产生实体；非注释注册行缺少 `id` 必须返回错误。
- weapon entity 详情查询只允许返回 `weapon_data.csv` 正式注册的武器；未注册 `.wpn` 必须返回 null。

## 陷阱

- 把 `.wpn` 保存接到 CSV 保存链路，会把 spec 保存错误地绑定到表格 dirty 状态。
- 把贴图上传成功当作 `.wpn` 已保存，会丢失贴图字段回填后的草稿修改。
- 候选 `.wpn` 解析失败时继续写默认路径，会在损坏文件旁创建重复 spec。
- 用空字符串或负数索引表示未选中发射点，会污染拖拽、删除和角度编辑语义。
- 在 WeaponEditor 组件中直接调用 shared files API，会绕过窗口 ViewModel 的保存事件、history 和 session invalidation。
- 在 projectile options 变化时重查完整 weapon bundle，会覆盖窗口内未保存的 `.wpn` 草稿。
- 在资源 data URL 失效时重置完整 weapon bundle，会覆盖窗口内未保存的 `.wpn` 草稿。
- 在 dirty 状态下把外部保存事件直接应用到 WeaponEditor props，会覆盖窗口内未保存的 `.wpn` 草稿。
- 只用文件名定位保存目标会忽略已有嵌套 `.wpn` 中的正式 `id`。
- 主窗口不校验 session 就记录保存事件，会把已关闭或重载 Mod 的 changeset 写入错误 history。
- 预览窗口写入 `.wpn`、`.proj` 或 CSV 会破坏只读预览边界。
