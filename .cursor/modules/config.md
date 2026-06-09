# 配置系统

## 定义

配置系统负责以 ProjectSession 为输入编辑、写入和刷新 `mod_info.json`、indexed config entity、装配与舰船皮肤配置实体。

## 参考

- `src/app/components/config/`：承载配置页容器、列表、详情表单、新建入口和删除确认入口，不直接拥有草稿会话。
- `src/app/composables/use-config-editor-draft-session.ts`：拥有配置编辑器接入 Edit Target Draft Session 的模块入口。
- `src/app/composables/use-config-faction-view-model.ts`：拥有 Faction 列表、选中 ID、创建、保存、删除和缓存失效响应。
- `src/app/composables/use-config-faction-editor-view-model.ts`：拥有 Faction 详情目标草稿、图片预览和外部更新暂存。
- `src/app/composables/use-config-mission-view-model.ts`：拥有 Mission 列表、选中 ID、创建、保存、删除和缓存失效响应。
- `src/app/composables/use-config-mission-editor-view-model.ts`：拥有 Mission 详情目标草稿、详情读取、图标预览和外部更新暂存。
- `src/app/composables/use-config-mod-info-view-model.ts`：拥有 `mod_info.json` 的目标草稿会话、保存入口和保存后的 manifest 字段同步。
- `src/app/composables/use-config-skin-view-model.ts`：拥有 Skin 列表、选中 ID、hull 引用、缩略图、创建、保存、删除和缓存失效响应。
- `src/app/composables/use-config-skin-editor-view-model.ts`：拥有 Skin 详情目标草稿和外部更新暂存。
- `src/app/composables/use-config-variant-view-model.ts`：拥有 Variant 列表、选中 ID、hull 引用、缩略图、创建、保存、删除和缓存失效响应。
- `src/app/composables/use-config-variant-editor-view-model.ts`：拥有 Variant 详情目标草稿和外部更新暂存。
- `src/domain/config/config-entities.ts`：定义配置默认数据、ID 规则、schema source 拆装、索引行、重命名上下文、写入草稿和 history label。
- `src/orchestrators/config-save.orchestrator.ts`：统一承接配置写入 action、解析 `refreshedEntity`，并把写入结果交给 File History Session 和 ProjectSession refresh 完成保存完成链路。
- `src/services/config-entity.service.ts`：封装配置 entity query、资源补图后的列表模型、写入 service 调用和 `WriteResult.refreshedEntity` 校验。
- `src/services/config-resource.service.ts`：封装 faction / mission / hull / skin 资源引用到 data URL 的补图。
- `src/shared/api/config-entity-api.ts`：封装 indexed entity、Variant 和 Skin 的 Tauri write command。
- `src/shared/api/files-api.ts`：封装 `mod_info.json` 使用的通用 `save_mod_files` command。
- `src/shared/api/query-api.ts`：封装配置列表和详情读取使用的 ProjectSession entity query command。
- `src-tauri/src/commands/editor_config.rs`：校验写入 payload 的 `sessionId + modRoot` 后调用 Rust Editor/Config backend。
- `src-tauri/src/domain/config.rs`：定义配置 ID、配置文件 relPath、VariantFile 和 SkinFile 的 Rust 正式模型。`src-tauri/src/domain/editor_config_definitions.rs`：集中定义 Editor/Config 与 ProjectSession 共享的 spec 目录、扩展名、id 字段和 invalid id 文案。
- `src-tauri/src/services/editor_config/indexed_entities.rs`：维护 Faction / Mission index CSV、目标文件或目录、changeset 和返回实体。
- `src-tauri/src/services/editor_config/skins.rs`：维护 `.skin` 单文件实体保存、新旧目标推导、删除 relPath 校验和文件内容 ID 校验，并消费 Rust domain spec definition。
- `src-tauri/src/services/editor_config/variants.rs`：维护 `.variant` 单文件实体保存、新旧目标推导、删除 relPath 校验和文件内容 ID 校验，并消费 Rust domain spec definition。
- `src-tauri/src/services/project/query/entities.rs`：从 ProjectSession 构造 Faction、Mission、Variant 和 Skin 的 query entity 输出。

## 边界

