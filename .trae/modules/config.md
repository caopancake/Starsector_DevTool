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
- `src/domain/config/mod-overview.ts` 生成配置概览页使用的统计、资源状态和路径展示模型。
- `src/app/composables/useConfigFactionViewModel()` 统一编排 Faction 列表、选中项和图片资源。
- `src/app/composables/useConfigMissionViewModel()` 统一编排 Mission 列表、选中项、entity query 和图片资源。
- `src/app/composables/useConfigVariantViewModel()` 统一编排 Variant 列表、选中项、hull 引用、缩略图和创建删除。
- `src/app/composables/useConfigSkinViewModel()` 统一编排 Skin 列表、选中项、hull 引用、缩略图和创建删除。
- `src/services/config-entity.service.ts` 封装配置 entity query 和配置写入业务入口。
- `src/domain/config/config-entities.ts` 定义配置 entity 默认数据、列表展示模型、schema 表单模型、schema 表单到写入模型的转换、索引行构造和配置 history 语义文案。
- `src/services/config-resource.service.ts` 封装配置列表、预览和 hull 引用的资源补图。
- `src/services/write.service.ts` 只透传 Rust 返回的统一写入结果模型。
- `src/orchestrators/config-save.orchestrator.ts` 统一记录配置保存的文件级 history。
- `src/shared/api/query-api.ts` 只封装配置 entity query 的 wire command。
- `src/shared/api/config-entity-api.ts` 只封装配置 entity 保存相关 wire command。
- `src/shared/api/files-api.ts` 封装 `mod_info.json` 保存使用的通用文件写入 command。
- `src-tauri/src/services/config/indexed_entities.rs` 统一处理 indexed config entity 的 CSV index、target adapter 和 changeset。

## 规范

- 配置组件只消费 ViewModel 暴露的状态和动作，不直接调用 query service、resource cache、write service 或保存 orchestrator。
- 配置组件不能直接记录 file history，必须通过 ViewModel 或配置保存 orchestrator。
- 配置组件不能直接调用资源缓存服务；资源补图必须由 ViewModel 或配置 service 提供。
- 配置概览页的统计分组、合计和原版资源路径文本归属配置 domain，组件不得自行维护统计清单、切片下标或本地路径拼接。
- Faction、Mission、Variant 和 Skin 的 view 容器必须通过对应 `useConfig*ViewModel()` 取得列表状态、选中状态和刷新动作。
- 配置实体选中 ID 缺失必须以 null 表达，不能用空字符串伪装为实体 ID。
- `mod_info.json` 保存只写 `mod_info.json`。
- Faction 和 Mission 必须走同一套 indexed config entity 保存入口：`saveIndexedConfigEntityAction()`、`createIndexedConfigEntityAction()`、`deleteIndexedConfigEntityAction()`。
- Mission 列表和详情读取必须走 ProjectSession entity query，不允许恢复独立 mission 读取 command 或前端 API。
- Mission entity 详情查询只读取 `mission_list.csv` 注册的任务；未注册 ID 必须返回 null，不能合成临时列表行伪装为可编辑任务。
- Mission entity 查询中 `mission_list.csv` 的空行和注释行不产生实体；非注释注册行缺少正式 mission id 必须返回错误，不能静默跳过。
- 前端业务层只提交正式 `IndexedConfigKind`、`previousId`、`nextId`、`indexRow`、`entityData` 和 `deletePreviousTarget`，不能分别调用势力或战役专用保存 command。
- 配置写入对象的可空 ID / 路径字段必须显式提交 null，布尔控制字段必须显式提交 true 或 false，不能依赖缺省字段表达 wire 语义。
- Rust 只暴露 indexed config entity command；Faction 和 Mission 的差异只存在于 Rust target adapter。
- Faction adapter 维护 `data/world/factions/factions.csv` 和 `data/world/factions/{id}.faction`。
- Faction 索引 CSV 指向的 `.faction` 文件是正式配置输入；文件读取失败、解析失败或顶层不是 JSON object 都必须返回错误，不能从势力列表和蓝图标签索引中静默跳过。
- Faction 索引 CSV 中的空行和注释行不产生实体；非注释注册行缺少正式 faction id 必须返回错误，不能静默跳过。
- Faction 蓝图标签归属只能登记由当前 faction id 正向派生的 blueprint tag，并且按标签字段分隔后的完整 token 匹配，不能用排除通用 tag 的黑名单规则或子串包含判断归属。
- Mission adapter 维护 `data/missions/mission_list.csv` 和 `data/missions/{id}/`，保存时覆盖 `descriptor.json` 与 `mission_text.txt`，改 ID 时复制旧目录资源再删除旧目录。
- `ConfigMissionEditor.vue` 必须以 `localMission` schema 模型作为唯一编辑状态，不能用并行的 descriptor/text 状态作为保存回退。
- `mod_info.json`、Faction 和 Mission 的 schema 表单模型与写入模型转换归属配置 domain，组件和 ViewModel 不能各自聚合或拆分 source、提取 ID、清理内部字段或解释列表展示模型。
- Faction 和 Mission 写入 ID 必须来自 schema source 中的正式字符串字段；缺失、非字符串或空白 ID 必须作为模型错误暴露，不能用当前选中 ID、JSON 字符串化或空字符串回退。
- Faction 和 Mission 的修改、重命名和删除必须命中对应 index CSV 中的正式注册行；注册行不存在必须返回错误，不能把缺失索引当作创建或空删除继续写盘。
- 配置 service 从 entity query 或写入结果读取配置 entity 数据时，非对象数据和缺少正式字段必须作为错误暴露，不能压成空对象、空数组、空字符串或零值继续渲染。
- mission 删除目录必须使用目录级 changeset；faction 删除文件必须使用文件级 changeset。
- 前端配置 ID 预校验只能消费配置 domain 的统一 ID 规则，不能在组件或 ViewModel 中各自用路径字符判断。
- 配置 ID 是单个可移植 ASCII 标识段，前端预校验和 Rust 校验必须使用同一正向模型，禁止用路径字符黑名单判断。
- 配置 ID 必须由 Rust 校验，禁止路径穿越。
- 装配和舰船皮肤是单文件 schema entity，必须通过各自 shared API 和 config save orchestrator 进入文件级 history。
- ProjectSession 查询装配和舰船皮肤 entity 时，序列化或模型转换失败必须作为 query 错误返回，不能从列表中静默丢弃或伪装为 entity 不存在。
- 单文件 schema entity 的重复 ID 判断和重命名保存上下文归属 config domain，ViewModel 不得各自用布尔分支拼 previous id / previous path。

