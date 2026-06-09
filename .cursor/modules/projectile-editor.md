# 弹体编辑器模块

## 定义

弹体编辑器模块负责在独立编辑器窗口中读取、编辑、导入、保存和同步单个 `.proj` spec。

## 参考

- `src/app/EditorWindowContent.vue`：解析编辑器窗口 URL 参数，按 `kind=projectile` 挂载弹体编辑器并转交保存事件。
- `src/app/components/editors/ProjectileEditor.vue`：拥有 `.proj` 本地草稿、projectile/missile 表单、通用 JSON 编辑、贴图上传入口和保存 emit。
- `src/app/composables/use-draft-session.ts`：拥有编辑器窗口主 `.proj` spec 的 base、draft、dirty、外部更新暂存和 draft revision。
- `src/app/composables/use-editor-window-view-model.ts`：拥有编辑器窗口目标、projectile bundle 读取、缺失 spec 处理、保存编排、保存事件应用和缓存失效响应。
- `src/domain/editors/editor-definitions.ts`：定义弹体编辑器窗口 kind、spec kind、标题、默认数据和缺失目标文案。
- `src/domain/editors/lib/normalize.ts`：定义弹体 spec 进入编辑器前的 engineSlots 字段归一化。
- `src/orchestrators/editor-window.orchestrator.ts`：封装编辑器 spec 保存事件的窗口广播和监听。
- `src/orchestrators/file-history-session.orchestrator.ts`：在主窗口保存事件链路中完成文件级 history 记录、ProjectSession 刷新和保存完成边界。
- `src/orchestrators/file-save.orchestrator.ts`：在主窗口消费编辑器保存事件并转交 File History Session。
- `src/orchestrators/sprite-upload.orchestrator.ts`：封装弹体贴图上传后的窗口保存事件广播。
- `src/services/editor.service.ts`：封装 projectile entity bundle 读取、导入 spec 读取、spec 保存和 sprite upload service。
- `src/shared/api/files-api.ts`：封装 `load_imported_editor_spec_file` 和 `save_editor_spec` Tauri command。
- `src/windows/editor.window.ts`：定义弹体编辑器窗口请求、窗口单例 key、URL 参数和窗口尺寸。
- `src-tauri/src/commands/editor_config.rs`：校验保存命令的 ProjectSession 归属并调用 Rust editor spec service。
- `src-tauri/src/services/editor_config/spec_files.rs`：按 spec kind 定位、读取、校验、写入 `.proj` 文件并构造 changeset。
- `src-tauri/src/services/project/projectiles.rs`：加载 Mod 和 Core 的 projectile specs，并用 Mod projectile 覆盖同 ID Core fallback。
- `src-tauri/src/services/project/query/entities.rs`：从 ProjectSession 的 projectile specs 构造 projectile entity 输出。

## 边界

- EditorWindowContent 只解析窗口参数、选择组件和转发事件，不拥有 projectile entity query、保存、history 或 ProjectSession 刷新。
- ProjectileEditor 组件拥有弹体编辑界面的本地草稿、结构化表单、通用 JSON 输入、展开状态和贴图上传触发。
- 编辑器窗口 ViewModel 通过 Draft Session 拥有 `.proj` 的基准 spec、当前 draft、dirty 状态、外部更新暂存和 draft revision。
- ProjectileEditor 组件只通过 `draft-changed` 汇报本地 working copy，并通过 `save-requested` 请求保存当前 ViewModel draft，不调用 shared API、write service 或 history store。
- Rust editor spec service 拥有 `.proj` 目标定位、候选目录遍历、候选 spec 解析、路径安全、ID 校验、JSON pretty 写入和 changeset 构造。
- Rust files command 拥有 `save_editor_spec` 写入前的 `sessionId + modRoot` 校验。
- Rust ProjectSession loader 拥有 projectile 的 Mod/Core 合并规则；Mod projectile 覆盖同 ID Core projectile。
- 主窗口保存事件监听只消费 `editor-spec-saved`，不拥有编辑器窗口草稿或弹体模型。
- 弹体 entity bundle 读取归属 editor service；组件不得直接调用 query service、resource cache 或 Tauri command。
- 弹体缺失 spec 的新建、导入和取消流程归属编辑器窗口 ViewModel，不归属 ProjectileEditor 组件。
- 弹体贴图上传归属 sprite upload 链路；上传可更新本地 sprite 字段，但不等同于 `.proj` 保存。
- 弹体窗口保存后的本窗口状态应用归属编辑器窗口 ViewModel，主窗口成功提示归属主窗口保存事件监听。
- 弹体窗口局部编辑状态只存在窗口内存中，不持久化为文件级 history。
- 武器编辑器和发射预览只消费弹体保存事件同步已加载 projectile specs，不拥有 `.proj` 保存目标。
- 窗口单例归属多窗口机制，弹体编辑器只消费 `kind + modRoot + id` 形成的目标身份。
- ProjectSession query 拥有 projectile entity 数据输出边界；前端不得自行扫描磁盘补 `.proj`。

