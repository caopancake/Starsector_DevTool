# Schema 系统

## 定义

Schema 系统为配置页面提供字段定义、分组、枚举来源、多来源字段和通用表单渲染能力。

## 边界

- `src/features/schema/schema-service.ts` 加载静态 schema，并提供字段、section、source 和 nested value 工具。
- `src/features/schema/components/SchemaFormRenderer.vue` 渲染 schema section、额外字段和多来源字段。
- `src/features/schema/components/SchemaFieldRenderer.vue` 渲染单个字段控件。
- `src/features/schema/composables/use-schema-core-fields.ts` 接入 core 字段扫描结果。
- `src/schemas/` 存放静态 schema 文件。
- `src/shared/components/ColorPicker.vue` 是 schema 表单使用的共享颜色控件。

## 规范

- Schema 系统只负责表单结构和字段读写，不负责保存文件。
- 配置保存必须由 config save orchestrator 处理。
- `SchemaFieldRenderer` 只能通过字段类型选择控件，不应绕过 schema 直接写业务文件。
- 多来源字段必须通过 schema service 聚合和拆分。
- core discovered fields 只能作为 schema 的动态补充来源。

## 链路：渲染 Schema 表单

1. 配置组件加载对应 schema。
2. `schema-service.ts` 返回 sections 和 fields。
3. `SchemaFormRenderer.vue` 遍历 section。
4. `SchemaFormRenderer.vue` 为每个字段创建 `SchemaFieldRenderer`。
5. `SchemaFieldRenderer` 根据 field type 渲染控件。
6. 用户输入通过 v-model 写回配置组件持有的数据对象。
