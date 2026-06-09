# Schema 系统

## 定义

Schema 系统负责把静态字段声明、纯函数模型转换、当前表单目标运行时能力和字段组件渲染组合成可复用的前端表单模型。

## 参考

- `schemas/`：存放配置表单 schema 资产，字段声明、section、source、nested、format 和多来源描述都从这里进入前端。
- `src/app/components/config/ConfigFactionEditor.vue`：消费动态合并后的 faction schema，并把保存动作交给配置 ViewModel。
- `src/app/components/config/ConfigMissionEditor.vue`：消费静态 mission schema，并用显式 `modRoot + sessionId` 创建 runtime context。
- `src/app/components/config/ConfigModInfoEditor.vue`：消费动态合并后的 mod-info schema，并把 schema 传给保存 ViewModel 做拆分。
- `src/app/components/config/ConfigSkinEditor.vue`：消费静态 skin schema，并只把本地 `.skin` 草稿交给上层保存动作。
- `src/app/components/config/ConfigVariantEditor.vue`：消费静态 variant schema，并只把本地 `.variant` 草稿交给上层保存动作。
- `src/app/components/schema/SchemaFieldRenderer.vue`：按字段类型渲染单字段控件、plain 模式控件、source option 结果、路径选择动作、递归对象和数组编辑。
- `src/app/components/schema/SchemaFormRenderer.vue`：按 schema section 渲染表单、折叠状态和额外字段编辑入口。
- `src/app/composables/use-core-graphics.ts`：为 `path-image` 字段提供原版 graphics 路径候选。
- `src/app/composables/use-core-schema.ts`：加载原版字段扫描结果，并把动态字段合并到静态 schema。
- `src/app/composables/use-schema-runtime-context.ts`：把拥有页面传入的 manifest 或显式 `modRoot + sessionId` 转成 schema source query 与失效监听上下文。
- `src/app/composables/use-schema-source-options.ts`：拥有 schema 字段 source option 查询、请求竞态、失效订阅和 runtime limit。
- `src/app/composables/use-schema-path-picker.ts`：拥有 schema 路径字段文件选择、当前 Mod 归属判断和相对路径输出。
- `src/domain/schema/schema-registry.ts`：只拥有 schema asset 注册、asset 校验和 `getSchema()`。
- `src/domain/schema/schema-sections.ts`：拥有 section 归一化、字段 key、额外来源、内部字段和 section 折叠身份。
- `src/domain/schema/schema-sources.ts`：拥有多来源 schema model 聚合与拆分。
- `src/domain/schema/schema-values.ts`：拥有 plain/enhanced 值转换、UI strict JSON 文本、nested get/set、key-value、tag、number 和 boolean 转换。
- `src/domain/schema/schema-options.ts`：拥有 `SelectOption`、选项分组、当前值注入、source current values 和 hydrated source group 映射。
- `src/domain/schema/schema-core-fields.ts`：拥有原版 discovered fields 与静态 schema 的合并规则。
- `src/domain/schema/schema-runtime.ts`：拥有 `SchemaRuntimeContext`、source option limit 和 schema runtime 类型。
- `src/domain/schema/schema.types.ts`：定义 schema 文件、section、field、source 和 discovered field 的前端类型。
- `src/services/csv-table.service.ts`：执行 source option query，并把返回的 `ResourceRef` 批量 hydrate 成带缩略图的前端选项。
- `src-tauri/src/services/project/query/source_options.rs`：生成 `csv:*` source 的当前值、当前 Mod 和原版分组选项，并校验 source table 与列。

## 边界

- 存储边界：schema 资产是字段声明，不是待保存数据；schema 模块不写 Mod 文件、不写工具配置、不写 history。
- 错误边界：source table、source column、资源读取和 core 扫描错误由对应 service 返回；schema 组件只触发查询和显示字段级结果。
- 多来源边界：多来源 model 的聚合与拆分归 schema domain，保存前的业务必填、ID、路径和文件内容校验归配置 domain 或后端。
- 动态字段边界：core discovered fields 只能补充静态 schema 未声明的字段，不能覆盖静态字段定义。
- 额外字段边界：额外字段只编辑当前 model 中 schema 未声明且非内部字段的键，不能自行生成保存目标。
- 路径边界：路径选择只能接受当前 `modRoot` 内文件并输出 Mod 相对路径，不执行文件复制、上传或写盘。
- 四层边界：registry 只注册静态 schema asset；domain 只做纯函数模型转换；runtime 只处理当前表单目标的 source options、失效订阅和路径选择；components 只负责渲染和本地交互。
- 前端层级边界：schema domain 不访问 store、service、app runtime、Tauri 或组件；组件不得把 schema domain 工具替换成本地解释规则。
- 清洗边界：schema 内部字段识别归 schema domain 与共享内部字段规则，写盘清理归保存模块或 Rust 写入 service。
- 上下文边界：runtime context 必须由表单拥有方显式传入，字段组件不得从 active project store 自行推导 session 或 modRoot。
- 查询边界：字段 source options 只能通过 runtime context 调用 query service，组件不得直接调用 shared API 或 Rust command。
- 资源边界：字段选项缩略图只能消费 source query 返回的 `ResourceRef` 再经批量资源 query hydrate。
- 渲染边界：表单组件只负责 section、字段控件、折叠状态和本地输入事件，不拥有保存、删除、重命名、session 刷新或文件级 history。
- 状态边界：section 折叠和 select 打开状态是组件运行时状态；source option 请求序号、已加载选项和失效订阅归 schema runtime composable，不持久化。
- 值转换边界：普通文本、schema 数字、plain 模式布尔、逗号数组、tag 包装、key-value entry 和 nested set/get 都归 schema domain 纯函数。
- JSON 边界：schema UI 中的 object/array 文本只使用 strict JSON 解析和格式化；Rust `alex_json` 宽松 Starsector JSON-like 解析只属于后端文件读取链路。
- 消费边界：配置页、编辑器页和表格控件只能消费 schema 输出的字段模型和转换结果，不能反向改变 schema 资产的语义。