## 链路

### 打开弹体编辑器

1. 用户在武器编辑器中触发编辑弹体。
2. WeaponEditor emit `editProjectile` 并传出 `projectileSpecId`。
3. EditorWindowContent 校验 projectile ID 和当前窗口目标存在。
4. EditorWindowContent 调用 projectile 编辑器窗口打开入口。
5. 窗口模块按 `projectile + modRoot + projectileId` 单例化编辑器窗口并写入 URL 参数。
6. 新窗口挂载编辑器窗口应用。
7. EditorWindowContent 解析 `kind`、`sessionId`、`modRoot`、`id` 和设置参数。
8. 编辑器窗口 ViewModel 初始化事件监听和缓存失效订阅。
9. 编辑器窗口 ViewModel 调用 editor service 查询 projectile bundle。
10. editor service 通过 ProjectSession entity query 读取 projectile entity。
11. Rust ProjectSession query 从 `projectile_specs` 读取目标 projectile spec。
12. editor service 校验 entity data 是对象。
13. EditorWindowContent 将 projectile spec 传入 ProjectileEditor。

### 缺失弹体 spec

1. editor service 查询 projectile entity 返回 null。
2. editor service 用目标 ID 构造默认 projectile spec 并标记 `isNew=true`。
3. 编辑器窗口 ViewModel 在首次加载时提示用户新建、导入或取消。
4. 用户选择导入时，ViewModel 通过文件选择得到路径。
5. ViewModel 调用 editor service 的导入读取入口。
6. shared files API 调用 Rust `load_imported_editor_spec_file`。
7. Rust editor spec service 校验导入路径是无 `..` 的绝对路径且扩展名为 `.proj`。
8. Rust 解析 JSON-like spec 并返回对象。
9. ViewModel 将导入对象写入当前 projectile bundle。
10. 用户取消时，ViewModel 关闭当前编辑器窗口。

### 保存弹体 spec

1. 用户在 ProjectileEditor 触发保存。
2. ProjectileEditor emit `save-requested`，由 ViewModel 读取当前 `.proj` draft。
3. EditorWindowContent 调用编辑器窗口 ViewModel 的保存入口。
4. ViewModel 捕获窗口目标 `sessionId + modRoot + id`。
5. ViewModel 调用 editor service 的 `saveEditorSpecByKind()`。
6. editor service 校验保存上下文并保证 `id` 字段存在。
7. write service 调用 shared files API 的 `save_editor_spec`。
8. Rust files command 校验 `sessionId + modRoot`。
9. Rust editor spec service 校验弹体 ID 并在 `data/weapons/proj` 中定位已存在 `id` 匹配的 `.proj`。
10. Rust editor spec service 剥离内部字段、写入 pretty JSON 文本并返回 `WriteResult`。
11. ViewModel 通过 Draft Session 将保存后的 spec 提升为本窗口草稿基准，清空 dirty 和外部更新暂存。
12. ViewModel 广播 `editor-spec-saved`，携带 `sessionId + modRoot + kind + id + spec + WriteResult`。
13. 主窗口保存事件监听把保存事件交给 File History Session。
14. File History Session 校验当前 manifest session 仍匹配后记录文件级 history。
15. File History Session 按 `WriteResult.invalidation.paths` 刷新 ProjectSession 并广播 session invalidation。

### 同步弹体保存事件

1. 任一弹体编辑器窗口广播 `editor-spec-saved`。
2. 其它编辑器窗口接收同一 `sessionId + modRoot` 的保存事件。
3. 弹体窗口在事件 ID 等于当前目标 ID 时，dirty 为 false 则通过 Draft Session 应用保存后的 projectile spec，dirty 为 true 则暂存外部 spec 并保留当前 draft。
4. 武器编辑器或发射预览窗口在事件 ID 已存在于当前 `projectileSpecs` 时更新对应 projectile spec。
5. 不相关窗口忽略该保存事件。

### 刷新弹体窗口

1. 主窗口或其它编辑器窗口完成写入并广播 ProjectSession refresh 事件。
2. 弹体编辑器窗口接收与当前 `sessionId + modRoot` 匹配的 refresh 事件。
3. 编辑器窗口 ViewModel 将 refresh event 应用于本窗口 query cache 和 resource cache。
4. query cache 事件命中当前 projectile entity detail 时，ViewModel 重新查询 projectile bundle。
5. bundle 查询返回后，ViewModel 校验 request id 和窗口目标仍一致。
6. dirty 为 false 时，ViewModel 通过 Draft Session 更新 projectile bundle 和 draft；dirty 为 true 时，ViewModel 暂存外部 spec 并保留当前 draft。

