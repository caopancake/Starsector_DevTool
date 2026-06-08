# 装配编辑模块

## 定义

装配编辑模块负责在主配置页内读取、选择、新建、编辑、保存、重命名和删除当前 ProjectSession 的 `.variant` 文件。

## 参考

- `schemas/variant.schema.json`：定义 `.variant` 表单字段、字段 source、数组字段和 `modules` 的 Starsector 存储格式。
- `src/app/components/config/ConfigVariantEditor.vue`：持有当前选中装配的本地 schema 表单草稿、保存按钮、删除确认入口和保存后选中同步事件。
- `src/app/components/config/ConfigVariantList.vue`：渲染装配列表、缩略图、新建弹窗、删除触发入口，并在打开动作时捕获目标 `sessionId + modRoot`。
- `src/app/components/config/ConfigVariantView.vue`：装配页组合容器，只把 ViewModel 暴露的列表、选中项、资源、上下文和动作分发给列表与详情组件。
- `src/app/composables/use-config-variant-view-model.ts`：拥有装配列表、选中项、缩略图、hull 引用选项、数据版本和创建、保存、删除后的主配置页同步。
- `src/domain/config/config-entities.ts`：提供默认 `.variant` 数据、ID 校验、重复 ID 检查、重命名上下文和保存前字符串字段读取。
- `src/orchestrators/config-save.orchestrator.ts`：把装配写入结果接入文件级 history 和 ProjectSession 失效刷新。
- `src/services/config-entity.service.ts`：把后端 entity query 结果映射成前端 `VariantFile`，并提供装配新建、保存、删除 service 入口。
- `src/services/config-resource.service.ts`：通过 hull reference query 和批量资源 query 生成 hull 下拉选项与装配缩略图。
- `src/services/query-cache.service.ts`：按 `.variant`、`.ship`、`.skin` 和资源路径失效装配列表、引用选项、缩略图与 source option 缓存。
- `src/shared/api/config-entity-api.ts`：封装装配写入相关 Tauri command 的 wire 形状。
- `src-tauri/src/commands/config.rs`：校验写入请求的 `sessionId + modRoot` 归属后调用 config service。
- `src-tauri/src/domain/config.rs`：定义装配 ID、目标相对路径、文件相对路径和 `VariantFile` 构造规则。
- `src-tauri/src/services/config/variants.rs`：执行 `.variant` 新建、保存、重命名、删除的校验、清洗、changeset 构建和写盘。
- `src-tauri/src/services/project/query/hull_references.rs`：提供 ship 与 skin hull 引用选项及对应缩略图资源引用。
- `src-tauri/src/services/project/spec_files.rs`：索引 `data/variants/**/*.variant`，解析文件，去重 `variantId` 并生成扫描 warning。

## 边界

- 缓存边界：装配列表、详情和缩略图只消费 query cache 与 resource cache 的结果，失效由写入结果路径和 session 失效事件驱动。
- 错误边界：组件只负责展示保存、创建、删除、资源读取和引用读取错误，后端路径、JSON-like 解析、ID、目标存在和 changeset 错误必须原样进入统一错误提示。
- 读模型边界：`.variant` 读取归 ProjectSession spec 索引所有，前端只消费 `VariantFile` 与 `EntityData`，不得自行扫描目录或解析文件。
- 删除边界：删除只能删除传入 `relPath` 指向且文件内 `variantId` 匹配目标 ID 的 `.variant` 文件。
- 详情边界：详情组件只拥有当前选中实体的本地表单草稿、保存中状态和删除确认动作，不拥有跨 Mod 列表、history、session 刷新或文件系统写入。
- 来源边界：hull 选择和缩略图只能通过 hull reference query 返回的 ship/skin hull 与 `ResourceRef` 建立，不得由前端拼接 sprite 路径。
- 文件边界：装配模块声明拥有的持久化目标只有当前 Mod 下 `data/variants/**/*.variant`。
- 新建边界：新建数据由前端默认模型产生，但写入路径、ID、文件内容和目标存在性以后端保存 service 为准。
- 写入边界：新建、保存、重命名和删除必须通过 config entity save service 到 Rust command，再由 Rust changeset 写盘。
- 列表边界：列表组件只拥有排序、自动选中、新建弹窗输入和确认动作上下文，不拥有装配实体数据源或写盘结果处理。
- 上下文边界：所有创建、保存和删除动作必须使用触发时捕获的 `sessionId + modRoot`，完成后只在当前 active manifest 仍匹配时同步 UI。
- 选中边界：`selectedVariantId` 是主配置页运行时状态，不持久化，不参与文件保存，不跨 ProjectSession 复用。
- Schema 边界：schema 只定义表单渲染、source 查询和局部数据格式转换，不参与后端读取、路径选择、写盘校验或文件归属判断。
- 历史边界：文件级 history 只记录 Rust `WriteResult.changes`，不得基于前端草稿、表单 diff 或猜测路径创建历史项。
- 重命名边界：`variantId` 改名必须表现为一次 changeset 内删除旧 `.variant` 目标并写入新 `.variant` 目标。