## 链路

### 注册与获取静态 schema

1. 应用启动后 Vite 以 JSON 资产形式加载 `schemas/*.schema.json`。
2. `schema-registry.ts` 将 schema asset 注册到静态 schema 表。
3. 消费组件按 schema id 调用 `getSchema()`。
4. `getSchema()` 返回对应 `FileSchema` 或 `null`。
5. `SchemaFormRenderer.vue` 调用 `getSchemaSections()` 获取 section。
6. `getSchemaSections()` 保留显式 sections，或把 flat fields 包装成默认 section。

### 合并原版发现字段

1. 消费组件调用 `useCoreSchema()`。
2. `useCoreSchema()` 从设置 store 或活动 manifest 取得 Starsector root。
3. `loadCoreFields()` 调用 assets service 查询原版字段扫描结果。
4. assets service 通过 shared API 调用后端 core fields query。
5. `useCoreSchema()` 在 root 仍匹配时保存 core fields。
6. 消费组件调用 `getMergedSchema(schemaId)`。
7. `getMergedSchema()` 取得静态 schema。
8. `mergeSchemaWithCoreFields()` 跳过静态 schema 已声明字段。
9. `mergeSchemaWithCoreFields()` 把新增字段追加到动态 section。

### 渲染 schema 表单

1. 消费组件把 `schema`、本地 model 和 `runtimeContext` 传给 `SchemaFormRenderer.vue`。
2. `SchemaFormRenderer.vue` 计算 sections、schema keys、extra source 和 extra keys。
3. `SchemaFormRenderer.vue` 按 schema id 与 section id 同步初始折叠状态。
4. `SchemaFormRenderer.vue` 对每个字段读取当前 model 中的 nested value。
5. `SchemaFormRenderer.vue` 创建 `SchemaFieldRenderer.vue`。
6. `SchemaFieldRenderer.vue` 根据设置 store 判断 plain 模式或增强控件模式。
7. `SchemaFieldRenderer.vue` 按 field type 渲染输入、数字、布尔、选择、颜色、路径、数组、对象、key-value 或 JSON 文本控件。
8. 字段更新事件回到 `SchemaFormRenderer.vue`。
9. `SchemaFormRenderer.vue` 用 schema domain 的 nested set 工具生成新 model。
10. 消费组件通过 `v-model` 接收更新后的本地草稿。

### 加载字段 source options

1. `SchemaFieldRenderer.vue` 把 field、value 和 runtime context 交给 `useSchemaSourceOptions()`。
2. `useSchemaSourceOptions()` 计算字段当前值集合。
3. `useSchemaSourceOptions()` 监听 `runtimeContext.sessionId`、`field.source` 和当前值集合身份。
4. `useSchemaSourceOptions()` 确认 source 为 `csv:*` 且 runtime context 存在。
5. `useSchemaSourceOptions()` 按 `SCHEMA_SOURCE_OPTION_LIMIT` 调用 `runtimeContext.querySourceOptions()`。
6. runtime context 调用 `queryTableSourceOptions()`。
7. query service 通过 query cache 调用 shared query API。
8. Rust source option query 校验 source table 与 source column。
9. Rust source option query 读取当前值、当前 Mod CSV 行和原版 CSV 行。
10. Rust source option query 对 ID 列附带可解析的 `ResourceRef`。
11. 前端 service 批量调用资源 data URL query。
12. schema domain 把 hydrated source option group 映射成表单 `SelectOption`。
13. `useSchemaSourceOptions()` 在请求身份仍匹配时更新本地选项。

### 监听 source option 失效

