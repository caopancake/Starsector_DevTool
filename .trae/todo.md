# Todo

后续工作按 phase 推进。每个 phase 完成后应更新本文档。

## Phase 1: 参考 sf-edit 为舰船编辑器加入各种快捷键

- [x] 在总览之外的各标签栏界面中实现画布内自动吸附最近点并视作选中，吸附距离不限，并同步右侧编辑栏高亮。
- [x] 在总览之外的各标签栏界面中保留画布外手动点击选择行为，避免只能依赖自动吸附。
- [x] 明确武器、甲板、引擎、边界、范围各模式下“自动吸附选中”和“手动点击选中”的优先级与切换规则。
- [x] 为舰船编辑器大修补手动验收清单，覆盖自动吸附、手动选择、右侧同步和模式切换。

## Phase 1.1: 完善舰船编辑器快捷键

- [x] 支持 `P` 进入总览、`C` 进入范围、`B` 进入边界、`W` 进入武器、`L` 进入甲板、`E` 进入引擎。
- [x] 支持 `T` 快速打开右侧标签栏并选中当前物件。
- [x] 明确这些快捷键与输入框聚焦、右侧表单编辑、系统快捷键和现有撤销/重做的冲突处理规则。
- [x] 在合适位置提供舰船编辑器快捷键提示，避免快捷键完全隐蔽。

## Phase 1.2: 支持 Shift / Ctrl / Alt 左键行为

- [x] 范围：允许直接拖动舰船中心和护盾中心；`Shift+左键` 预览并重设 `collisionRadius`；`Ctrl+左键` 预览并重设 `shieldRadius`；角度或半径相关数值按 1 度或当前既定精度处理。
- [x] 边界：`Shift+左键` 按鼠标位置在最末端插入节点；`Ctrl+左键` 按鼠标位置在最近边段插入节点。
- [x] 武器：普通左键改为旋转槽位角度，角度 clamp 到 1 度；`Shift+左键` 按鼠标位置复制一个新武器槽位；`Ctrl+左键` 才执行拖动；`Alt+左键` 按鼠标位置修改武器允许射角，射角 clamp 到 1 度。
- [x] 甲板：`Shift+左键` 按鼠标位置新建一个新甲板槽位。
- [x] 引擎：普通左键改为旋转引擎角度，角度 clamp 到 1 度；`Shift+左键` 按鼠标位置复制一个新引擎；`Ctrl+左键` 才执行拖动引擎。
- [x] 为这些组合操作补操作指南，并明确它们与右键平移、自动吸附选中和撤销链路的协同方式。

## Phase 1.3: 舰船/武器编辑器表单与贴图行为整理

- [x] 舰船编辑器和武器编辑器中所有数字输入控件不再显示加号和减号。
- [x] 修复当前折叠展开行为错误，确保各分组展开/收起状态稳定、间距正常、不会串状态。
- [x] 舰船编辑器“贴图”分组移除“选择已有”能力。
- [x] 舰船编辑器“贴图”分组新增“更新贴图宽高”按钮，把船体属性中的 `width` 和 `height` 同步为当前贴图尺寸。
- [x] 为贴图宽高同步、折叠行为和数字输入控件补最小手动验收清单。

## Phase 2: 多 Mod 工作区数据契约与状态模型

- [x] 将现有 `project` 单 Mod 状态升级为 workspace / project 集合状态，并定义稳定的数据结构。
- [x] 明确前端 workspace、tables、editors、settings 四类状态的边界，以及每个 Mod 的隔离粒度。
- [x] 明确后端 `AppData`、前端 `AppData`、共享类型和持久化结构如何从单 Mod 升级到多 Mod。
- [x] 调整 `tables` store，使 CSV 表格、当前 tab、搜索、筛选、选择和 dirty state 按 Mod 隔离。
- [x] 调整 `editors` store，使舰船、武器、弹体和各种预览弹窗状态按 Mod 或当前 workspace 上下文定位。
- [x] 调整保存、新建、删除、上传贴图链路，确保所有写入明确指向当前 Mod。
- [x] 更新 `.trae/editor-flows.md`，记录多 Mod 下打开、切换、编辑、保存的完整链路。
- [x] 前后端同步实施，后端保持无状态设计（payload 中 modRoot 参数化），前端实现完整多 Mod 隔离。

