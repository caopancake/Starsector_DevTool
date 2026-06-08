# 舰船皮肤编辑模块

## 定义

舰船皮肤编辑模块是在配置页中读取、浏览、新建、保存、重命名和删除 `data/hulls/skins/*.skin` 单文件实体的模块。

## 参考

- `schemas/skin.schema.json`：定义 `.skin` 表单字段、字段来源和 schema 渲染规则。
- `src/app/components/config/ConfigSkinEditor.vue`：拥有当前 `.skin` 表单 draft、schema runtime context、保存触发和编辑器内删除确认。
- `src/app/components/config/ConfigSkinList.vue`：拥有列表渲染、新建弹窗输入、列表删除确认和目标身份捕获。
- `src/app/components/config/ConfigSkinView.vue`：组合 Skin 列表、编辑器、空状态，并只消费 ViewModel 暴露的状态与动作。
- `src/app/composables/use-config-skin-view-model.ts`：拥有 Skin 列表、选中 ID、缩略图、hull 引用选项、data revision、创建、保存、删除和 cache 失效响应。
- `src/orchestrators/config-save.orchestrator.ts`：拥有 Skin 保存动作的文件级 history 记录和 ProjectSession 刷新编排。
- `src/services/config-entity.service.ts`：拥有 Skin entity list 转换、默认 Skin 构造和 write service 调用。
- `src/services/config-resource.service.ts`：拥有 Skin 缩略图和 hull 引用选项的 `ResourceRef` 批量补图。
- `src/shared/api/config-entity-api.ts`：封装 Skin create/save/delete 的 Tauri command 调用形状。
- `src-tauri/src/domain/config.rs`：定义 SkinFile、配置 ID、`.skin` relPath 和单文件配置路径校验模型。
- `src-tauri/src/services/config/skins.rs`：拥有 `.skin` 新建、保存、重命名、删除、目标校验和 changeset 写盘。
- `src-tauri/src/services/project/spec_files.rs`：拥有 ProjectSession 打开或刷新时的 `.skin` 文件扫描、解析、去重和排序。

## 边界

- ProjectSession 拥有 `.skin` 文件索引、SkinFile 输出和 entity list 查询，前端不能扫描磁盘补 Skin 列表。
- Rust command 层只校验 `sessionId + modRoot` 归属并调用 config service，不解析 `.skin` 字段。
- Rust config domain 拥有 SkinFile 数据模型、ID 规则、relPath 规则和文件内容必填字段解析。
- Rust Skin service 拥有 `data/hulls/skins/{skinHullId}.skin` 的创建、保存、重命名、删除和 changeset 写盘。
- Schema 只拥有前端字段渲染和 source 声明，不拥有 `.skin` 读取、校验、写盘或路径决定权。
- Skin Editor 组件拥有当前选中 `.skin` 的本地表单 draft，不拥有列表查询、写盘、history 或 session 刷新。
- Skin List 组件拥有新建弹窗输入和删除确认 UI，不拥有最终写盘目标验证。
- Skin ViewModel 拥有 Skin 页面运行态，包括当前选中 ID、列表、缩略图、hull 选项和 data revision。
- Skin 创建、保存、删除必须通过 config save orchestrator 进入文件级 history 和 session invalidation。
- Skin 缩略图和 hull 下拉只能消费 hull reference query 返回的 `ResourceRef`，前端不能构造资源引用。
- Skin schema runtime context 必须使用当前 Skin ViewModel 暴露的 `modRoot + sessionId`，不能重新读取 active manifest。
- `.skin` 模块不拥有 `.ship`、`.variant`、CSV 表格、文件编辑器或贴图上传的保存目标。

## 链路

### 读取 Skin 列表

1. 配置工作区进入舰船皮肤视图。
2. `ConfigSkinView` 创建 `useConfigSkinViewModel()`。
3. ViewModel 监听 active ProjectSession 并调用 `listSkinEntities(sessionId)`。
4. config entity service 调用 `querySessionEntityList(sessionId, 'skin')`。
5. shared query API 调用 Rust `query_entity_list`。
6. Rust entity query 从 ProjectSession `skin_files` 构造 Skin entity 列表。
7. Rust entity query 将 `SkinFile` 序列化为 entity data，并附带可解析的 resource refs。
8. config entity service 校验并转换为前端 `SkinFile[]`。
9. ViewModel 写入 `skins`，更新 project store 的 skin entity summary。
10. ViewModel 比较当前选中实体数据，必要时递增 `skinDataRevision`。
11. ViewModel 在当前选中 ID 不存在时清空选中项。