### 上传弹体贴图

1. 用户在 ProjectileEditor 的 projectile 或 missile 贴图字段选择 PNG 文件。
2. ProjectileEditor 将文件读取为 base64，并以 `subfolder=missiles` 调用 sprite upload composable。
3. sprite upload orchestrator 调用 editor service。
4. editor service 通过 write service 调用 sprite upload API。
5. Rust 资源写入链路返回上传状态和 `WriteResult`。
6. 上传成功且存在 changeset 时，sprite upload orchestrator 广播 `sprite-upload-saved`。
7. 主窗口保存事件监听把贴图保存事件交给 File History Session，完成文件级 history 记录和 ProjectSession 刷新。
8. ProjectileEditor 上传回调用返回路径更新本地 `bulletSprite` 或 `sprite` 字段。

## 规范

- `.proj` 保存 payload 必须携带 `sessionId`、`modRoot`、`kind=projectile`、目标 ID 和完整 spec 对象。
- `.proj` 保存只允许写入目标 `.proj` 文件，不得隐式写入 `.wpn`、`weapon_data.csv` 或其它关联文件。
- `engineSlots` 进入 ProjectileEditor 前必须归一化为数组。
- `id` 字段缺失时，editor service 只能用窗口目标 ID 填充当前保存 payload。
- `isNew=true` 只表示目标 projectile entity 未在 ProjectSession 中存在；保存路径仍由 Rust editor spec service 决定。
- Mod/Core projectile 合并时，Mod 同 ID projectile 必须覆盖 Core fallback。
- Rust 定位 `.proj` 时，`data/weapons/proj` 不是目录、候选遍历失败、候选 `.proj` 读取失败或解析失败必须返回错误。
- Rust 保存前必须先校验目标 ID 是配置 ID 正向模型接受的单段 ID。
- Rust 写入 `.proj` 前必须剥离 schema 或编辑器内部字段。
- Sprite upload 回填只修改窗口内本地草稿；只有用户保存 `.proj` 后才写入 `.proj`。
- `specClass=missile` 时表单必须保留 missile 外观、size、center、collisionRadius、engineSpec、engineSlots、explosionSpec 和时间字段。
- `specClass=projectile` 时表单必须保留 spawnType、bulletSprite、length、width、颜色、texture、collisionClass、fadeTime 和 hitGlowRadius 字段。
- 不识别的 `specClass` 必须通过通用 JSON 编辑入口保留完整对象。
- ViewModel 接收异步 bundle 返回前必须校验 request id 和当前窗口目标。
- ProjectileEditor 只能在 `draftRevision` 变化时用父级 draft 重置本地 working copy；sprite upload 回填以外的外部刷新不得覆盖本地 working copy。
- 当前 `.proj` dirty 时，外部保存或主实体失效只能写入待载入外部版本提示，不能覆盖当前 draft。
- 保存事件必须携带 `sessionId + modRoot + kind + id + spec + WriteResult`，不得只广播文件路径或 ID。
- 主窗口记录 `.proj` 保存 history 前必须确认 `modRoot` 仍加载且 session ID 与保存事件一致。
- 武器窗口同步 projectile 保存事件时，只能更新已加载的 `projectileSpecs[id]`，不得重查或覆盖当前 weapon spec 草稿。

## 陷阱

- 把 `.proj` 保存接到武器保存链路，会把弹体 spec 的持久化目标归属到 `.wpn`。
- 把贴图上传成功当作 `.proj` 已保存，会丢失 sprite 字段回填后的草稿修改。
- 候选 `.proj` 解析失败时继续写默认路径，会在损坏文件旁创建重复 spec。
- 在 ProjectileEditor 组件中直接调用 shared files API，会绕过窗口 ViewModel 的保存事件、history 和 session invalidation。
- 在弹体保存事件到达武器窗口时重查完整 weapon bundle，会覆盖武器窗口内未保存的 `.wpn` 草稿。
- 在 dirty 状态下把外部保存事件直接应用到 ProjectileEditor props，会覆盖窗口内未保存的 `.proj` 草稿。
- 保存 Core fallback projectile 时直接覆盖 Core 文件，会破坏当前 Mod 写入边界。
- 只用文件名定位保存目标会忽略已有嵌套 `.proj` 中的正式 `id`。
- 主窗口不校验 session 就记录保存事件，会把已关闭或重载 Mod 的 changeset 写入错误 history。
