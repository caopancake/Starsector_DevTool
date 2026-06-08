# 资源、贴图与原版资源回退系统

## 定义

资源系统负责 `ResourceRef` 生成、图片 data URL 批量读取、原版资源读取、原版索引扫描、贴图上传和写入后资源失效。

## 参考

- `src/app/composables/use-core-graphics.ts`：管理当前 Starsector root 的原版图片路径索引加载状态。
- `src/app/composables/use-core-schema.ts`：管理当前 Starsector root 的原版字段扫描状态并向 schema 合并层提供字段。
- `src/app/composables/use-sprite-upload.ts`：读取文件输入、生成 base64、处理覆盖确认并调用上传动作。
- `src/orchestrators/project-session-invalidation.orchestrator.ts`：在 ProjectSession 写入失效后按路径清理资源缓存和 query cache。
- `src/orchestrators/sprite-upload.orchestrator.ts`：执行贴图上传动作并在真实写入后广播保存事件。
- `src/services/editor.service.ts`：为独立编辑器查询资源 data URL，并把贴图上传返回值转换为上传状态。
- `src/services/resource-cache.service.ts`：前端资源 data URL 的唯一缓存入口和批量返回校验边界。
- `src/shared/api/assets-api.ts`：封装贴图上传、原版字段扫描和原版图片扫描 command。
- `src/shared/api/query-api.ts`：封装 ProjectSession 资源、source option、hull reference 和 entity query command。
- `src/shared/lib/resource-ref.ts`：提供 `ResourceRef` wire 校验和完整身份比较。
- `src-tauri/src/commands/assets.rs`：接收资源写入和原版扫描 payload，并在上传前校验 session 与 Mod root。
- `src-tauri/src/commands/project.rs`：接收资源批量 query、hull reference query 和 ProjectSession 失效 payload。
- `src-tauri/src/services/config/assets.rs`：执行贴图上传 changeset、原版字段扫描和原版图片路径扫描。
- `src-tauri/src/services/project/cache/core.rs`：按 Starsector root 归属缓存原版 CSV、舰船、武器、装配和皮肤索引。
- `src-tauri/src/services/project/query/resources_shared.rs`：生成 `ResourceRef` 并按资源来源读取 Mod 或原版图片。
- `src-tauri/src/services/project/sprites.rs`：校验资源相对路径并读取图片文件生成 data URL。

## 边界

- Canvas 和预览只消费已 hydrate 的 data URL，不拥有图片路径解析、资源来源判断或磁盘读取。
- core cache 只缓存原版 CSV 与 spec 索引，不缓存前端 data URL，不写入 Mod，不注册为可编辑 ProjectSession。
- core 字段与 core 图片索引由当前 Starsector root 拥有；root 变化时旧扫描结果不能发布到新 root 状态。
- 独立编辑器窗口可以发起贴图上传，但不能记录主窗口 file history，不能自行刷新主窗口 ProjectSession。
- 前端 API 只负责 command payload 组装，不解释 resource 来源、不生成 `ResourceRef`、不执行路径安全判断。
- 前端资源缓存只缓存 `query_resource_data_urls` 返回的 data URL，不读取文件，不补造 missing 图片，不改写 `ResourceRef`。
- 覆盖确认状态属于上传 UI；是否存在、是否覆盖、写入路径和 changeset 结果属于 Rust 上传 service。
- 原版资源读取只在当前 ProjectSession manifest 持有 Starsector root 时成立，不能由组件或 store 临时指定 root。
- 路径失效由 ProjectSession 失效链路拥有；资源缓存和 query cache 只能消费写入结果中的 invalidated paths。
- 批量资源 query 是图片 data URL 的正式读取入口；组件、ViewModel 和 schema renderer 不能直接调用 Rust 资源 command。
- 批量资源 query 的返回项必须和请求 `ResourceRef` 一一对应；前端缓存层负责校验完整身份后写入缓存。
- 贴图上传写盘只归 Rust changeset 链路拥有；前端不得创建目录、拼接目标路径或推断实际写入文件。
- `ResourceRef` 生成权归 Rust ProjectSession query；前端只能校验、比较、缓存和消费已有 `ResourceRef`。
- `ResourceRef.source=core` 只表达原版资源；`ResourceRef.source=mod` 表达当前 Mod 资源并允许 Rust 在读取时使用原版同路径资源。
- source option 与 hull reference option 只携带 `ResourceRef`，不携带 data URL；缩略图必须另走资源批量 query。

## 链路

### 加载资源 data URL

