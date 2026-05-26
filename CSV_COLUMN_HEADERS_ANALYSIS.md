# Starsector DevTool: CSV Column Headers Localization Analysis

## Executive Summary

The Starsector DevTool project **already has a complete infrastructure for displaying Chinese translations of CSV column headers**. All 14 CSV column schema files have Chinese labels defined in their `label` field. However, **the UI is currently NOT using these labels** - it's displaying the English column keys instead.

### Current Status

- ✅ **Schema Layer**: All CSV column schemas have Chinese labels
- ❌ **Presentation Layer**: Table headers are using column keys, not labels
- ✅ **Detail Pane**: Already uses labels correctly

## 1. Column Schema System

### Location

- **Main Type Definition**: `src/domain/tables/csv-column-schema.ts`
- **Schema Files**: `schemas/csv/*.columns.json` (14 files)

### CsvColumnSchema Interface

```typescript
export interface CsvColumnSchema {
  key: string; // e.g., "name", "id", "designation"
  label?: string; // e.g., "名称", "ID", "定位" (Chinese translation)
  control: CsvColumnControl;
  source?: string;
  options?: string[];
  default?: string;
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  priority?: number;
}
```

The `label` field is **optional but present in all schemas**.

## 2. CSV Column Schemas - Full Coverage

All 14 schema files have complete Chinese label coverage (162 total columns):

- abilities.columns.json (9 columns) - 名称, ID, 类型, 标签, 图标, 描述...
- commodities.columns.json (7 columns) - 名称, ID, 图标, 价格, 排序...
- descriptions.columns.json (8 columns) - ID, 类型, 文本 1-5, 备注...
- hullmods.columns.json (15 columns) - 名称, ID, 等级, 标签, UI 标签...
- industries.columns.json (8 columns) - 名称, ID, 建造时间, 维护费...
- marketConditions.columns.json (9 columns) - 名称, ID, 标签, 行星...
- shipSystems.columns.json (28 columns) - 名称, ID, 幅能/秒, 冷却, 图标...
- ships.columns.json (20 columns) - 名称, ID, 定位, 战术系统, 结构, 装甲...
- simOpponents.columns.json (1 column) - 装配...
- skills.columns.json (7 columns) - ID, 名称, 图标, 描述, 分类...
- specialItems.columns.json (16 columns) - 名称, ID, 标签, 技术/制造商...
- submarkets.columns.json (7 columns) - ID, 名称, 势力, 描述...
- weapons.columns.json (25 columns) - 名称, ID, 类型, 射程, 伤害...
- wings.columns.json (10 columns) - ID, 装配, 标签, 装配点...

## 3. Grid Model & Column Data Flow

**File**: `src/domain/tables/csv-grid-model.ts`

```typescript
export interface CsvGridColumn {
  className: string;
  enumOptions: SelectOption[];
  key: string;
  schema: CsvColumnSchema | null; // Contains the label!
  widthPx: number;
}

function createCsvGridColumn(table: TableKey, key: string): CsvGridColumn {
  const schema = csvColumnSchemaFor(table, key);
  return {
    className: `schema-col-${schema?.control ?? 'text'}`,
    enumOptions: (schema?.options ?? []).map((option) => ({ label: option, value: option })),
    key,
    schema, // Schema with label is stored here
    widthPx: 0,
  };
}
```

Each CsvGridColumn includes the full schema with labels.

## 4. Where Headers Are Displayed - Current Implementation

### Table Header Component - THE ISSUE

**File**: `src/app/components/tables/CsvGridHeader.vue`

```vue
<template>
  <colgroup>
    <col v-for="column in columns" :key="column.key" :class="column.className" :style="{ width: `${column.widthPx}px` }" />
  </colgroup>
  <thead>
    <tr>
      <th v-for="column in columns" :key="column.key" :class="column.className">
        {{ column.key }}
        <!-- PROBLEM: Shows key instead of label -->
      </th>
    </tr>
  </thead>
</template>
```