### 读取缩略图和 hull 选项

1. ViewModel 使用当前 `skins` 的 `skinHullId` 集合调用 `querySkinPreviewResources()`。
2. config resource service 调用 hull reference query。
3. Rust hull reference query 同时解析 Mod ship、Mod skin、Core ship 和 Core skin 引用。
4. Rust 对 Skin 缩略图优先使用 `.skin.spriteName`，缺失时使用 `baseHullId` 对应 ship sprite。
5. config resource service 按返回的 `ResourceRef` 批量查询 data URL。
6. ViewModel 写入 `skinSprites` 和 `skinSpriteResourceRefs`。
7. 在增强编辑模式下，ViewModel 调用 `queryHullReferenceOptions()` 读取 hull 下拉选项。
8. hull 选项同样通过 resource batch query 补充 sprite data URL。
9. 组件只渲染 ViewModel 提供的缩略图和选项。

### 新建 Skin

1. 用户在 Skin 列表点击新建。
2. `ConfigSkinList` 捕获当前 `sessionId + modRoot` 到弹窗状态。
3. 用户输入 `baseHullId` 与 `skinHullId` 并提交。
4. ViewModel 校验两个字段非空、`skinHullId` 为配置 ID、当前列表无同 ID。
5. ViewModel 调用 `createSkinAction(sessionId, modRoot, baseHullId, skinHullId)`。
6. config save orchestrator 调用 `createSkinEntity()`。
7. config entity service 使用 `createDefaultSkin(baseHullId, skinHullId)` 构造默认数据。
8. shared config API 调用 Rust `create_skin_entity`。
9. Rust command 校验 `sessionId + modRoot` 仍属于同一 ProjectSession。
10. Rust Skin service 使用 `data/hulls/skins/{skinHullId}.skin` 作为新建目标并写入 pretty JSON。
11. Rust 返回带 `changes`、`invalidatedPaths` 和 `refreshedEntity` 的 `WriteResult`。
12. config save orchestrator 记录文件级 history 并按写盘结果刷新 ProjectSession。
13. ViewModel 在当前 manifest 仍匹配发起身份时重载 Skin 列表并选中新建项。

### 保存 Skin

1. 用户在 `ConfigSkinEditor` 编辑 schema 表单。
2. 编辑器以 props 中 `modRoot + sessionId` 构造 schema runtime context。
3. 用户点击保存。
4. 编辑器捕获当前 `SkinFile`、`sessionId`、`modRoot` 和本地 draft。
5. ViewModel 校验 active manifest 仍匹配保存身份。
6. ViewModel 校验 `skinHullId` 与 `baseHullId` 非空、`skinHullId` 为配置 ID、当前列表无冲突。
7. ViewModel 根据旧 `skinHullId + relPath` 与新 `skinHullId` 构造 rename context。
8. ViewModel 调用 `saveSkinAction(sessionId, modRoot, nextSkinHullId, data, previousId, previousRelPath)`。
9. shared config API 调用 Rust `save_skin_entity`。
10. Rust command 校验 `sessionId + modRoot` 仍属于同一 ProjectSession。
11. Rust Skin service 校验新 ID、旧 ID、旧 relPath、目标路径和写入数据中的 `skinHullId`。
12. 若重命名，Rust 校验旧 relPath 属于 `data/hulls/skins/*.skin` 且文件内容 ID 匹配旧 ID。
13. Rust 在同一个 changeset 中删除旧 `.skin` 并写入新 `.skin`；非重命名时只写目标文件。
14. Rust 返回 `WriteResult`，并在 `refreshedEntity` 中返回新的 SkinFile。
15. config save orchestrator 记录文件级 history 并按写盘结果刷新 ProjectSession。
16. ViewModel 在当前 manifest 仍匹配保存身份时重载 Skin 列表并选中保存后的 `skinHullId`。
17. 编辑器在 props 仍匹配保存身份时用返回数据重置本地 draft。

### 删除 Skin