## 链路

### 读取装配列表

1. `ConfigWorkspace.vue` 进入 `variants` 配置视图。
2. `ConfigVariantView.vue` 创建 `useConfigVariantViewModel()`。
3. ViewModel 监听 `project.activeSessionId` 并调用 `loadVariants()`。
4. `listVariantEntities(sessionId)` 调用 `querySessionEntityList(sessionId, 'variant')`。
5. `querySessionEntityList()` 通过 query cache 调用 shared query API。
6. Rust `query_entity_list` command 调用 ProjectSession query service。
7. ProjectSession query service 读取 session 内 `variant_files` 并序列化为 `EntityData`。
8. 前端 service 将 entity data 映射为 `VariantFile[]`。
9. ViewModel 更新 `variants`、entity summary、选中有效性和 `variantDataRevision`。

### 读取 hull 引用与缩略图

1. ViewModel 在非纯文本编辑模式下调用 `queryHullReferenceOptions(sessionId, [])`。
2. config resource service 调用 `querySessionHullReferences()`。
3. Rust hull reference query 合并当前 Mod ship、当前 Mod skin、原版 ship 和原版 skin。
4. Rust 返回 hull option 分组和每个可解析 hull 的 `ResourceRef`。
5. config resource service 批量调用资源 data URL query。
6. ViewModel 将返回值写入 `hullOptions`。
7. ViewModel 对当前 `VariantFile.hullId` 调用 `queryHullPreviewResources()`。
8. config resource service 用 hull reference query 返回的 sprite `ResourceRef` 批量生成 `variantSprites`。

### 新建装配

1. 用户在列表组件打开新建弹窗。
2. 列表组件记录当前 `modRoot` 与 `sessionId` 到新建上下文。
3. 用户提交 `hullId` 与 `variantId`。
4. 列表组件调用 ViewModel 暴露的 `createVariant()`。
5. ViewModel 校验必填、ID 格式和当前列表内重复 ID。
6. ViewModel 调用 `createVariantAction(sessionId, modRoot, hullId, variantId)`。
7. config save orchestrator 调用 config entity service。
8. config entity service 使用默认装配模型生成写入 payload。
9. shared config entity API 调用 Rust `create_variant_entity` command。
10. Rust command 校验 `sessionId + modRoot` 归属。
11. Rust config service 以 `data/variants/{variantId}.variant` 为目标执行保存链路。
12. config save orchestrator 记录文件级 history 并按 `WriteResult.invalidatedPaths` 刷新 ProjectSession。
13. ViewModel 在 active manifest 仍匹配时重新加载列表并选中新建装配。

### 保存与重命名装配

1. 用户在详情组件编辑 schema 表单本地草稿。
2. 详情组件在保存时捕获当前 `modRoot`、`sessionId` 和选中 `VariantFile`。
3. 详情组件调用 ViewModel 暴露的 `saveVariant()`。
4. ViewModel 确认 active manifest 与保存上下文匹配。
5. ViewModel 从草稿读取并校验 `variantId` 与 `hullId`。
6. ViewModel 校验 `variantId` 格式和当前列表内重复 ID。
7. ViewModel 生成旧 ID 与旧 relPath 的重命名上下文。
8. ViewModel 调用 `saveVariantAction()`。
9. config save orchestrator 调用 config entity service。
10. shared config entity API 调用 Rust `save_variant_entity` command。
11. Rust command 校验 `sessionId + modRoot` 归属。
12. Rust config service 校验 next ID、旧 ID、旧 relPath、目标路径和目标存在性。
13. Rust config service 清理 schema 内部字段并构造 `VariantFile`。
14. Rust config service 校验文件内容 `variantId` 与保存目标一致。
15. Rust config service 在同一 changeset 中删除旧目标并写入新目标，未重命名时只写入当前目标。
16. Rust 返回 `WriteResult` 与 refreshed variant entity。
17. config save orchestrator 记录文件级 history 并刷新 ProjectSession。
18. ViewModel 在 active manifest 仍匹配时重新加载列表、选中保存后的 `variantId` 并更新详情草稿。

### 删除装配