## Phase 2.1: 多 Mod 持久化、恢复与单例化

- [x] 定义工具私有持久化位置和格式，避免写入 Mod 目录内的私有状态。
- [x] 持久化已导入 Mod 列表、最近选中的 Mod、展开状态、设置和可恢复的 UI 状态。
- [x] 启动时自动恢复已导入 Mod；对不存在或读取失败的 Mod 给出可见提示，并允许移除失效项。
- [x] 处理路径不存在、权限不足、重复导入、`mod_info.json` 缺失或读取失败等异常情况。
- [x] 实现程序单例化，定义第二个实例启动时如何处理已有工作区和恢复逻辑。
- [x] 为持久化读写增加编码检查和异常处理。
- [x] 为多 Mod 恢复上次会话、单例化和异常路径补最小测试或手动验收流程。
- [x] 前后端同步实施。

## Phase 2.2: 软件 IDE 化 UI 壳层

- [x] 将左侧导航从”数据模块”改为”Mod 列表”，每个 Mod 下展开舰船、武器、联队、船插、工业等数据模块。
- [x] 新增总览页面，展示已导入 Mod、当前状态、未保存修改、数据统计和常用入口。
- [x] 新增设置页面入口，为后续主题、颜色、持久化和工具选项提供承载位置。
- [x] 支持导入多个 Mod、切换 Mod、移除 Mod；移除只取消导入，不删除本地文件。
- [x] 切换或移除 Mod 时处理未保存修改提示，避免跨 Mod 丢失 dirty state。
- [x] 验证多 Mod 打开、切换、移除、恢复上次会话与当前 UI 壳层交互是否顺畅。

## Phase 3: 完善设置界面和主题系统

- [ ] 在设置界面加入亮色/暗色主题切换，并与右上角太阳/月亮按钮保持双向同步。
- [ ] 增加多种强调色选项，例如蓝、橙、绿、青、粉、紫、灰等。
- [ ] 将主题模式和强调色持久化到工具设置中。
- [ ] 调整 Naive UI theme overrides 和 CSS token，使强调色影响按钮、选中态、dirty 之外的主强调状态。
- [ ] 验证浅色/暗色与所有强调色组合下，表格、右侧面板、编辑器、总览页和弹窗仍可读。
- [ ] 更新 `.trae/frontend-guidelines.md` 的主题和 token 规范。

## Phase 4: 建立完整修改链路和全局历史

- [x] 定义统一修改事件模型，覆盖 CSV 单元格、记录新建/删除、`.ship/.wpn/.proj` 编辑、贴图字段写入等操作。
- [x] 建立全局 undo/redo 历史栈，允许连续记忆所有可撤销修改。
- [x] 设计跨页面、跨弹窗、跨 Mod 的撤销重做规则，明确当前页面关闭、切换模块、切换 Mod、重新打开编辑器后的行为。
- [x] 明确哪些操作不可撤销，例如已经写入磁盘的删除、覆盖贴图、外部文件变化，并在 UI 中给出清晰反馈。
- [x] 将现有编辑器局部 history 接入统一修改链路，避免多个互不相通的撤销栈。
- [x] 为跨页面撤销、连续重做、保存后历史处理补回归测试或最小手动验收流程。

## Phase 5: 配置模块 — mod_info、势力、战役、星系

详细设计见 `.trae/specs/phase5-config-modules.md`。

### Phase 5.1: Mod 信息编辑

- [x] 后端：`save_mod_info` command
- [x] 前端：`WorkspaceView` 扩展（新增 `'config'`）+ `ConfigWorkspace.vue` 容器
- [x] 前端：`ModInfoEditor.vue`（结构化表单 + JSON 兜底）
- [x] 前端：`config.store.ts` + `config.service.ts` 基础框架
- [x] 前端：`ModTreeItem.vue` 新增"配置模块"分组
- [x] 前端：`JsonFieldEditor.vue` 通用 JSON 字段编辑器
- [x] 保存/dirty/undo 集成
- [x] 验收：编辑 mod_info.json 字段 → 保存 → 重载验证