1. 用户从 Skin 列表或编辑器触发删除。
2. 组件在确认框打开时捕获 `sessionId + modRoot + relPath + skinHullId`。
3. 用户确认删除。
4. ViewModel 调用 `deleteSkinAction(sessionId, modRoot, relPath, skinHullId)`。
5. shared config API 调用 Rust `delete_skin_entity`。
6. Rust command 校验 `sessionId + modRoot` 仍属于同一 ProjectSession。
7. Rust Skin service 校验 `skinHullId` 为配置 ID。
8. Rust Skin service 校验 relPath 属于 `data/hulls/skins/*.skin` 且文件内容 `skinHullId` 匹配被删除 ID。
9. Rust 构建单文件删除 changeset 并写盘。
10. config save orchestrator 记录文件级 history 并按写盘结果刷新 ProjectSession。
11. ViewModel 在当前 manifest 仍匹配删除身份时重载 Skin 列表。
12. 若删除项是当前选中项，ViewModel 选择列表中第一个 Skin 或清空选中项。

### Cache 失效同步

1. 主窗口保存编排按 `WriteResult.invalidatedPaths` 调用 ProjectSession invalidation。
2. Rust session invalidation 识别 `data/hulls/skins/*.skin` 变更。
3. Rust 重新加载 `skin_files` 并更新 manifest skin 统计。
4. Rust 同步刷新 variant/skin warning 集合。
5. 前端 query cache 对 `entity-list kind=skin`、`hull-references` 和命中的 resource identity 发出失效事件。
6. Skin ViewModel 收到当前 session 的 Skin entity list 失效后重载列表。
7. Skin ViewModel 收到 hull references 或 Skin 缩略图资源失效后重载缩略图。
8. Skin ViewModel 收到 hull references 或 hull 选项资源失效后重载 hull 下拉选项。

## 规范

- `.skin` 读取不依赖 schema；schema 只能约束前端表单呈现。
- `.skin` 文件必须包含非空 `skinHullId` 和 `baseHullId`。
- `baseHullId` 可指向 ship hull，也可在引用 UI 中通过 hull reference query 展示候选。
- `skinHullId` 必须是配置 ID，且在当前 Mod Skin 列表内唯一。
- `skinHullId` 是合法 hull reference，hull 引用查询必须把 Skin 与 Ship 一起返回。
- 创建路径必须固定为 `data/hulls/skins/{skinHullId}.skin`。
- 删除和重命名旧目标必须校验 relPath 的目录、扩展名、路径组件和文件内容 ID。
- 保存写入数据中的 `skinHullId` 必须与保存目标 ID 一致。
- 保存允许修改 `skinHullId`，但必须在同一 changeset 中完成旧文件删除与新文件写入。
- 创建、保存、删除都必须记录文件级 history，并用 Rust 返回的 WriteResult 刷新 ProjectSession。
- Skin 组件只能调用 ViewModel 暴露的动作，不能直接调用 query service、resource cache、write service 或 shared API。
- Skin 删除确认和新建弹窗必须使用打开时捕获的 `sessionId + modRoot`，不能在确认时重新读取 active manifest。
- Skin 编辑器本地 draft 只能在切换选中 ID 或当前实体数据 revision 改变时重置。
- Skin 缩略图缺失时只能显示占位图标，不能直接拼路径读取图片。
- Skin ViewModel 只在异步返回后确认 active manifest 仍匹配发起身份时更新选中项或本地列表状态。

## 陷阱

- 保存或删除时重新读取当前 active Mod，会在用户切换 Mod 后把旧确认目标写入新项目。
- 用文件批量保存手工拼 `.skin` changeset，会绕过 Rust 的 relPath、ID 和内容一致性校验。
- 在列表刷新时无条件重置编辑器 draft，会覆盖当前选中 Skin 的未保存表单编辑。
- 把 schema 当作 `.skin` 读取或保存权威，会让磁盘格式校验受前端渲染配置污染。
- 删除时只信任前端 relPath，会允许删除 Skin 目录外文件或错误 ID 文件。
- 缩略图由前端直接拼 sprite 路径读取，会绕过 `ResourceRef`、Core 回退和路径安全边界。
- 把 `skinHullId` 排除在 hull reference 之外，会破坏 Variant、Skin 和 schema 字段对 Skin hull 的合法引用。