1. Rust entity query、CSV source option query、CSV row preview query 或 hull reference query 生成 `ResourceRef`。
2. 前端 ViewModel 或 schema runtime 收集当前界面需要显示的 `ResourceRef`。
3. `queryResourceDataUrls` 按 `sessionId + ResourceRef` 完整身份检查前端资源缓存。
4. 缺失项通过 `queryCached(sessionId, "resource-data-urls", { resources })` 合并同批请求。
5. `queryResourceDataUrlBatch` 调用 `query_resource_data_urls` command。
6. Rust command 读取 `ResourceDataUrlBatchPayload` 并进入 ProjectSession query service。
7. Rust 按 session 取得 ProjectSession，并在批量内部用完整资源身份去重。
8. `ResourceRef.source=mod` 时先读取 Mod root 下相对路径，再读取当前 session Starsector root 下 `starsector-core` 同相对路径。
9. `ResourceRef.source=core` 时读取当前 session Starsector root 下 `starsector-core` 相对路径。
10. 图片文件存在则返回 data URL，图片文件缺失则返回 `null`，路径非法或读取失败则返回错误。
11. Rust 返回携带完整 `ResourceRef` 身份字段的 entries。
12. 前端资源缓存校验 entries 数量和每项完整身份后写入缓存。
13. 调用方把 `null` 保持为缺图语义，最终展示层可以转换为空展示值。

### 加载原版字段

1. `useCoreSchema` 从设置或当前 ProjectSession manifest 取得 Starsector root。
2. root 为空时清空 core field 状态。
3. root 非空且未加载时调用 `queryCoreFields(root)`。
4. `scanCoreFields` 以 payload 对象调用 `scan_core_fields` command。
5. Rust 校验 Starsector root 为不含父级跳转的绝对路径。
6. Rust 扫描 `starsector-core` 下 faction、ship 和 weapon JSON 文件。
7. Rust 对 JSON 文件读取、遍历、解析和对象结构错误直接返回错误。
8. Rust 返回按文件类型归类的 `DiscoveredField[]`，字段类型使用 `DiscoveredFieldType`。
9. 前端只在当前 root 仍等于发起 root 时发布扫描结果。
10. 前端捕获错误时只在当前 root 未变化时清空状态并记录 app log。
11. schema 合并层消费 core fields，不拥有扫描、缓存或持久化。

### 加载原版图片索引

1. `useCoreGraphics` 从设置或当前 ProjectSession manifest 取得 Starsector root。
2. root 为空时清空图片路径索引状态。
3. root 非空且未加载时调用 `queryCoreGraphics(root)`。
4. `scanCoreGraphics` 以 payload 对象调用 `scan_core_graphics` command。
5. Rust 校验 Starsector root 为不含父级跳转的绝对路径。
6. Rust 遍历 `starsector-core/graphics` 下支持的图片扩展名文件。
7. Rust 返回相对 `starsector-core` 的图片路径列表。
8. 前端只在当前 root 仍等于发起 root 时发布图片路径列表。
9. 前端捕获错误时只在当前 root 未变化时清空状态并记录 app log。
10. schema field renderer 消费图片路径索引作为路径候选，不把索引写回 schema 或后端 wire 模型。

### 生成 ResourceRef

1. ProjectSession 打开时加载当前 Mod 的舰船、武器、弹体、系统、技能、装配和皮肤索引，并记录 Starsector root。
2. entity query 根据实体 kind 和实体字段调用 Rust 资源 helper 生成 `ResourceRef`。
3. 舰船和武器直接从对应 spec 的贴图字段生成 Mod `ResourceRef`。
4. 装配按 `hullId` 查找当前 Mod 舰船或皮肤并生成舰船缩略图 `ResourceRef`。
5. 皮肤优先使用自身 `spriteName`，否则按 `baseHullId` 使用基础舰船贴图生成缩略图 `ResourceRef`。
6. CSV row preview 只为有正式 owner id 的行生成行图标 `ResourceRef`。
7. CSV source option query 只在 source column 是实体 `id` 时为 option 生成 `ResourceRef`。
8. 非 ID 列拆出的 token option 不继承行图标。
9. hull reference query 合并当前 Mod 舰船、当前 Mod 皮肤、原版舰船和原版皮肤，并为 option 与 requested reference ids 生成 `ResourceRef`。
10. 原版舰船、武器、装配和皮肤索引读取通过 core cache 完成，读取错误作为 query 错误返回。
11. Rust 返回 `ResourceRef` wire 字段，前端只做类型校验、身份比较和资源 hydrate。

### 上传贴图

1. 用户在编辑器选择 `.png` 文件。
2. `useSpriteUpload` 读取文件名和 base64，并生成本地预览 data URL。
3. `uploadEditorSpriteAction` 调用 `uploadEditorSprite(sessionId, modRoot, filename, data, subfolder, overwrite=false)`。
4. shared API 以 `UploadSpritePayload` 调用 `upload_sprite` command。
5. Rust command 校验 `sessionId + modRoot` 仍属于同一个 ProjectSession。
6. Rust 上传 service 校验 `SpriteSubfolder`、`.png` 文件名、目标相对目录和覆盖语义。
7. 目标存在且不允许覆盖时，Rust 返回无 changes 的存在状态，不写盘。
8. UI 收到存在状态后通过确认对话框取得覆盖意图。
9. 覆盖确认后重新调用上传链路并提交 `overwrite=true`。
10. Rust 使用二进制单文件 changeset 写入或覆盖贴图。
11. Rust 返回 `WriteResult`，其中包含 changes、invalidated paths 和上传状态。
12. 上传动作只在 `ok=true` 且 changes 非空时广播 `sprite-upload-saved`。
13. 主窗口保存事件监听器校验事件的 `sessionId + modRoot` 仍匹配当前 manifest。
14. 主窗口记录文件级 history。
15. 主窗口按 invalidated paths 刷新 Rust ProjectSession。
16. 前端以刷新后的 manifest 清理资源缓存和 query cache。
17. 主窗口广播 ProjectSession invalidated 事件给独立窗口。