**Line 7 is the problem**: Displays `{{ column.key }}` instead of using the available `{{ column.schema?.label ?? column.key }}`

## 5. Where Labels ARE Already Being Used

### Detail Pane (Right Side Panel)

**File**: `src/app/DetailPane.vue` (Line 196)

```typescript
function schemaPreviewItem(schema: CsvColumnSchema, row: RowData): SchemaPreviewItem {
  const value = cell(row[schema.key]);
  const base: SchemaPreviewItem = {
    display: value,
    key: schema.key,
    kind: schema.control,
    label: schema.label ?? schema.key, // Already uses labels correctly!
    meta: csvColumnControlLabel(schema.control),
    sprite: '',
    value,
    values: [],
  };
  // ...
}
```

The Detail Pane already shows Chinese labels in the "字段速览" section.

## 6. Solution: Add Chinese Translations to Table Headers

### Option 1: Simple Fix (Recommended)

Modify `src/app/components/tables/CsvGridHeader.vue` line 7:

**FROM:**

```vue
<th v-for="column in columns" :key="column.key" :class="column.className">{{ column.key }}</th>
```

**TO:**

```vue
<th v-for="column in columns" :key="column.key" :class="column.className">{{ column.schema?.label ?? column.key }}</th>
```

**Benefits:**

- Single line change
- Follows existing pattern in DetailPane.vue
- Backward compatible (fallback to key if label missing)
- All data already available
- No new dependencies

## 7. Width Calculation Support

**File**: `src/domain/tables/csv-grid-model.ts` (Lines 162-172)

```typescript
function textWidthPx(value: string, kind: 'cell' | 'header'): number {
  const base = kind === 'header' ? 8.2 : 7.2;
  let width = 0;
  for (const char of value) {
    if (/[一-鿿]/u.test(char))
      width += 12; // Chinese characters!
    else if (char === '_' || char === '-' || char === '/') width += 6.5;
    else if (char === ' ') width += 4;
    else width += base;
  }
  return Math.ceil(width);
}
```

✅ Already supports Chinese character width calculation!

The width system correctly handles Chinese characters (12px per character), so column widths will auto-adjust properly when switching to Chinese labels.

## 8. Component Hierarchy

```
TableWorkspace.vue (table display)
  ↓
DataTable.vue (wrapper)
  ↓
CsvGrid.vue (passes columns)
  ↓
CsvGridHeader.vue (renders headers) ← NEEDS ONE-LINE FIX
```

## 9. Examples of Column Translations

### Ships Table

- "name" → "名称"
- "id" → "ID"
- "designation" → "定位"
- "system id" → "战术系统"
- "hitpoints" → "结构"
- "armor rating" → "装甲"
- "shield type" → "护盾类型"
- "max flux" → "最大幅能"

### Weapons Table

- "name" → "名称"
- "id" → "ID"
- "type" → "类型"
- "range" → "射程"
- "damage/shot" → "每发伤害"
- "damage/second" → "每秒伤害"
- "proj speed" → "弹速"

### Ship Systems Table

- "name" → "名称"
- "id" → "ID"
- "flux/second" → "幅能/秒"
- "toggle" → "切换"
- "cooldown" → "冷却"

## 10. Before/After Example

### Current Display (English Keys)

```
| name | id | designation | system id | hitpoints | armor rating |
```

### After Fix (Chinese Labels)

```
| 名称 | ID | 定位 | 战术系统 | 结构 | 装甲 |
```

## 11. Implementation Summary

All the infrastructure for Chinese CSV column header translations is complete:

✅ Chinese labels defined in all 14 schema files (162 columns)
✅ CsvColumnSchema interface supports label field
✅ CsvGridColumn includes full schema with labels
✅ Grid model correctly passes schema through to headers
✅ Text width calculation handles Chinese characters
✅ Fallback system (uses key if label not present)
✅ Existing precedent in DetailPane.vue

❌ Only missing piece: One-line fix in CsvGridHeader.vue to display labels

**This is a minimal, low-risk change with complete data already in place.**