### Phase 5.2: 势力编辑

- [x] 后端：`load_factions` / `save_faction` / `create_faction` / `delete_faction`
- [x] 前端：`FactionList.vue`（列表 + 颜色色块预览 + 新建/删除）
- [x] 前端：`FactionEditor.vue`（已知字段表单 + 颜色选择器预览 + tags 编辑）
- [x] 前端：`ColorArrayInput.vue`（[R,G,B] 输入 + 实时色块预览）
- [ ] 前端：旗帜/标志图片预览（加载 Mod 内图片资源 logo/crest）
- [x] 保存/dirty/undo 集成
- [x] 验收：列表展示 → 选择 → 编辑颜色/标签 → 保存 → 新建/删除 faction

### Phase 5.3: 战役编辑

- [x] 后端：`scan_campaign` / `load_campaign_csv` / `save_campaign_csv`
- [x] 前端：`CampaignView.vue`（CSV 文件列表 + 可编辑表格 + 保存）
- [x] 前端：API 层新增 `scanCampaign` / `loadCampaignCsv` / `saveCampaignCsv`
- [x] 前端：`ConfigWorkspace.vue` 集成 CampaignView
- [ ] 前端：campaign JSON 文件用混合表单编辑
- [x] 验收：显示 campaign CSV → 编辑 → 保存

### Phase 5.4: 星系文件编辑

- [x] 后端：`scan_world_files` / `load_world_file` / `save_world_file`
- [x] 前端：`WorldFilesView.vue`（文件列表 + JsonFieldEditor 编辑）
- [x] 保存/dirty/undo 集成
- [x] 验收：列表展示 → 选择 → 编辑 → 保存

## Phase 6: Schema Registry + 游戏全量读取

详细设计见 `.trae/specs/phase10-schema-registry.md`。

### Phase 6.1: 游戏全量读取基础

- [ ] 支持指定 Starsector 游戏根目录，而不仅是单个 Mod 根目录。
- [ ] 自动识别原版 `starsector-core` 数据和 `mods/` 下所有可用 Mod。
- [ ] 建立游戏级项目模型，区分原版数据、每个 Mod 数据和当前可编辑目标。
- [ ] 支持在 UI 中切换原版数据、不同 Mod、合并视图或对照视图。
- [ ] 明确原版数据默认只读，避免误写 `starsector-core`。
- [ ] 处理未启用 Mod、缺失 `mod_info.json`、重复 id、依赖关系和加载顺序等情况。
- [ ] 为武器、弹体、舰船等跨 Mod 引用提供 fallback 和来源标识。
- [ ] 持久化最近打开的游戏目录、Mod 选择状态和用户视图设置。
- [ ] 为游戏目录扫描、原版 fallback、多 Mod 冲突和切换编辑目标补最小测试或手动验收流程。

### Phase 6.2: Schema 格式定义 + 初始 schema 文件

- [x] 定义 Schema 文件格式标准（`schemas/*.schema.json`），包含 sections → fields → type/label/description/default/source。
- [x] 定义字段类型系统：string、text、integer、float、boolean、enum、color-rgb、path-image、string-array、tag-select、object、array-of-object、key-value。
- [x] 定义数据源引用语法（`source` 字段）：`csv:ships.tags`、`csv:weapons.id`、`json:factionFiles.*.id`、`enum:SMALL,MEDIUM,LARGE`。
- [x] 编写初始 Schema 文件：`mod-info.schema.json`、`faction.schema.json`。
- [ ] 编写 CSV 列定义 Schema：`csv/ship_data.columns.json`、`csv/weapon_data.columns.json` 等。

### Phase 6.3: SchemaFormRenderer — 通用表单渲染器

- [x] 实现 `SchemaFormRenderer.vue` 通用组件，根据 schema 定义动态生成分节表单。
- [x] 实现各字段类型对应的控件映射（type → component）。
- [x] 实现 `source` 字段的数据源解析，从已加载的 AppData 中提取选项。
- [x] 实现"额外字段"区域：数据中有但 schema 中未定义的字段归入可编辑兜底区。
- [x] 实现"可添加字段"提示：schema 中有但数据中没有的字段显示为灰色可添加项。