1. `useSchemaSourceOptions()` 根据 runtime context 与 field source 注册失效监听。
2. runtime context 同时订阅 query cache invalidation 和 resource cache invalidation。
3. query cache 按 Rust session invalidation 返回的 queryScopes 失效 `csv-source-options`，并支持 `source` 精确匹配和 `table` 派生匹配。
4. resource cache 按 Rust session invalidation 返回的 resource scope 发布命中的 `ResourceRef`。
5. runtime context 过滤 session、source 和当前字段持有的资源身份。
6. 匹配的失效事件触发 source options 重新加载。
7. 字段组件卸载时由 runtime composable 取消订阅。

### 路径字段选择

1. 字段组件在 path 或 path-image 字段上触发 `useSchemaPathPicker()` 提供的选择动作。
2. `useSchemaPathPicker()` 从 runtime context 读取 `modRoot`。
3. `useSchemaPathPicker()` 调用共享文件选择 runtime。
4. 用户选择文件后 `useSchemaPathPicker()` 判断文件是否属于 `modRoot`。
5. 属于当前 Mod 时输出 Mod 相对路径。
6. 不属于当前 Mod 时提示用户并保持当前字段值不变。
7. 字段组件只更新本地 model，不执行写盘。

### 多来源保存消费

1. 消费 ViewModel 或配置 domain 调用 `aggregateSchemaSources()` 构造表单 model。
2. `SchemaFormRenderer.vue` 编辑聚合后的 model。
3. 保存动作由消费模块触发。
4. 消费模块把本地 model 与 schema 传给配置 domain。
5. 配置 domain 调用 `splitSchemaSources()` 拆回各来源对象或文本。
6. 配置 domain 执行业务字段校验与保存草稿构造。
7. 保存 orchestrator 或 service 执行对应模块写盘链路。

## 规范

- `FileSchema.id` 是 schema 注册与消费的稳定身份，消费方不得用 displayName 推断 schema。
- `FieldSchema.key` 支持点路径，nested 读写必须使用 schema domain 的 get/set 工具保持对象不可变更新。
- `FieldSchema.source` 只有在 `csv:*` 格式且 runtime context 存在时才触发后端 source option query。
- `SchemaRuntimeContext` 必须包含当前表单目标的 `modRoot` 与 `sessionId`，缺失时字段 source options 必须表现为空结果。
- `SchemaRuntimeContext` 只属于 `src/domain/schema/schema-runtime.ts`，不得从 shared wire types 暴露。
- `SCHEMA_SOURCE_OPTION_LIMIT` 是 runtime 策略，字段组件不得硬编码 source option limit。
- `SelectOption` 的当前值分组、分组选项、资源引用提取和显示文本必须使用 schema domain helper。
- `csv:*` source 的后端结果必须按当前值、当前 Mod、原版分组返回，重复值只保留前面分组。
- `csv:*` source 声明的 table 和 column 必须存在；不存在时返回错误。
- `csv:*` source 的非 ID 列按逗号分隔提取 token，ID 列按整格值提取实体引用。
- `csv:*` source 不能把 CSV 注释行作为候选引用。
- `csv:ships.id` 的 hull 引用语义必须包含 ship hull 和 skin hull。
- `key-value` 字段使用 object 输出；带 `array-of-entries` format 时必须输出数组包裹单键对象。
- `path-image` 的候选下拉只来自原版 graphics 路径索引；文件选择必须命中 runtime context 的 `modRoot`，并输出 Mod 相对路径。
- `plain` 编辑模式必须保留字符串换行，字符串字段遇到换行必须使用 textarea。
- `tag-select` 必须保留原值是数组或 `{ tags: [] }` 的包装形态。
- 额外字段渲染必须排除 schema 内部字段。
- 多来源 `text-file` 拆分必须把 `{ content }` 展开为文本值。
- schema 数字输入清空时必须写回空字符串，不能强制写成 0；plain 数字无法解析为数字时必须保留原始文本。
- 布尔 plain 输入只在明确布尔文本命中时转换，否则保留原始文本。
- 保存、删除、重命名、history、session invalidation 和后端路径校验都不属于 schema 模块。

## 陷阱

- 把 schema 当成保存模型会让字段声明越过配置模块和 Rust 写入边界。
- 把 runtime context 改成从 active manifest 隐式读取会让独立上下文和跨 Mod 切换污染 source query。
- 把 source option 的 data URL 直接存进 schema model 会污染待保存业务数据。
- 把 `csv:*` 缺失列当作空候选会掩盖 schema 与 CSV 模型不一致。
- 把 key-value 的数组条目格式当作普通 object 会破坏 Starsector 原始文件语义。
- 把额外字段和内部字段混在一起编辑会把 UI 内部状态写入业务草稿。
- 把 plain 模式字符串降级成单行输入会丢失真实换行。
- 把路径选择结果直接作为绝对路径写入会绕过 Mod 相对路径语义。
- 在字段组件内直接调用 shared API 会破坏前端 service 和 query cache 边界。
- 在 schema domain 中访问 store 或 service 会破坏纯业务模型边界。