1. 用户从列表或详情组件触发删除。
2. 组件捕获当前 `modRoot`、`sessionId`、`relPath` 和 `variantId`。
3. 组件通过统一反馈入口确认危险操作。
4. 组件调用 ViewModel 暴露的 `deleteVariant()`。
5. ViewModel 调用 `deleteVariantAction(sessionId, modRoot, relPath, variantId)`。
6. config save orchestrator 调用 config entity service。
7. shared config entity API 调用 Rust `delete_variant_entity` command。
8. Rust command 校验 `sessionId + modRoot` 归属。
9. Rust config service 校验 `variantId`、`relPath` 目录与扩展名。
10. Rust config service 读取目标文件并确认文件内 `variantId` 匹配。
11. Rust config service 构建删除 changeset 并写盘。
12. config save orchestrator 记录文件级 history 并刷新 ProjectSession。
13. ViewModel 在 active manifest 仍匹配时重新加载列表并修正选中项。

### 缓存失效与同步

1. 写入返回 `WriteResult.invalidatedPaths`。
2. config save orchestrator 调用 ProjectSession 失效编排。
3. 前端失效编排调用 Rust `invalidate_project_session`。
4. Rust session invalidation 按路径刷新 `variant_files`、manifest entity summary 和相关 warnings。
5. 前端 project store 更新对应 manifest。
6. 前端本地 query cache 与 resource cache 按路径失效。
7. ViewModel 监听 query cache invalidation。
8. `entity-list(kind=variant)` 失效时重新加载装配列表。
9. hull reference 或已使用资源失效时重新加载 hull options 和装配缩略图。

## 规范

- `.variant` 文件内容必须是 JSON-like object，且必须包含非空字符串 `variantId` 与 `hullId`。
- `VariantFile` 输出必须包含 `variantId`、`hullId`、绝对 `path`、项目相对 `relPath`、原始 `data` 和计数字段。
- `hullId` 引用语义必须同时支持 ship `hullId` 与 skin `skinHullId`。
- `modules` 字段必须按 Starsector 的数组包裹单键对象格式读写，schema 使用 `key-value` 与 `array-of-entries` 完成表单转换。
- `variantId` 只允许使用可移植 ASCII 配置实体 ID，禁止空值、路径分隔符、父目录片段和非法起始字符。
- `wings` 字段必须保留数组逐项编辑语义，不能改成去重集合或多选值集合。
- 保存成功后的 UI 同步必须基于后端返回的 refreshed entity 和重新 query 的列表，不得把本地草稿当成磁盘权威。
- 保存和新建目标路径必须由后端根据 `nextId` 生成，正式路径为 `data/variants/{variantId}.variant`。
- 删除和重命名旧目标必须读取旧文件并确认文件内 ID 与请求目标一致。
- 当前 Mod 内重复 `variantId` 在 session 索引时保留第一个文件并产生 warning，列表消费去重后的正式索引结果。
- 前端重复 ID 校验只用于用户反馈，不能替代 Rust 保存边界校验。
- 前端字段 source 查询必须绑定详情组件收到的 `modRoot + sessionId` runtime context。
- 纯文本编辑模式下新建 hull 输入使用文本；增强控件模式下使用 hull reference option。
- 任一写入完成后必须先记录文件级 changeset，再按写入结果刷新 ProjectSession 和本地缓存。
- 任一写入完成后如果 active manifest 已切换，ViewModel 不得把结果写回当前页面状态。
- 资源 data URL 必须来自批量资源 query，组件不得直接构造 `ResourceRef` 或图片路径。
- Schema 内部字段在 Rust 写盘前必须清理，不能写入 `.variant` 文件。
- 写入结果的 `invalidatedPaths` 必须驱动装配列表、hull 引用、缩略图和相关 source option 失效。

## 陷阱

- 把 `.variant` 新建或保存改成通用文件保存会绕过 ID、目录、重命名和文件内容一致性校验。
- 把 `hullId` 下拉只绑定 ship 表会使 skin hull 装配失去合法引用与缩略图。
- 把保存后的本地草稿直接塞回列表会绕过 ProjectSession 索引、重复 ID warning 和 Rust 返回模型。
- 在组件里拼接 `data/variants/{id}.variant` 会把路径权威从 Rust service 移到前端。
- 在删除时只信任列表项 relPath 会允许 UI 过期状态删除错误文件，必须由 Rust 读取目标文件确认 ID。
- 在重命名时分两次写入会破坏单次文件级 history、undo/redo 和失败边界。
- 用 active manifest 替代触发时捕获的 `sessionId + modRoot` 会把跨 Mod 切换后的写入结果污染到当前页面。
- 用资源路径字符串替代 `ResourceRef` 会破坏原版资源回退、资源缓存身份和路径失效。
- 把 `modules` 当普通 object 写回会破坏 Starsector 对模块装配的数组条目格式。
- 把 `wings` 当去重多选写回会改变文件语义和条目顺序。