## 链路：保存 mod_info

1. 用户在 `ConfigModInfoEditor.vue` 保存。
2. ViewModel 或配置保存入口调用 `saveModInfoAction()`。
3. config save orchestrator 调用 `saveModInfo()`。
4. Rust file changes service 写入 `mod_info.json`。
5. Rust 返回 changeset。
6. config save orchestrator 记录文件级 history。
7. 前端根据写入结果的 `invalidatedPaths` 失效 session 和资源缓存。

## 链路：保存势力

1. 用户在 `ConfigFactionEditor.vue` 保存。
2. Faction ViewModel 调用 `saveIndexedConfigEntityAction()`，提交正式 `IndexedConfigKind`。
3. config save orchestrator 调用 `saveIndexedConfigEntity()`。
4. `config-entity-api.ts` 调用 Rust `save_indexed_config_entity` command。
5. Rust indexed entity service 校验 id、读取并 upsert `factions.csv`。
6. Rust faction adapter 构建 `data/world/factions/{id}.faction` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust faction adapter 构建旧 `.faction` 删除 change。
8. Rust 以一个 changeset 写盘并返回 `WriteResult`，并在 `refreshedEntity` 中返回 entity 数据。
9. 前端记录一条文件级 history。
10. 前端根据写入结果刷新 faction cache、选中 ID、session cache 和资源 cache。

## 链路：保存任务

1. 用户在 `ConfigMissionEditor.vue` 保存任务。
2. Mission ViewModel 调用 `saveIndexedConfigEntityAction()`，提交正式 `IndexedConfigKind`。
3. config save orchestrator 调用 `saveIndexedConfigEntity()`。
4. `config-entity-api.ts` 调用 Rust `save_indexed_config_entity` command。
5. Rust indexed entity service 校验 id、读取并 upsert `mission_list.csv`。
6. Rust mission adapter 构建 `data/missions/{id}/descriptor.json` 和 `data/missions/{id}/mission_text.txt` change。
7. 改 ID 且 `deletePreviousTarget` 为 true 时，Rust mission adapter 先复制旧目录完整 snapshot 到新目录，再覆盖 descriptor/text，再删除旧目录。
8. Rust 以一个 changeset 写盘并返回 `WriteResult`，并在 `refreshedEntity` 中返回 entity 数据。
9. 前端记录一条文件级 history。
10. Mission ViewModel 刷新列表、选中 ID、schema 状态和缓存。

## 链路：删除 indexed config entity

1. 用户在 entity list 或 editor header 删除条目。
2. 对应 ViewModel 调用 `deleteIndexedConfigEntityAction()`，提交 `kind`、`id` 和 `deleteTarget`。
3. config save orchestrator 调用 `deleteIndexedConfigEntity()`。
4. `config-entity-api.ts` 调用 Rust `delete_indexed_config_entity` command。
5. Rust indexed entity service 从对应 index CSV 移除 row。
6. Rust target adapter 按 `deleteTarget` 构建 `.faction` 文件删除或 mission 目录删除。
7. Rust 以一个 changeset 写盘并返回 `WriteResult`。
8. 前端记录一条文件级 history。
9. 前端只基于 result 刷新列表、cache 和选中 ID。
