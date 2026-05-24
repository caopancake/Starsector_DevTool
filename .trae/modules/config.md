# 配置系统

## 定义

配置系统编辑 Mod 配置类文件，包括 `mod_info.json`、indexed config entity、势力文件与势力索引、任务 descriptor、任务文本、任务列表 CSV、装配和舰船皮肤。

## 边界

- `src/app/components/config/ConfigWorkspace.vue` 根据 config view 切换配置页面。
- `src/app/components/config/ConfigModInfoEditor.vue` 编辑 `mod_info.json`。
- `src/app/components/config/ConfigFactionView.vue` 作为势力完整模块容器，组合列表、编辑器和空状态。
- `src/app/components/config/ConfigFactionList.vue` 渲染势力列表、新建弹窗和删除触发控件。
- `src/app/components/config/ConfigFactionEditor.vue` 渲染 `.faction` 表单和保存触发控件。
- `src/app/components/config/ConfigMissionView.vue` 作为战役完整模块容器，组合列表、编辑器和空状态。
- `src/app/components/config/ConfigMissionList.vue` 渲染 mission 列表、新建弹窗和删除触发控件。
- `src/app/components/config/ConfigMissionEditor.vue` 渲染 mission 列表项、descriptor 和文本表单。
- `src/app/composables/useConfigFactionViewModel()` 统一编排 Faction 列表、选中项和图片资源。
- `src/app/composables/useConfigMissionViewModel()` 统一编排 Mission 列表、选中项、entity query 和图片资源。
- `src/app/composables/useConfigVariantViewModel()` 统一编排 Variant 列表、选中项、hull 引用、缩略图和创建删除。
- `src/app/composables/useConfigSkinViewModel()` 统一编排 Skin 列表、选中项、hull 引用、缩略图和创建删除。
- `src/services/config-entity.service.ts` 封装配置保存 API 和 ProjectSession 配置 entity query。
- `src/services/write.service.ts` 把配置保存结果统一转换为写入结果模型。
- `src/orchestrators/config-save.orchestrator.ts` 统一记录配置保存的文件级 history。
- `src/shared/api/query-api.ts` 只封装配置 entity query 的 wire command。
- `src/shared/api/write-api.ts` 只封装配置保存相关 wire command。
- `src-tauri/src/services/config/indexed_entities.rs` 统一处理 indexed config entity 的 CSV index、target adapter 和 changeset。

## 规范

- 配置组件只消费 ViewModel 暴露的状态和动作，不直接调用 query service、resource cache、write service 或保存 orchestrator。
- 配置组件不能直接记录 file history，必须通过 ViewModel 或配置保存 orchestrator。
- 配置组件不能直接调用资源缓存服务；资源补图必须由 ViewModel 或配置 service 提供。
- Faction、Mission、Variant 和 Skin 的 view 容器必须通过对应 `useConfig*ViewModel()` 取得列表状态、选中状态和刷新动作。
- `mod_info.json` 保存只写 `mod_info.json`。
- Faction 和 Mission 必须走同一套 indexed config entity 保存入口：`saveIndexedConfigEntityWithFileHistory()`、`createIndexedConfigEntityWithFileHistory()`、`deleteIndexedConfigEntityWithFileHistory()`。
- Mission 列表和详情读取必须走 ProjectSession entity query，不允许恢复独立 mission 读取 command 或前端 API。
- 前端只提交 `kind`、`previousId`、`nextId`、`indexRow`、`payload` 和 `deletePreviousTarget`，不能分别调用势力或战役专用保存 command。
- Rust 只暴露 indexed config entity command；Faction 和 Mission 的差异只存在于 Rust target adapter。
- Faction adapter 维护 `data/world/factions/factions.csv` 和 `data/world/factions/{id}.faction`。
- Mission adapter 维护 `data/missions/mission_list.csv` 和 `data/missions/{id}/`，保存时覆盖 `descriptor.json` 与 `mission_text.txt`，改 ID 时复制旧目录资源再删除旧目录。
- `ConfigMissionEditor.vue` 必须以 `localMission` schema 模型作为唯一编辑状态，不能用并行的 descriptor/text 状态作为保存回退。
- mission 删除目录必须使用目录级 changeset；faction 删除文件必须使用文件级 changeset。
- 配置 ID 必须由 Rust 校验，禁止路径穿越。
- 装配和舰船皮肤是单文件 schema entity，必须通过各自 shared API 和 config save orchestrator 进入文件级 history。

## 链路：保存 mod_info

1. 用户在 `ConfigModInfoEditor.vue` 保存。
2. ViewModel 或配置保存入口调用 `saveModInfoWithFileHistory()`。
3. config save orchestrator 调用 `saveModInfo()`。
4. Rust file changes service 写入 `mod_info.json`。
5. Rust 返回 changeset。
6. config save orchestrator 记录文件级 history。
7. 前端根据写入结果的 `invalidatedPaths` 失效 session 和资源缓存。

## 链路：保存势力

1. 用户在 `ConfigFactionEditor.vue` 保存。
2. Faction ViewModel 调用 `saveIndexedConfigEntityWithFileHistory()`，提交 `kind: "faction"`。
3. config save orchestrator 调用 `saveIndexedConfigEntity()`。
4. `write-api.ts` 调用 Rust `save_indexed_config_entity_with_history` command。
5. Rust indexed entity service 校验 id、读取并 upsert `factions.csv`。
6. Rust faction adapter 构建 `data/world/factions/{id}.faction` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust faction adapter 构建旧 `.faction` 删除 change。
8. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
9. 前端记录一条文件级 history。
10. 前端根据写入结果刷新 faction cache、选中 ID、session cache 和资源 cache。

## 链路：保存任务

1. 用户在 `ConfigMissionEditor.vue` 保存任务。
2. Mission ViewModel 调用 `saveIndexedConfigEntityWithFileHistory()`，提交 `kind: "mission"`。
3. config save orchestrator 调用 `saveIndexedConfigEntity()`。
4. `write-api.ts` 调用 Rust `save_indexed_config_entity_with_history` command。
5. Rust indexed entity service 校验 id、读取并 upsert `mission_list.csv`。
6. Rust mission adapter 构建 `data/missions/{id}/descriptor.json` 和 `data/missions/{id}/mission_text.txt` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust mission adapter 先复制旧目录完整 snapshot 到新目录，再覆盖 descriptor/text，再删除旧目录。
8. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
9. 前端记录一条文件级 history。
10. Mission ViewModel 刷新列表、选中 ID、schema 状态和缓存。

## 链路：删除 indexed config entity

1. 用户在 entity list 或 editor header 删除条目。
2. 对应 ViewModel 调用 `deleteIndexedConfigEntityWithFileHistory()`，提交 `kind`、`id` 和 `deleteTarget`。
3. config save orchestrator 调用 `deleteIndexedConfigEntity()`。
4. `write-api.ts` 调用 Rust `delete_indexed_config_entity_with_history` command。
5. Rust indexed entity service 从对应 index CSV 移除 row。
6. Rust target adapter 按 `deleteTarget` 构建 `.faction` 文件删除或 mission 目录删除。
7. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
8. 前端记录一条文件级 history。
9. 前端只基于 result 刷新列表、cache 和选中 ID。
