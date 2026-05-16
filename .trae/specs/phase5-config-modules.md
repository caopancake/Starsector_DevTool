# Phase 5: 配置模块 — mod_info、势力、战役、星系

## 目标

在左侧 Mod 树中新增"配置模块"分组，支持编辑 Mod 的元数据、势力定义、战役配置和星系定义。编辑方式按数据结构适配：CSV 复用现有表格系统，JSON 使用混合模式（已知字段结构化表单 + 未知字段 JSON 编辑器兜底）。

---

## 左侧树结构

```
ModName ▼
├── ──── 数据模块 ────
│   ├── 舰船 (45)
│   ├── 武器 (32)
│   ├── 联队 (18)
│   ├── 船插 (62)
│   └── 工业 (7)
│
└── ──── 配置模块 ────          ← 新分组
    ├── Mod 信息                ← mod_info.json
    ├── 势力 (3)               ← data/world/factions/*.faction
    ├── 战役                    ← data/campaign/ 下 CSV + JSON
    └── 星系                    ← data/world/ 下非 factions 文件
```

点击配置模块项时：
1. `workspace.setActiveMod(modRoot)`
2. `workspace.currentView = 'config'`
3. `workspace.configView = 'mod-info' | 'factions' | 'campaign' | 'world'`

---

## 视图路由扩展

```typescript
type WorkspaceView = 'overview' | 'table' | 'settings' | 'config';
type ConfigView = 'mod-info' | 'factions' | 'campaign' | 'world';
```

App.vue 新增：
```vue
<ConfigWorkspace v-else-if="workspace.currentView === 'config'" />
```

---

## 模块一：Mod 信息 (`mod_info.json`)

### Phase 5.1

**数据来源：** `mod_info.json`（已在 `AppData.modInfo` 中加载为 RowData）

**UI：** 单页结构化表单 + 底部 JSON 兜底区

**已知字段表单：**

| 字段 | 控件 | 说明 |
|------|------|------|
| id | text input (只读) | Mod 唯一标识 |
| name | text input | Mod 显示名称 |
| author | text input | 作者 |
| version | text input 或 object 编辑 | 可以是 "1.0" 或 {"major":1,"minor":0,"patch":0} |
| gameVersion | text input | 兼容游戏版本 |
| description | textarea | Mod 描述 |
| modPlugin | text input | 入口插件类名 |
| jars | string[] 列表 | JAR 文件路径列表 |
| dependencies | array of {id, name?, version?} | 依赖列表表格 |
| totalConversion | switch | 是否全量转换 |
| utility | switch | 是否工具 Mod |

**未知字段：** 折叠的 JSON key-value 编辑器，支持增删改任意字段。

**保存链路：**
- 前端：`config.service.ts` → `saveModInfo(modRoot, data)`
- API：`tauri.saveModInfo(modRoot, data)`
- Rust：`save_mod_info` command → 写回 `mod_info.json`（结构化 pretty JSON）

**dirty 追踪：** 独立于 CSV dirty 系统。`config.store.ts` 维护 `modInfoDirty: boolean`，与 modInfo 初始快照对比。

---

## 模块二：势力 (`data/world/factions/*.faction`)

### Phase 5.2

**数据来源：** Rust 扫描 `data/world/factions/` 下所有 `.faction` 文件，解析为 JSON 对象

**UI：** 左列表 + 右表单（master-detail 布局）

**列表页：**
- 显示每个 faction 的 `displayName`、`id`
- 行前显示颜色色块预览（来自 `color` 字段 [R,G,B]）
- 支持新建和删除 faction 文件

**表单页（已知字段）：**

| 字段 | 控件 | 说明 |
|------|------|------|
| id | text (只读) | 文件名即 id |
| displayName | text input | 短名称 |
| displayNameLong | text input | 长名称 |
| displayNameWithArticle | text input | 含冠词名称 |
| displayNameIsOrAre | text input | "is" 或 "are" |
| color | [R,G,B] 颜色选择器 + 预览色块 | 势力主色 |
| baseColor | [R,G,B] 颜色选择器 + 预览色块 | 基础色 |
| darkColor | [R,G,B] 颜色选择器 + 预览色块 | 暗色 |
| logo | text input + 图片预览 | 标志路径 |
| crest | text input + 图片预览 | 旗帜路径 |
| shipNamePrefix | text input | 舰船名前缀 |
| description | textarea | 势力描述 |
| knownShips | tags 多选标签 | 已知舰船蓝图 |
| knownWeapons | tags 多选标签 | 已知武器蓝图 |
| knownFighters | tags 多选标签 | 已知联队蓝图 |
| knownHullMods | tags 多选标签 | 已知船插 |
| shipsWhenImporting | tags 多选标签 | 导入时可用舰船 |
| knownIndustries | tags 多选标签 | 已知工业 |
| priorityShips | tags 多选标签 | 优先舰船 |
| priorityWeapons | tags 多选标签 | 优先武器 |
| priorityFighters | tags 多选标签 | 优先联队 |
| relationships | array of {faction, value} 列表 | 势力关系 |
| portraits.male | string[] 列表 | 男性肖像路径 |
| portraits.female | string[] 列表 | 女性肖像路径 |