- 组件拥有表单渲染、用户事件和确认弹窗，不拥有 query、resource hydration、write、history、session invalidation 或草稿会话。
- 配置 domain 拥有默认配置对象、schema source 聚合与拆分、内部字段剥离、ID 字段提取、索引行构造、重复 ID 判断和重命名上下文。
- 配置保存 orchestrator 拥有配置写入 action 的跨层编排和 `refreshedEntity` 提取；文件级保存 history 记录和 ProjectSession 写后刷新归 File History Session。
- 配置 service 拥有配置 query 结果到前端记录的校验转换、资源补图调用、写入 service 调用和写入返回实体转换。
- Faction ViewModel 拥有 Faction 列表状态、选中 ID、创建保存删除动作和 entity/resource cache 失效响应；Faction Editor ViewModel 拥有详情目标草稿和 crest / logo 预览状态。
- Mission ViewModel 拥有 Mission 列表状态、选中 ID、创建保存删除动作和 entity/resource cache 失效响应；Mission Editor ViewModel 拥有详情读取入口、目标草稿和 icon 预览状态。
- `mod_info.json` ViewModel 通过 Edit Target Draft Session 拥有 `mod_info` schema 草稿、保存状态、schema runtime context、外部版本暂存和保存成功后的 `modInfo` 字段同步。
- Rust command 拥有写入前 `sessionId + modRoot` 校验；前端写后目标校验不能替代 Rust 写前校验。
- Rust indexed entity service 拥有 Faction / Mission 索引 CSV、目标文件或目标目录、ID 校验、索引命中校验和 changeset 构造。
- Rust ProjectSession query 拥有 Faction、Mission、Variant 和 Skin 的实体输出边界；前端不得自行扫描磁盘补实体。
- Rust Editor/Config backend 拥有 Skin 单文件保存、重命名和删除校验，路径、扩展名和 ID 文案来自 Rust domain spec definition。
- Rust Editor/Config backend 拥有 Variant 单文件保存、重命名和删除校验，路径、扩展名和 ID 文案来自 Rust domain spec definition。
- Skin ViewModel 拥有 Skin 列表状态、选中 ID、hull 引用选项、缩略图、创建保存删除动作和 entity/resource cache 失效响应；Skin Editor ViewModel 拥有详情目标草稿。
- Variant ViewModel 拥有 Variant 列表状态、选中 ID、hull 引用选项、缩略图、创建保存删除动作和 entity/resource cache 失效响应；Variant Editor ViewModel 拥有详情目标草稿。
- 文件级 history store 只消费配置保存链路提交的 changeset，不拥有配置页面、配置实体模型、manifest summary 或配置保存目标。
- ProjectManifest summary 和 modInfo 只来自 ProjectSession refresh 返回的完整 manifest；配置 ViewModel 不得反写 manifest。
- 资源补图只消费 ProjectSession entity 的 `resourceRefs` 和 hull reference query，不拥有配置实体草稿或写入数据。
- `mod_info.json`、Variant、Skin、Mission 和 Faction 详情编辑器通过配置草稿接入点消费 Edit Target Draft Session；同一目标外部刷新命中 dirty 草稿时只能暂存外部版本并提示。

## 链路

### 读取配置列表

1. 配置 view 挂载或 active session 变化。
2. 对应 `useConfig*ViewModel()` 捕获当前 `sessionId`。
3. ViewModel 调用配置 service 的列表读取入口。
4. 配置 service 调用 query service。
5. query service 通过 shared query API 调用 Rust `query_entity_list`。
6. Rust ProjectSession query 从 session 模型构造 `EntityData[]`。
7. 配置 service 校验 `EntityData.data` 并按资源引用调用配置资源 service。
8. 配置资源 service 通过资源缓存取得 data URL。
9. ViewModel 校验请求身份仍匹配当前 session。
10. ViewModel 更新列表、选中 ID、资源预览和实体数量 summary。

### 读取配置详情

1. 用户选择 Faction 或 Mission 实体。
2. 详情组件捕获选中实体 ID、`sessionId` 和重载 token。
3. ViewModel 调用配置 service 的详情读取入口。
4. 配置 service 调用 query service。
5. query service 通过 shared query API 调用 Rust `query_entity`。
6. Rust ProjectSession query 按 entity kind 和 ID 返回实体详情或 null。
7. 配置 service 校验详情对象并完成资源补图。
8. 详情组件确认返回目标仍是发起时的 `sessionId + entity id`。
9. 详情组件通过配置草稿接入点把 schema 编辑模型载入当前编辑目标。

### 保存 mod_info

