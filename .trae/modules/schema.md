# Schema 系统

## 定义

Schema 系统为配置页面和 CSV 表格提供字段定义、分组、枚举来源、多来源字段和通用字段来源解析能力。

## 边界

- `src/domain/schema/schema-registry.ts` 加载静态 schema，并提供字段、section、source 和 nested value 工具。
- `src/app/components/schema/SchemaFormRenderer.vue` 渲染 schema section、额外字段和多来源字段。
- `src/app/components/schema/SchemaFieldRenderer.vue` 渲染单个字段控件。
- `src/app/composables/use-core-schema.ts` 接入 core 字段扫描结果。
- `schemas/` 存放静态 schema 文件。
- `schemas/*.schema.json` 存放配置表单 schema 文件。
- `schemas/csv/*.columns.json` 存放 CSV 列 schema 资产。
- `src/shared/ui/ColorPicker.vue` 是 schema 表单使用的共享颜色控件。

## 规范

- Schema 系统只负责表单结构和字段读写，不负责保存文件。
- schema 必须以文件资产形式存在；业务代码只负责加载、注册和渲染。
- 配置保存必须由 config save orchestrator 处理。
- `SchemaFieldRenderer` 只能通过字段类型选择控件，不应绕过 schema 直接写业务文件。
- Schema 路径字段选择文件时只能通过共享路径工具计算 Mod 相对路径，组件不得自行维护路径前缀规则。
- Schema 字段的普通文本值、plain 模式布尔/数字解析、逗号多值解析、tag-select 包装和路径显示名归属 schema domain，字段组件不得各自解释这些值语义。
- Schema source query 的当前值提取、后端 source option 到表单 SelectOption 的映射和 enum 静态选项生成归属 schema domain。
- Schema source query 的 runtime context 缺失必须以 null 表达，不能用空字符串伪装为 session 或 source。
- 多来源字段必须通过 schema service 聚合和拆分。
- 多来源字段拆分必须保留非法 source 原值并交由配置 domain 校验，不能把缺失、非对象或非文本 source 压成空对象或空文本。
- schema 内部字段必须通过 schema domain 规则识别；组件、配置清洗和额外字段渲染不得各自判断内部 key。
- 保留当前值的 select option 分组必须通过 schema domain 的 SelectOption helper 生成，组件和表格控件不得自行定义分组哨兵值。
- core discovered fields 只能作为 schema 的动态补充来源。
- `csv:*` source 必须解析为当前 Mod 与原版引用的分组选项，当前 Mod 分组在上，原版分组在下，重复 ID 以当前 Mod 为准。
- `csv:*` source 声明的列必须存在于对应 CSV header；缺失列必须返回 query 错误，不能用空候选项掩盖 schema 与 CSV 模型不一致。
- `csv:ships.id` 表示 hull 引用源，必须同时包含舰船 CSV ID 和舰船皮肤 `skinHullId`。
- hull 引用选项、hull 缩略图和联队经装配得到的 hull 缩略图都必须通过 `hull-references.ts` 派生。
- hull 引用 query 的目标集合必须按 reference id 语义命名，不能把 ship hull id 和 skin hull id 混称为单一 hull id 集合。
- `csv:*` source 必须过滤 `#` 开头 ID；这类 CSV 行可在表格中编辑，但不能作为合法引用。
- `key-value` 类型支持 `format: "array-of-entries"` 属性，声明底层数据为 `[{k:v}, ...]` 数组格式；底层数据与扁平 entry 之间的转换、文本值解析和新增 key 生成归属 schema domain。

## 链路：渲染 Schema 表单

1. 配置组件加载对应 schema。
2. `schema-registry.ts` 返回 sections 和 fields。
3. `SchemaFormRenderer.vue` 遍历 section。
4. `SchemaFormRenderer.vue` 为每个字段创建 `SchemaFieldRenderer`。
5. `SchemaFieldRenderer` 根据 field type 渲染控件。
6. 用户输入通过 v-model 写回配置组件持有的数据对象。
