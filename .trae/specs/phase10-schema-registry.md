# Phase 10: 游戏全量读取 + Schema Registry 架构

## 问题背景

当前工具的每个编辑器都**硬编码**了已知字段列表（KNOWN_KEYS），导致：
- 用户无法知道游戏核心还暴露了哪些可配置字段
- 字段没有类型信息、范围约束或描述文档
- 游戏版本更新时需要修改 Vue 组件代码
- 无法自动发现 starsector-core 中的字段定义

## 核心解决方案：Schema Registry（模式注册表）

用**声明式 JSON Schema 驱动所有编辑器 UI**，而不是在组件中硬编码。

---

## Schema 文件格式标准

### 目录结构

```
schemas/
├── _meta.json                    ← Schema 版本、游戏版本兼容性
├── mod-info.schema.json
├── faction.schema.json
├── ship.schema.json
├── weapon.schema.json
├── projectile.schema.json
└── csv/
    ├── ship_data.columns.json
    ├── weapon_data.columns.json
    ├── wing_data.columns.json
    ├── hull_mods.columns.json
    └── industries.columns.json
```

### Schema 文件结构

```json
{
  "$schema": "starsector-devtool/schema/v1",
  "id": "faction",
  "targetFile": "data/world/factions/*.faction",
  "gameVersion": "0.97a",
  "sections": [
    {
      "id": "basic",
      "label": "基本信息",
      "collapsed": false,
      "fields": [...]
    }
  ]
}
```

### 字段定义

```json
{
  "key": "color",
  "type": "color-rgb",
  "label": "势力颜色",
  "description": "三元素数组 [R, G, B]，范围 0-255",
  "required": false,
  "editable": true,
  "default": [128, 128, 128],
  "warning": null,
  "source": null,
  "nested": null
}
```

---

## 字段类型系统

| type | UI 控件 | 适用场景 |
|------|---------|----------|
| `string` | n-input | 普通文本 |
| `text` | n-input textarea | 多行文本（description等） |
| `integer` | n-input-number (step=1) | 整数值（含 min/max） |
| `float` | n-input-number | 浮点数值 |
| `boolean` | n-switch | 开关 |
| `enum` | n-select | 枚举选择 |
| `color-rgb` | ColorArrayInput | [R,G,B] 颜色 |
| `path-image` | n-input + 图片预览 | 图片相对路径 |
| `path` | n-input | 普通文件路径 |
| `string-array` | n-dynamic-tags | 字符串数组 |
| `tag-select` | n-select multiple filterable tag | 从数据源选取标签 |
| `object` | 嵌套 section | 对象类型递归渲染 |
| `array-of-object` | 可展开表格 | 对象数组（如 dependencies） |
| `key-value` | JsonFieldEditor | 自由键值对 |

---

## 数据源引用（source 字段）

用于 `tag-select` 和 `enum` 类型，指定选项数据从哪里来：

```
"source": "csv:ships.tags"           → 从 ships CSV 的 tags 列提取去重
"source": "csv:weapons.id"           → 从 weapons CSV 的 id 列提取
"source": "csv:wings.id"             → 从 wings CSV 的 id 列提取
"source": "json:factionFiles.*.id"   → 从已加载 faction 文件的 id 字段提取
"source": "enum:SMALL,MEDIUM,LARGE,UNIVERSAL"  → 内联枚举值
"source": "sprites:ships"            → 从 availableSprites 列表提取
```

### Source 解析器

前端实现一个 `resolveSource(source: string, appData: AppData): SelectOption[]` 函数：
- 解析 source 字符串
- 从 AppData 中提取对应数据
- 返回 `{label, value}[]` 供 n-select 使用

---

## SchemaFormRenderer 组件设计

```vue
<!-- 输入 -->
<SchemaFormRenderer
  :schema="factionSchema"
  v-model="localData"
  :app-data="project.activeModData"
/>

<!-- 输出：根据 schema.sections 渲染分节表单 -->
<!-- 每个 section 一个 settings-section -->
<!-- 每个 field 根据 type 选择对应控件 -->
<!-- 数据中有但 schema 中未定义的字段 → "额外字段" 区域 -->
<!-- schema 中有但数据中没有的字段 → 灰色 "点击添加" 行 -->
```

---

## starsector-core 扫描 + 动态 Schema 合并

### 扫描流程

```
用户指定游戏根目录
  ↓
Rust 扫描 starsector-core/data/world/factions/*.faction
  ↓
对每个文件提取所有字段的 key path + 值类型
  ↓
合并所有文件的字段集合 → 生成 "发现字段列表"
  ↓
与本地 faction.schema.json 合并：
  - schema 已定义 → 保持 schema 的 label/type/description
  - core 中发现但 schema 未定义 → 自动添加，type 从值推断，标记 "origin: core"
  ↓
最终合并 schema 驱动 UI
```

### 类型推断规则

| 值特征 | 推断类型 |
|--------|----------|
| `[1, 2, 3]` 且长度=3 且全为 0-255 整数 | `color-rgb` |
| `[...]` 数组且元素为字符串 | `string-array` |
| `[...]` 数组且元素为对象 | `array-of-object` |
| `{tags: [...]}` | `tag-select`（嵌套提取） |
| `true` / `false` | `boolean` |
| 整数 | `integer` |
| 浮点数 | `float` |
| 字符串且以 `graphics/` 开头 | `path-image` |
| 字符串 | `string` |
| 对象（无 tags 子字段） | `object` |

---

## 渐进式迁移策略

Schema Registry 可以**渐进式**引入，不需要一次重写所有编辑器：

| 阶段 | 内容 | 依赖 |
|------|------|------|
| 10.1 | 游戏全量读取基础设施 | 无 |
| 10.2 | 定义 schema 格式 + 编写初始 schema 文件 | 无（纯静态 JSON） |
| 10.3 | SchemaFormRenderer 通用组件 | 10.2 |
| 10.4 | core 扫描 + 动态合并 | 10.1 + 10.2 |
| 10.5 | 迁移现有编辑器 | 10.3 |

### 兼容性保证

- 迁移过程中，schema 未覆盖的字段**始终**通过 JsonFieldEditor 兜底
- 数据永远不会因为 schema 缺失而丢失
- schema 文件缺失时，编辑器退化为当前行为（全 JsonFieldEditor）
- 用户可以自定义 schema 文件覆盖工具内置的

---

## 与现有架构的关系

- `schemas/` 目录随工具发布，与 `src/` 平级
- Rust 后端负责：读取 schema 文件、扫描 core 提取字段、合并返回最终 schema
- 前端负责：`SchemaFormRenderer` 根据 schema 渲染 UI
- 现有 `JsonFieldEditor` 成为 schema 系统的一个 field type 实现（`type: "key-value"`）
- 现有 `ColorArrayInput` 成为 `type: "color-rgb"` 的实现
- 现有 tag n-select 成为 `type: "tag-select"` 的实现