1. 用户在 `mod_info.json` 表单触发保存。
2. ViewModel 捕获 active manifest 的 `sessionId + modRoot`。
3. ViewModel 调用配置 domain 将当前 `draftData` 转换为 `mod_info.json` 写入对象。
4. ViewModel 调用 `saveModInfoAction()`。
5. 配置保存 orchestrator 调用配置 service。
6. 配置 service 通过 write service 调用 shared files API 的 `save_mod_files`。
7. Rust file changes command 校验 `sessionId + modRoot` 后只写入 `mod_info.json`。
8. 配置保存 orchestrator 把写入结果交给 File History Session。
9. File History Session 记录文件级保存 history，并使用发起 session 刷新 ProjectSession。
10. ViewModel 确认 active manifest 仍匹配发起目标后只同步 `modInfo` 字段，并把保存后的数据提升为草稿基准。

### 保存 indexed config entity

1. 用户在 Faction 或 Mission 详情表单触发保存。
2. ViewModel 捕获发起时的 `sessionId + modRoot`、原 ID 和本地草稿。
3. ViewModel 调用配置 domain 生成 `nextId`、`indexRow`、`entityData` 和重命名删除标志。
4. ViewModel 调用 `saveIndexedEntityAction()`。
5. 配置保存 orchestrator 调用配置 service。
6. 配置 service 通过 write service 调用 shared config entity API。
7. Rust command 校验 `sessionId + modRoot`。
8. Rust indexed entity service 校验 ID、读取索引 CSV、校验旧索引行、校验目标冲突并更新索引行。
9. Rust indexed config definition 构造 Faction 文件 change 或 Mission 目录内 descriptor/text change。
10. Rust service 以一个 changeset 写盘并返回 `WriteResult.refreshedEntity`。
11. 配置保存 orchestrator 解析返回实体，并通过 File History Session 完成文件级保存 history 记录和 ProjectSession 刷新。
12. ViewModel 确认 active target 仍匹配发起目标后刷新列表、选中 ID 和相关缓存。

### 创建配置实体

1. 用户在列表入口提交新实体 ID 和必要引用字段。
2. ViewModel 捕获发起时的 `sessionId + modRoot`。
3. ViewModel 调用配置 domain 校验 ID、构造默认实体、索引行或单文件写入数据。
4. ViewModel 调用对应 create action。
5. 配置保存 orchestrator 调用配置 service 和 write service。
6. Rust command 校验 `sessionId + modRoot`。
7. Rust service 校验 ID、目标路径和冲突后构造创建 changeset。
8. 配置保存 orchestrator 通过 File History Session 完成文件级保存 history 记录和 ProjectSession 刷新。
9. ViewModel 确认 active target 仍匹配发起目标后刷新列表并选中新实体。

### 保存单文件 schema entity

1. 用户在 Variant 或 Skin 详情表单触发保存。
2. ViewModel 捕获发起时的 `sessionId + modRoot` 和当前实体。
3. ViewModel 调用配置 domain 取得重命名上下文并校验 ID 冲突。
4. ViewModel 调用 `saveVariantAction()` 或 `saveSkinAction()`。
5. 配置保存 orchestrator 调用配置 service。
6. 配置 service 通过 write service 调用 shared config entity API。
7. Rust command 校验 `sessionId + modRoot`。
8. Rust Editor/Config backend 从 Rust domain spec definition 取得路径、扩展名和 ID 文案，校验 ID、按旧 ID 推导的旧目标、写入数据 ID 和目标冲突。
9. Rust service 删除旧文件并写入新文件，或只覆盖当前目标文件。
10. 配置保存 orchestrator 解析返回实体，并通过 File History Session 完成文件级保存 history 记录和 ProjectSession 刷新。
11. ViewModel 确认 active target 仍匹配发起目标后刷新列表和选中 ID。

### 删除配置实体

1. 用户在列表或详情入口触发删除。
2. 组件在确认框打开时捕获 `sessionId + modRoot`、实体 ID、relPath 和删除目标选项。
3. ViewModel 调用对应 delete action。
4. 配置保存 orchestrator 调用配置 service。
5. 配置 service 通过 write service 调用 shared config entity API。
6. Rust command 校验 `sessionId + modRoot`。
7. Rust indexed entity service 删除索引行并按选项删除 Faction 文件或 Mission 目录。
8. Rust Editor/Config backend 按 Rust domain spec definition 校验 relPath、扩展名和文件内容 ID 后删除 Variant 或 Skin 文件。
9. 配置保存 orchestrator 通过 File History Session 完成文件级保存 history 记录和 ProjectSession 刷新。
10. ViewModel 确认 active target 仍匹配发起目标后刷新列表并修正选中 ID。

## 规范