### Phase 6.4: starsector-core 扫描 + Schema 动态补充

- [x] 扫描 `starsector-core` 中的 `.faction`、`.ship`、`.wpn`、`.proj` 文件，提取所有出现过的字段名。
- [x] 根据字段值推断类型（数组→string-array/array-of-object，数字→integer/float，对象→object，字符串→string）。
- [x] 将 core 中发现但 schema 未定义的字段动态合并到运行时 schema，标记"来自原版"。
- [x] 合并后的完整 schema 驱动编辑器 UI，覆盖所有已知+发现字段。
- [x] 为势力编辑器的"额外字段"区域，直接以表格化表单呈现 core 中发现的字段，而非纯 JSON 编辑。

### Phase 6.5: 迁移现有编辑器到 Schema 驱动

- [x] 将 `FactionEditor.vue` 从硬编码表单迁移为 SchemaFormRenderer + `faction.schema.json` 驱动。
- [x] 将 `ModInfoEditor.vue` 从硬编码表单迁移为 SchemaFormRenderer + `mod-info.schema.json` 驱动。
- [ ] 评估 `ShipEditor` / `WeaponEditor` / `ProjectileEditor` 的右侧检查器面板是否可部分迁移到 schema 驱动（画布交互部分保留）。
- [x] 验证迁移前后 UI 行为一致，未丢失字段编辑能力。

## Phase 7: 自动数据校验和警示

- [ ] 建立统一数据校验入口，覆盖 CSV 表格、`.ship`、`.wpn`、`.proj` 和贴图资源。
- [ ] 对贴图宽度或高度为奇数的资源给出警示。
- [ ] 对贴图高度不为 4 的倍数的 hardpoint 武器贴图资源给出警示。
- [ ] 对坐标类字段含小数点的情况给出警示，包括武器位置、甲板位置、引擎位置、边界点、舰船中心、护盾位置、炮口位置等。
- [ ] 对缺失舰船中心或护盾位置的舰船给出警示。
- [ ] 对没有炮口/barrel offset 的武器给出警示。
- [ ] 对 `collisionRadius` 小于 `shieldRadius` 的舰船给出警示。
- [ ] 对 `collisionRadius` 未覆盖所有武器位置、甲板位置、引擎位置、边界点的舰船给出警示。
- [ ] 对只能填数值的 CSV 表格列填入非数值的情况给出警示。
- [ ] 设计校验结果展示位置：总览页、表格行级标记、右侧详情提示、编辑器内字段提示和保存前汇总。
- [ ] 明确警示与阻止保存的边界；默认先警示，不轻易阻止保存。
- [ ] 为典型离谱数据样例补最小测试或手动验收清单。

## Phase 8: 重新梳理主界面快捷键

- [ ] 为主界面定义搜索、模块切换、记录选择、保存 CSV、删除、新建等快捷键。
- [ ] 明确主界面快捷键与多 Mod 导航、总览页、设置页之间的切换规则。
- [ ] 统一主界面的撤销、重做、保存、关闭等通用行为，并接入全局修改链路。
- [ ] 避免主界面快捷键和输入框、文本域、系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 9: 定义右键行为

- [ ] 定义主表格右键菜单：复制 ID、打开编辑器、删除、定位资源等。
- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 确保右键菜单不会破坏画布右键拖动平移体验。
- [ ] 为右键菜单行为补手动验收清单。

## Phase 10: 最终硬化、回归与整理

