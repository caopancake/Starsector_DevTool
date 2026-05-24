# 装配编辑模块

## 定义

装配编辑模块用于读取、浏览、新建、删除和 schema 表单编辑 `data/variants/**/*.variant` 文件。

## 边界

- `src/app/components/config/ConfigVariantView.vue` 作为装配完整模块容器，组合列表、编辑器和空状态。
- `src/app/components/config/ConfigVariantList.vue` 管理装配列表、新建和删除。
- `src/app/components/config/ConfigVariantEditor.vue` 编辑 `.variant` schema 表单。
- `schemas/variant.schema.json` 定义 `.variant` 表单字段。
- `src/domain/schema/` 渲染 schema 表单和复杂字段控件。
- `src-tauri/src/services/config/variants.rs` 统一处理 `.variant` 新建、保存、重命名和删除 changeset。
- `src-tauri/src/services/project/mod.rs` 在 ProjectSession 中索引并校验 `.variant` 文件。
- `src/shared/api/variants-api.ts` 封装装配 entity command。

## 规范

- `.variant` 读取不依赖 schema；schema 只负责前端表单渲染。
- 每个 `.variant` 必须有 `variantId` 和 `hullId`。
- `hullId` 可以指向 `.ship` 的舰船 ID，也可以指向 `.skin` 的 `skinHullId`；任何装配 hull 引用都必须把 `skinHullId` 当作合法 hull ID。
- `variantId` 必须在当前 Mod 内全局唯一。
- 装配模块不提供文件编辑器入口。
- 装配列表和新建 hull 下拉必须通过 ProjectSession hull reference query 解析 ship hull 与 skin hull；缩略图只能使用返回的 `ResourceRef` 再走批量资源 query。
- 保存允许修改 `variantId`；修改后必须在同一个 changeset 中删除旧文件并创建新文件。
- 新建路径固定为 `data/variants/{variantId}.variant`。
- 新建、保存、重命名和删除都必须进入文件级 history。
- 前端不能直接用 `saveModFilesWithHistory` 拼 `.variant` 文件操作，必须走 `saveVariantEntityWithHistory`、`createVariantEntityWithHistory` 或 `deleteVariantEntityWithHistory`。
- `ConfigVariantView.vue` 只维护选中 ID；列表和编辑器分别负责自己的 UI 状态。
- 装配详情页不显示额外总览统计块，只显示顶部当前文件信息和 schema 表单。
- `wings` 必须按逐项数组编辑，不能使用去重的多选控件。
- `modules` 字段的游戏格式是 `[{slotId: variantId}, ...]` 数组包裹单键对象；schema 使用 `type: "key-value"` + `format: "array-of-entries"` 声明此格式，SchemaFieldRenderer 在读写时做数组与扁平 key-value 之间的转换。

## 链路：读取装配

1. 前端打开 ProjectSession 或查询装配列表。
2. Rust 索引 `data/variants/**/*.variant`。
3. Rust 解析 JSON-like 文件。
4. Rust 校验 `variantId`、`hullId` 和重复 `variantId`。
5. Rust 通过 session manifest 或 entity query 返回装配摘要与实体数据。
6. 前端只缓存当前界面需要的装配列表和选中实体。
7. `ConfigVariantView.vue` 基于 query 结果渲染左侧列表和右侧 schema 表单。

## 链路：保存装配

1. 用户在 `ConfigVariantEditor.vue` 中编辑 schema 表单。
2. 用户触发保存。
3. 前端校验 `variantId`、`hullId` 和重复 ID。
4. 组件调用 `saveVariantWithFileHistory()`。
5. config save orchestrator 调用 `saveVariantEntity()`。
6. `variants-api.ts` 调用 Rust `save_variant_entity_with_history` command。
7. Rust 校验 `variantId`、`hullId` 和路径边界。
8. Rust 构建单文件修改 changeset；重命名时构建旧 `.variant` 删除和新 `.variant` 写入的同一 changeset。
9. Rust 写盘并返回 `VariantEntityResult`。
10. 前端记录文件级 history。
11. 前端只基于 result 同步当前装配列表并失效对应 session cache。

## 链路：新建装配

1. 用户在 `ConfigVariantList.vue` 输入 `hullId` 和 `variantId`。
2. 组件调用 `createVariantWithFileHistory()`。
3. config save orchestrator 调用 `createVariantEntity()`。
4. `variants-api.ts` 调用 Rust `create_variant_entity_with_history` command。
5. Rust 生成 `data/variants/{variantId}.variant` 的默认内容并写盘。
6. Rust 返回 `VariantEntityResult`。
7. 前端记录文件级 history，并只基于 result 更新列表和选中项。

## 链路：删除装配

1. 用户在 `ConfigVariantList.vue` 或 `ConfigVariantEditor.vue` 确认删除。
2. 组件调用 `deleteVariantWithFileHistory()`。
3. config save orchestrator 调用 `deleteVariantEntity()`。
4. `variants-api.ts` 调用 Rust `delete_variant_entity_with_history` command。
5. Rust 构建单文件删除 changeset 并写盘。
6. 前端记录文件级 history，并移除 project cache 中的对应装配。
