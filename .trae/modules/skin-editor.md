# 舰船皮肤编辑模块

## 定义

舰船皮肤编辑模块用于读取、浏览、新建、删除和 schema 表单编辑 `data/hulls/skins/*.skin` 文件。

## 边界

- `src/app/components/config/ConfigSkinView.vue` 作为舰船皮肤完整模块容器，组合列表、编辑器和空状态。
- `src/app/components/config/ConfigSkinList.vue` 渲染舰船皮肤列表、新建弹窗和删除触发控件。
- `src/app/components/config/ConfigSkinEditor.vue` 渲染 `.skin` schema 表单和保存触发控件。
- `src/app/composables/useConfigSkinViewModel()` 编排舰船皮肤列表、选中项、hull 引用、缩略图、创建和删除。
- `schemas/skin.schema.json` 定义 `.skin` 表单字段。
- `src-tauri/src/services/config/skins.rs` 统一处理 `.skin` 新建、保存、重命名和删除 changeset。
- `src-tauri/src/services/project/query/` 在 ProjectSession 中索引并查询 `.skin` 文件。
- `src/shared/api/config-entity-api.ts` 只封装舰船皮肤 entity wire command。

## 规范

- `.skin` 读取不依赖 schema；schema 只负责前端表单渲染。
- 每个 `.skin` 必须有 `skinHullId` 和 `baseHullId`。
- `skinHullId` 必须在当前 Mod 内全局唯一。
- `skinHullId` 在引用语义上是合法 hull ID；所有 hull 引用解析都必须支持指向舰船皮肤。
- 舰船皮肤作为 hull 引用参与下拉和缩略图时，必须通过 ProjectSession hull reference query 统一解析。
- 舰船皮肤模块不提供文件编辑器入口。
- 舰船皮肤列表缩略图优先使用 `.skin` 的 `spriteName`，没有时按 `baseHullId` 读取舰船贴图；前端只能用 query 返回的 `ResourceRef` 批量加载图片，读取不到时显示占位图标。
- 保存允许修改 `skinHullId`；修改后必须在同一个 changeset 中删除旧文件并创建新文件。
- 新建路径固定为 `data/hulls/skins/{skinHullId}.skin`。
- 删除和重命名旧目标时，Rust 必须校验 relPath 属于 `data/hulls/skins/*.skin`，且文件内容的 `skinHullId` 匹配被操作实体。
- 保存写入的 `.skin` 数据内 `skinHullId` 必须与保存目标 `skinHullId` 一致。
- 新建、保存、重命名和删除都必须进入文件级 history。
- 前端不能直接用文件批量保存拼 `.skin` 文件操作，必须走 `saveSkinAction`、`createSkinAction` 或 `deleteSkinAction`。
- Skin 组件只消费 ViewModel 暴露的状态和动作，不直接调用 query service、resource cache、write service 或保存 orchestrator。
- Skin schema 表单的 runtime context 必须使用 Skin ViewModel 暴露的当前目标 `modRoot + sessionId`，字段 source query 和路径选择不得重新绑定 active manifest。

## 链路：读取舰船皮肤

1. Skin ViewModel 查询舰船皮肤列表。
2. Rust 索引 `data/hulls/skins/*.skin`。
3. Rust 解析 JSON-like 文件。
4. Rust 校验 `skinHullId`、`baseHullId` 和重复 `skinHullId`。
5. Rust 通过 session manifest 或 entity query 返回舰船皮肤摘要与实体数据。
6. 前端只缓存当前界面需要的舰船皮肤列表和选中实体。
7. ViewModel 把列表、选中项、缩略图和动作交给组件渲染。

## 链路：保存舰船皮肤

1. 用户在 `ConfigSkinEditor.vue` 中编辑 schema 表单。
2. 用户触发保存。
3. ViewModel 或编辑器保存入口校验 `skinHullId`、`baseHullId` 和重复 ID。
4. ViewModel 调用 `saveSkinAction()`。
5. config save orchestrator 调用 `saveSkinEntity()`。
6. `config-entity-api.ts` 调用 Rust `save_skin_entity` command。
7. Rust 校验 `skinHullId`、`baseHullId` 和路径边界。
8. Rust 构建单文件修改 changeset；重命名时构建旧 `.skin` 删除和新 `.skin` 写入的同一 changeset。
9. Rust 写盘并返回 `WriteResult`，并在 `refreshedEntity` 中返回当前舰船皮肤数据。
10. 前端记录文件级 history。
11. ViewModel 只基于 result 同步当前舰船皮肤列表并失效对应 session cache。

## 链路：新建舰船皮肤

1. 用户在 `ConfigSkinList.vue` 输入 `baseHullId` 和 `skinHullId`。
2. Skin ViewModel 调用 `createSkinAction()`。
3. config save orchestrator 调用 `createSkinEntity()`。
4. `config-entity-api.ts` 调用 Rust `create_skin_entity` command。
5. Rust 生成 `data/hulls/skins/{skinHullId}.skin` 的默认内容并写盘。
6. Rust 返回 `WriteResult`，并在 `refreshedEntity` 中返回当前舰船皮肤数据。
7. ViewModel 记录文件级 history，并只基于 result 更新列表和选中项。

## 链路：删除舰船皮肤

1. 用户在 `ConfigSkinList.vue` 或 `ConfigSkinEditor.vue` 确认删除。
2. Skin ViewModel 调用 `deleteSkinAction()`。
3. config save orchestrator 调用 `deleteSkinEntity()`。
4. `config-entity-api.ts` 调用 Rust `delete_skin_entity` command。
5. Rust 构建单文件删除 changeset 并写盘。
6. 前端记录文件级 history，并移除当前列表中的对应舰船皮肤。