- [ ] 在全部大功能完成后，统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/editor-flows.md`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的跨阶段回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向，避免项目再次进入迁移期状态。

## Phase 11: 技能编辑器（Skills）

覆盖 `data/characters/skills/*.skill`（70 个文件），高 Mod 影响度。

- [ ] 后端：扫描 + 加载 + 保存 .skill 文件
- [ ] 前端：Schema 定义 `skill.schema.json`（从 starsector-core 分析字段结构）
- [ ] 前端：技能列表 + SchemaFormRenderer 驱动的编辑表单
- [ ] 前端：技能等级效果分组编辑（Level 1/2/3 + Elite 效果）
- [ ] 前端：所属天赋选择器（aptitude 关联）
- [ ] 集成左侧树"配置模块"分组
- [ ] 验收：列表 → 选择 → 编辑效果 → 保存

## Phase 12: 船皮编辑器（Skins）

覆盖 `data/hulls/skins/*.skin`（66 个文件），高 Mod 影响度。

- [ ] 后端：扫描 + 加载 + 保存 .skin 文件
- [ ] 前端：Schema 定义 `skin.schema.json`
- [ ] 前端：船皮列表（含基础船体名称关联）+ 编辑表单
- [ ] 前端：基础船体选择器（从 ships 数据中选取 hullId）
- [ ] 前端：武器槽类型覆盖编辑器（slotType 修改）
- [ ] 前端：内置船插列表编辑（builtInMods）
- [ ] 前端：贴图覆盖路径配置（spriteName 覆盖 + 预览）
- [ ] 验收：列表 → 选择 → 编辑船皮配置 → 保存

## Phase 13: 舰船变体编辑器（Variants）

覆盖 `data/variants/**/*.variant`（447 个文件），当前仅只读。

- [ ] 后端：加载 + 保存 .variant 文件（已部分实现加载）
- [ ] 前端：Schema 定义 `variant.schema.json`
- [ ] 前端：变体列表（按船体分组）+ 编辑表单
- [ ] 前端：武器装配编辑器（从 weapons CSV 选取武器 → 分配到武器槽）
- [ ] 前端：船插选择器（从 hullmods CSV 选取）
- [ ] 前端：联队选择器（从 wings CSV 选取）
- [ ] 前端：新建/删除变体
- [ ] 验收：列表 → 选择 → 编辑装配 → 保存

## Phase 14: 战役系统扩展

覆盖剩余战役相关文件。

### 14.1: 战役 CSV 补全

- [ ] 添加 `abilities.csv` 编辑支持（舰队能力定义）
- [ ] 添加 `commodities.csv` 编辑支持（贸易商品）
- [ ] 添加 `submarkets.csv` 编辑支持（市场类型）
- [ ] 添加 `market_conditions.csv` 编辑支持（市场条件）
- [ ] 添加 `bar_events.csv` 编辑支持（酒吧事件）
- [ ] 添加 `sim_opponents.csv` 编辑支持（模拟对手）
- [ ] 添加 `special_items.csv` 编辑支持（特殊物品）

### 14.2: 经济系统编辑

- [ ] 后端：扫描 + 加载 `data/campaign/econ/*.json`
- [ ] 前端：经济系统文件列表 + JSON 表单编辑
- [ ] 前端：星系市场配置可视化

### 14.3: 星系生成参数（Procgen）

- [ ] 后端：扫描 `data/campaign/procgen/*.csv`
- [ ] 前端：Procgen CSV 表格编辑
- [ ] 前端：参数调优界面（数值范围、权重等）

## Phase 15: 角色与本地化

### 15.1: NPC 系统

- [ ] 添加 `data/characters/skills.csv` 编辑支持（角色技能）
- [ ] 添加 `data/characters/people/*.json` 编辑支持（NPC 定义）

### 15.2: 本地化

- [ ] 添加 `data/strings/*.json` 编辑支持
- [ ] 添加 `data/strings/descriptions.csv` 编辑支持
- [ ] 前端：多语言对照编辑界面

## Phase 16: 高级配置

### 16.1: 游戏全局设置

- [ ] 添加 `data/config/settings.json` 编辑支持（2296 行，游戏核心参数）
- [ ] 前端：分类浏览（战斗/舰队/市场/UI 等大类）
- [ ] Schema 定义覆盖所有已知设置项

### 16.2: 战斗与引擎配置

- [ ] 添加 `data/config/battle_objectives.json` 编辑支持
- [ ] 添加 `data/config/engine_styles.json` 编辑支持
- [ ] 添加 `data/config/hull_styles.json` 编辑支持
- [ ] 添加 `data/config/sounds.json` 编辑支持

### 16.3: 任务编辑

- [ ] 后端：扫描 `data/missions/*/descriptor.json`
- [ ] 前端：任务列表 + 任务元数据编辑
- [ ] 前端：任务描述和目标配置