- `IndexedConfigKind` 只允许表达 Faction 和 Mission；差异必须落在 Rust indexed config definition，不允许恢复前端或 command 的专用保存分支。
- `WriteResult.refreshedEntity` 对 indexed entity 必须包含 `entityId`、`indexPath`、`indexHeader`、`indexRows` 和可空 `entityData`。
- `mod_info.json` 保存只能提交一个 relPath 为 `mod_info.json` 的文件 change。
- `mod_info.json` 保存成功后的前端同步只能更新当前 manifest 的 `modInfo` 字段。
- `mod_info.json` 外部 manifest 更新命中 dirty 草稿时只能写入 pending external data；不得直接覆盖当前表单。
- Faction ID、Mission ID、Variant ID 和 Skin ID 必须是以 ASCII 字母数字开头且只包含 ASCII 字母数字、`_`、`.`、`-` 的单段标识。
- Faction 保存必须维护 `data/world/factions/factions.csv` 和 `data/world/factions/{id}.faction`。
- Faction schema 保存数据必须由 `file` source 转换而来，写入前必须剥离 schema 内部字段。
- Mission 详情读取只允许返回 `mission_list.csv` 正式注册的任务；未注册 ID 返回 null。
- Mission 保存必须维护 `data/missions/mission_list.csv`、`data/missions/{id}/descriptor.json` 和 `data/missions/{id}/mission_text.txt`。
- Mission schema 保存数据必须由 `list`、`descriptor` 和 `text` sources 转换而来，`localMission` 是唯一编辑状态。
- ProjectSession entity query 的非对象数据、缺失字段、序列化失败和配置文件解析失败必须作为错误暴露。
- Rust 写入 payload 的可空字段必须显式传 null，布尔控制字段必须显式传 true 或 false。
- Rust 写盘前必须校验 `sessionId + modRoot` 指向同一个 ProjectSession。
- Skin 删除必须按 Rust domain spec definition 校验 relPath、扩展名和文件内容 `skinHullId` 与实体 ID 匹配。
- Skin 重命名必须由后端按旧 ID 推导旧目标，且文件内容 `skinHullId` 与旧 ID 匹配。
- Skin 保存必须按 Rust domain spec definition 写入目标路径，且写入数据中的 `skinHullId` 必须与目标 ID 一致。
- Variant 删除必须按 Rust domain spec definition 校验 relPath、扩展名和文件内容 `variantId` 与实体 ID 匹配。
- Variant 重命名必须由后端按旧 ID 推导旧目标，且文件内容 `variantId` 与旧 ID 匹配。
- Variant 保存必须按 Rust domain spec definition 写入目标路径，且写入数据中的 `variantId` 必须与目标 ID 一致。
- 单文件 schema entity 的重复 ID 判断和重命名上下文归属配置 domain。
- 列表 query 返回后必须按发起时的 request id 和 session identity 校验再写入 ViewModel 状态。
- 详情草稿在选中实体变化时必须载入新编辑目标；同一实体详情数据 revision 或正式数据失效命中 dirty 草稿时只能暂存外部版本并提示，资源 data URL 失效只能刷新预览。
- 异步创建、保存、删除完成后必须确认 active `sessionId + modRoot` 仍匹配发起目标，才能刷新本地状态、改写选中 ID 或 emit 保存结果。
- 新建弹窗和删除确认框必须在打开时捕获写盘目标和实体身份，确认回调不得重新读取 active Mod 或当前选中项决定目标。
- 资源补图必须通过 ProjectSession resource refs、hull reference query 和资源缓存完成，不能把 data URL 写入配置写盘数据。
- 配置页面展示的文件级 history 只能消费 history ViewModel，不参与配置实体写入模型和保存链路。

## 陷阱

- 把文件级 history 页面状态并入配置 ViewModel 会造成 history 消费边界污染配置编辑模型。
- 用 active manifest 的当前值在异步回调里重新决定写盘目标，会把旧请求结果应用到新的 active Mod。
- 用空字符串代表未选中实体，会把缺失 ID 伪装成合法写入输入。
- 用路径字符黑名单代替配置 ID 正向模型，会让前后端校验语义分裂。
- 在组件中直接拆 schema source、拼 index row 或构造重命名路径，会绕过配置 domain 的正式模型。
- 在前端直接调用 Tauri command 写配置，会绕过配置保存 orchestrator 和 File History Session 的保存完成链路。
- 在资源预览失效时重载详情草稿，会覆盖未保存编辑内容。
- 把 Mission 未注册目录合成为可编辑实体，会破坏 `mission_list.csv` 的注册边界。
- 删除 Variant 或 Skin 时只信任前端 relPath，会允许删除配置目录外文件或错误 ID 文件。
- 保存 Faction 或 Mission 时允许旧索引行缺失继续写盘，会把重命名和创建语义混在一起。