### 资源失效

1. 写入链路返回 `WriteResult.invalidatedPaths`。
2. session 失效编排过滤出属于目标 Mod root 的 changed paths。
3. `invalidateProject` 调用 Rust `invalidate_project_session`。
4. Rust 按 changed paths 清理 ProjectSession 内对应表、spec、manifest summary 或索引状态。
5. Rust 返回更新后的 ProjectManifest。
6. 前端 project store 替换该 Mod root 的 manifest。
7. 前端资源缓存按 `sessionId + mod resource relPath` 清理受影响 data URL。
8. 前端 query cache 按表、spec、实体、hull reference 和资源身份清理受影响 query。
9. query cache 发布路径级 invalidation event。
10. 持有已 hydrate data URL 的 ViewModel 根据资源身份 invalidation 重新加载。
11. ProjectSession invalidated 事件广播给其它窗口。

## 规范

- Canvas 或编辑器预览中的像素资源必须保持邻近采样。
- core cache key 必须使用校验后的 Starsector root 规范化路径，不得用原始字符串作为缓存身份。
- core cache 读取原版 CSV、ship、weapon、variant、skin 索引失败时必须向 query 返回错误。
- core 字段扫描和 core 图片扫描 command 必须使用 payload 对象作为 wire 边界。
- core 字段扫描返回的字段类型必须使用正式 `DiscoveredFieldType`，字段来源必须使用正式来源模型。
- core 图片扫描返回路径必须相对 `starsector-core`，不得返回绝对路径。
- hull reference query 的请求集合必须命名为 reference ids，因为值同时覆盖 ship hull id 和 skin hull id。
- ProjectSession 资源 data URL 只能通过统一资源缓存服务调用批量 query。
- `ResourceRef.ownerKind` 必须使用正式资源归属枚举。
- `ResourceRef.source` 必须使用正式资源来源枚举。
- `ResourceRef.source=core` 必须有当前 session 的 Starsector root；缺失 root 是状态错误。
- `ResourceRef.source=mod` 的图片读取必须先查当前 Mod，再查当前 session 的原版同路径资源。
- source option 和 hull reference option 的来源字段必须使用正式来源模型。
- source option 与 hull reference option 的缩略图必须从 option 的 `ResourceRef` 批量查询 data URL。
- Starsector root 进入 core 扫描、core cache 或 ProjectSession 原版读取前必须校验为不含 `..` 组件的绝对路径。
- 上传和覆盖二进制贴图必须进入文件级 history，使用二进制单文件 changeset。
- 上传贴图文件名必须按可移植 `.png` 文件名规则校验，不得替换字符、补扩展名或改写目标文件名。
- 上传贴图目标子目录必须显式提交 `SpriteSubfolder` 枚举。
- 写入后的路径失效必须先完成 Rust ProjectSession 刷新，再清理资源缓存和 query cache，最后广播窗口事件。
- 资源 data URL 缺失在 wire 和前端资源缓存中必须保持 `null`。
- 资源查询返回项必须携带完整 `ResourceRef` 身份字段。
- 资源缓存 key 必须包含 `sessionId`、`source`、规范化 `relPath`、`ownerKind`、`ownerId` 和 `key`。
- 资源读取路径必须是相对资源根的正式路径；绝对路径、带盘符路径和包含父级跳转的路径必须返回错误。
- 资源文件不存在返回 `null`；资源文件存在但读取失败必须返回错误。
- 资源批量 query 内部去重 key 必须保留字段结构边界，不能用分隔符拼接可变字段。

## 陷阱

- 把 data URL 写回 source option、hull reference option 或后端 wire 模型，会污染只读引用模型。
- 把 `ResourceRef` 构造放到前端，会绕过 Rust session 对来源、owner 和原版索引错误的正式判断。
- 把 core 扫描失败当作空集合，会隐藏原版文件遍历、解析或结构错误。
- 把 core 图片路径当作可编辑 Mod 文件，会破坏原版只读边界。
- 把独立窗口上传结果直接写入 file history，会绕过主窗口对当前 manifest 的 session 校验。
- 只按数组下标缓存资源批量返回，会在后端返回身份错位时污染图片缓存。
- 用空字符串表示缺图，会混淆“未查询”“查询缺失”和“最终 UI 空展示”。
- 用 hull ids 命名 hull reference 请求集合，会掩盖 skin hull id 与 ship hull id 共用引用入口的事实。
- 用裸字符串扩展 resource source、owner kind、source origin 或 hull reference kind，会破坏跨端枚举边界。
- 在上传 service 校验前创建目录或写入文件，会让失败输入留下没有 changeset 记录的磁盘副作用。