**颜色预览：** [R,G,B] 数组用三个数字 input + 一个色块实时预览。
**旗帜/标志预览：** 如果 `logo`/`crest` 路径指向 Mod 内文件，加载并显示图片预览。

**未知字段：** 折叠 JSON 编辑器区域

**保存链路：**
- 前端：`config.service.ts` → `saveFaction(modRoot, factionId, data)`
- API：`tauri.saveFaction(modRoot, factionId, data)`
- Rust：`save_faction` command → 写回 `data/world/factions/{id}.faction`

**dirty 追踪：** `config.store.ts` 维护 `factionDirty: Map<factionId, boolean>`

---

## 模块三：战役 (`data/campaign/`)

### Phase 5.3

**数据来源：** Rust 扫描 `data/campaign/` 目录

**文件分类：**
- **CSV 文件**（如 `rules.csv`、`sim_opponents.csv` 等）→ 复用表格系统
- **JSON 文件**（如特殊配置）→ 混合表单

**CSV 复用方案：**

现有 `TableKey` 是固定 union：`'ships' | 'weapons' | 'wings' | 'hullmods' | 'industries'`

扩展策略：
```typescript
// 保持核心 TableKey 不变（这些有特殊编辑器绑定）
type CoreTableKey = 'ships' | 'weapons' | 'wings' | 'hullmods' | 'industries';

// 新增动态 CSV key（campaign 下发现的 CSV 文件）
type CampaignCsvKey = `campaign:${string}`; // e.g. "campaign:rules", "campaign:sim_opponents"

type TableKey = CoreTableKey | CampaignCsvKey;
```

动态 CSV 完全复用现有：
- 相同的 `DataTable.vue` 渲染
- 相同的 dirty tracking（`dirty[key][rowKey][col]`）
- 相同的 `saveChanges()` / `revertChanges()` 流程
- 不绑定专用编辑器（无 `.ship`/`.wpn` 关联）

**战役 JSON 文件：**
- 列出发现的 JSON 文件
- 点击打开混合表单编辑

**UI：** 子导航 Tab（CSV 列表 | JSON 列表），CSV 直接用 TableWorkspace 渲染

---

## 模块四：星系 (`data/world/` 非 factions)

### Phase 5.4

**数据来源：** Rust 扫描 `data/world/` 下除 `factions/` 外的文件

**典型内容：** 星系生成脚本配置、procgen JSON 等

**UI：** 文件列表 + 通用混合表单编辑器

**保存链路：**
- `config.service.ts` → `saveWorldFile(modRoot, relativePath, data)`
- Rust：`save_world_file` command → 写回原路径

---

## 通用 JSON 兜底编辑器 (`JsonFieldEditor.vue`)

**功能：**
- 显示一个 key-value 列表，每行为 `key: value`
- value 类型自动推断：string/number/boolean/array/object
- 支持新增 key、删除 key、编辑 value
- array 和 object 类型递归展示（可折叠）
- 对基本类型提供 inline 编辑；对复杂类型提供展开子编辑器

**用途：** 所有混合表单的"未知字段"区域都使用此组件。

---

## 后端新增 (Rust)

### 新增 commands

| command | 功能 |
|---------|------|
| `save_mod_info` | 保存 mod_info.json |
| `load_factions` | 加载 data/world/factions/ 所有 .faction 文件 |
| `save_faction` | 保存单个 .faction 文件 |
| `delete_faction` | 删除一个 .faction 文件 |
| `create_faction` | 新建一个 .faction 文件 |
| `scan_campaign` | 扫描 data/campaign/ 返回 CSV 和 JSON 列表 |
| `load_campaign_csv` | 加载一个 campaign CSV |
| `save_campaign_csv` | 保存一个 campaign CSV |
| `scan_world_files` | 扫描 data/world/ 非 factions 文件 |
| `load_world_file` | 加载一个 world JSON 文件 |
| `save_world_file` | 保存一个 world JSON 文件 |

