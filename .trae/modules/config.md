# 配置系统

## 定义

配置系统编辑 Mod 配置类文件，包括 `mod_info.json`、indexed config entity、势力文件与势力索引、任务 descriptor、任务文本和任务列表 CSV。

## 边界

- `src/features/config/components/ConfigWorkspace.vue` 根据 config view 切换配置页面。
- `src/features/config/components/ModInfoEditor.vue` 编辑 `mod_info.json`。
- `src/features/config/components/FactionView.vue` 作为势力完整模块容器，组合列表、编辑器和空状态。
- `src/features/config/components/FactionEntityList.vue` 管理势力列表、新建和删除。
- `src/features/config/components/FactionEditor.vue` 编辑和删除 `.faction`。
- `src/features/config/components/MissionView.vue` 作为战役完整模块容器，组合列表、编辑器和空状态。
- `src/features/config/components/MissionEntityList.vue` 管理 mission 列表、新建和删除。
- `src/features/config/components/MissionEditor.vue` 编辑和删除 mission 列表项、descriptor 和文本。
- `src/features/config/config-service.ts` 封装配置 API。
- `src/features/config/config-save-orchestrator.ts` 统一记录配置保存的文件级 history。
- `src/shared/api/missions-api.ts`、`src/shared/api/indexed-api.ts` 和 `src/shared/api/files-api.ts` 封装 mission、indexed entity 和文件 command。
- `src-tauri/src/services/config/indexed_entities.rs` 统一处理 indexed config entity 的 CSV index、target adapter 和 changeset。
- `src-tauri/src/services/config/missions.rs` 只保留 mission 列表扫描、mission 读取和相关测试。

## 规范

- 配置组件不能直接记录 file history，必须通过 `config-save-orchestrator.ts`。
- `mod_info.json` 保存只写 `mod_info.json`。
- Faction 和 Mission 必须走同一套 indexed config entity 保存入口：`saveIndexedConfigEntityWithFileHistory()`、`createIndexedConfigEntityWithFileHistory()`、`deleteIndexedConfigEntityWithFileHistory()`。
- 前端只提交 `kind`、`previousId`、`nextId`、`indexRow`、`payload` 和 `deletePreviousTarget`，不能分别调用势力或战役专用保存 command。
- Rust 只暴露 indexed config entity command；Faction 和 Mission 的差异只存在于 Rust target adapter。
- Faction adapter 维护 `data/world/factions/factions.csv` 和 `data/world/factions/{id}.faction`。
- Mission adapter 维护 `data/missions/mission_list.csv` 和 `data/missions/{id}/`，保存时覆盖 `descriptor.json` 与 `mission_text.txt`，改 ID 时复制旧目录资源再删除旧目录。
- `MissionEditor.vue` 必须以 `localMission` schema 模型作为唯一编辑状态，不能用并行的 descriptor/text 状态作为保存 fallback。
- mission 删除目录必须使用目录级 changeset；faction 删除文件必须使用文件级 changeset。
- 配置 ID 必须由 Rust 校验，禁止路径穿越。

## 链路：保存 mod_info

1. 用户在 `ModInfoEditor.vue` 保存。
2. 组件调用 `saveModInfoWithFileHistory()`。
3. config save orchestrator 调用 `saveModInfoData()`。
4. Rust file changes service 写入 `mod_info.json`。
5. Rust 返回 changeset。
6. config save orchestrator 记录文件级 history。
7. 前端刷新 project cache 中的 mod info。

## 链路：保存势力

1. 用户在 `FactionEditor.vue` 保存。
2. 组件调用 `saveIndexedConfigEntityWithFileHistory()`，提交 `kind: "faction"`。
3. config save orchestrator 调用 `saveIndexedConfigEntityData()`。
4. `indexed-api.ts` 调用 Rust `save_indexed_config_entity_with_history` command。
5. Rust indexed entity service 校验 id、读取并 upsert `factions.csv`。
6. Rust faction adapter 构建 `data/world/factions/{id}.faction` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust faction adapter 构建旧 `.faction` 删除 change。
8. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
9. 前端记录一条文件级 history。
10. 前端只基于 result 刷新 faction cache 和选中 ID。

## 链路：保存任务

1. 用户在 `MissionEditor.vue` 保存任务。
2. 组件调用 `saveIndexedConfigEntityWithFileHistory()`，提交 `kind: "mission"`。
3. config save orchestrator 调用 `saveIndexedConfigEntityData()`。
4. `indexed-api.ts` 调用 Rust `save_indexed_config_entity_with_history` command。
5. Rust indexed entity service 校验 id、读取并 upsert `mission_list.csv`。
6. Rust mission adapter 构建 `data/missions/{id}/descriptor.json` 和 `data/missions/{id}/mission_text.txt` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust mission adapter 先复制旧目录完整 snapshot 到新目录，再覆盖 descriptor/text，再删除旧目录。
8. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
9. 前端记录一条文件级 history。
10. `MissionView.vue` 刷新列表，`MissionEditor.vue` 只基于 result 刷新 schema 状态和选中 ID。

## 链路：删除 indexed config entity

1. 用户在 entity list 或 editor header 删除条目。
2. 组件调用 `deleteIndexedConfigEntityWithFileHistory()`，提交 `kind`、`id` 和 `deleteTarget`。
3. config save orchestrator 调用 `deleteIndexedConfigEntityData()`。
4. `indexed-api.ts` 调用 Rust `delete_indexed_config_entity_with_history` command。
5. Rust indexed entity service 从对应 index CSV 移除 row。
6. Rust target adapter 按 `deleteTarget` 构建 `.faction` 文件删除或 mission 目录删除。
7. Rust 以一个 changeset 写盘并返回 `IndexedConfigEntityResult`。
8. 前端记录一条文件级 history。
9. 前端只基于 result 刷新列表、cache 和选中 ID。