### AppData 扩展

```typescript
interface AppData {
  // 现有字段不变...
  
  // 新增
  factionFiles: Record<string, RowData>;   // factionId → parsed .faction content
  campaignCsvList: string[];               // campaign 下 CSV 文件的相对路径列表
  campaignCsvHeaders: Record<string, string[]>;  // 每个 campaign CSV 的表头
  campaignCsvs: Record<string, RowData[]>;       // 每个 campaign CSV 的行数据
  worldFileList: string[];                 // world 下非 factions 文件列表
}
```

---

## 前端新增

### 新 feature: `src/features/config/`

```
src/features/config/
├── config.store.ts              — 配置模块状态管理
├── config.service.ts            — 保存/加载 service
├── components/
│   ├── ConfigWorkspace.vue      — 配置模块主容器（路由子视图）
│   ├── ModInfoEditor.vue        — mod_info.json 表单
│   ├── FactionList.vue          — 势力列表
│   ├── FactionEditor.vue        — 势力详情表单
│   ├── CampaignView.vue         — 战役子导航
│   ├── WorldFilesView.vue       — 星系文件列表
│   ├── JsonFieldEditor.vue      — 通用 JSON 兜底编辑器
│   └── ColorArrayInput.vue      — [R,G,B] 颜色输入 + 预览
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `workspace.store.ts` | 新增 `configView` 状态 |
| `ModTreeItem.vue` | 新增"配置模块"分组渲染 |
| `App.vue` | 新增 `ConfigWorkspace` 路由分支 |
| `shared/types/index.ts` | 扩展 AppData |
| `shared/types/workspace.ts` | 扩展 WorkspaceView |
| `tables.store.ts` | TableKey 支持动态 campaign CSV |

---

## Phase 拆分

### Phase 5.1: Mod 信息编辑
- [ ] 后端：`save_mod_info` command
- [ ] 前端：`WorkspaceView` 扩展 + `ConfigWorkspace` 容器
- [ ] 前端：`ModInfoEditor.vue`（结构化表单 + JSON 兜底）
- [ ] 前端：`config.store.ts` + `config.service.ts` 基础框架
- [ ] 前端：`ModTreeItem.vue` 新增配置模块分组
- [ ] 前端：`JsonFieldEditor.vue` 通用 JSON 编辑器
- [ ] 保存/dirty/undo 集成
- [ ] 验收：编辑 mod_info.json 字段 → 保存 → 重载验证

### Phase 5.2: 势力编辑
- [ ] 后端：`load_factions` / `save_faction` / `create_faction` / `delete_faction`
- [ ] 前端：`FactionList.vue`（列表 + 颜色色块 + 新建/删除）
- [ ] 前端：`FactionEditor.vue`（已知字段表单 + 颜色预览 + 旗帜预览）
- [ ] 前端：`ColorArrayInput.vue`（[R,G,B] 输入 + 色块预览）
- [ ] 前端：旗帜/标志图片预览（加载 Mod 内图片资源）
- [ ] 保存/dirty/undo 集成
- [ ] 验收：列表展示 → 选择 → 编辑颜色/标签 → 保存 → 新建/删除 faction

### Phase 5.3: 战役编辑
- [ ] 后端：`scan_campaign` / `load_campaign_csv` / `save_campaign_csv`
- [ ] 前端：`TableKey` 动态扩展支持 campaign CSV
- [ ] 前端：`CampaignView.vue`（CSV 子 Tab + JSON 文件列表）
- [ ] 前端：campaign CSV 完全复用 DataTable + dirty/save 系统
- [ ] 前端：campaign JSON 文件用混合表单编辑
- [ ] 验收：显示 campaign CSV → 编辑 → 保存；JSON 文件编辑 → 保存

### Phase 5.4: 星系文件编辑
- [ ] 后端：`scan_world_files` / `load_world_file` / `save_world_file`
- [ ] 前端：`WorldFilesView.vue`（文件列表 + 混合表单）
- [ ] 保存/dirty/undo 集成
- [ ] 验收：列表展示 → 选择 → 编辑 → 保存

---

## 验证标准

每个子 Phase 完成后：
- `npm.cmd run typecheck` 零错误
- `npm.cmd run lint` 零 warning
- `npm.cmd run format:check` 通过
- `npm.cmd run encoding:check` UTF-8 无 BOM
- `cargo clippy` 零 warning（如有后端改动）
- 手动验收清单全部通过
