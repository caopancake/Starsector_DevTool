# Todo

后续工作按 phase 推进。每个 phase 完成后应更新本文档。

## Phase 1: Schema Registry 收尾与游戏全量读取

本阶段承接已完成一半的 Schema Registry 工作：通用 schema、multi-source 表单、Mod 信息、势力、战役等已接入；剩余重点是游戏级读取、CSV 列 schema，以及评估编辑器检查器的 schema 化边界。

### Phase 1.1: 游戏全量读取基础

- [ ] 支持指定 Starsector 游戏根目录，而不仅是单个 Mod 根目录。
- [ ] 自动识别原版 `starsector-core` 数据和 `mods/` 下所有可用 Mod。
- [ ] 建立游戏级项目模型，区分原版数据、每个 Mod 数据和当前可编辑目标。
- [ ] 支持在 UI 中切换原版数据、不同 Mod、合并视图或对照视图。
- [ ] 明确原版数据默认只读，避免误写 `starsector-core`。
- [ ] 处理未启用 Mod、缺失 `mod_info.json`、重复 id、依赖关系和加载顺序等情况。
- [ ] 为武器、弹体、舰船等跨 Mod 引用提供 fallback 和来源标识。
- [ ] 持久化最近打开的游戏目录、Mod 选择状态和用户视图设置。
- [ ] 为游戏目录扫描、原版 fallback、多 Mod 冲突和切换编辑目标补最小测试或手动验收流程。

### Phase 1.2: CSV 列 Schema

- [ ] 编写 CSV 列定义 Schema：`csv/ship_data.columns.json`、`csv/weapon_data.columns.json` 等。
- [ ] 定义 CSV 列 Schema 格式：key、type、source、options、显示标签和可编辑性。
- [ ] 主表格根据列 Schema 渲染富控件，例如下拉选择器、path-image 缩略图、颜色块和数字输入。
- [ ] 保持 CSV 保存链路不变，只改变编辑展示和输入约束。

### Phase 1.3: 现有编辑器 Schema 化评估

- [ ] 评估 `ShipEditor` / `WeaponEditor` / `ProjectileEditor` 的右侧检查器面板是否可部分迁移到 schema 驱动。
- [ ] 明确画布交互、hit detection、拖拽、贴图上传等逻辑继续留在专用编辑器内。
- [ ] 如果迁移可行，先选低风险字段分组试点，不一次性重写整个编辑器。

## Phase 2: 自动数据校验和警示

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

## Phase 3: 重新梳理主界面快捷键

- [ ] 为主界面定义搜索、模块切换、记录选择、保存 CSV、删除、新建等快捷键。
- [ ] 明确主界面快捷键与多 Mod 导航、总览页、设置页之间的切换规则。
- [ ] 统一主界面的撤销、重做、保存、关闭等通用行为，并接入全局修改链路。
- [ ] 避免主界面快捷键和输入框、文本域、系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 4: 定义右键行为

- [ ] 定义主表格右键菜单：复制 ID、打开编辑器、删除、定位资源等。
- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 确保右键菜单不会破坏画布右键拖动平移体验。
- [ ] 为右键菜单行为补手动验收清单。

## Phase 5: 技能编辑器（Skills）

覆盖 `data/characters/skills/*.skill`，高 Mod 影响度。

- [ ] 后端：扫描 + 加载 + 保存 `.skill` 文件。
- [ ] 前端：Schema 定义 `skill.schema.json`，从 `starsector-core` 分析字段结构。
- [ ] 前端：技能列表 + SchemaFormRenderer 驱动的编辑表单。
- [ ] 前端：技能等级效果分组编辑（Level 1/2/3 + Elite 效果）。
- [ ] 前端：所属天赋选择器（aptitude 关联）。
- [ ] 集成左侧树配置分组。
- [ ] 验收：列表 → 选择 → 编辑效果 → 保存。

## Phase 6: 船皮编辑器（Skins）

覆盖 `data/hulls/skins/*.skin`，高 Mod 影响度。

- [ ] 后端：扫描 + 加载 + 保存 `.skin` 文件。
- [ ] 前端：Schema 定义 `skin.schema.json`。
- [ ] 前端：船皮列表（含基础船体名称关联）+ 编辑表单。
- [ ] 前端：基础船体选择器（从 ships 数据中选取 hullId）。
- [ ] 前端：武器槽类型覆盖编辑器（slotType 修改）。
- [ ] 前端：内置船插列表编辑（builtInMods）。
- [ ] 前端：贴图覆盖路径配置（spriteName 覆盖 + 预览）。
- [ ] 验收：列表 → 选择 → 编辑船皮配置 → 保存。

## Phase 7: 舰船装配编辑器（Variants）

覆盖 `data/variants/**/*.variant`，当前仅只读。

- [ ] 后端：加载 + 保存 `.variant` 文件。
- [ ] 前端：Schema 定义 `variant.schema.json`。
- [ ] 前端：装配列表（按船体分组）+ 编辑表单。
- [ ] 前端：武器装配编辑器（从 weapons CSV 选取武器 → 分配到武器槽）。
- [ ] 前端：船插选择器（从 hullmods CSV 选取）。
- [ ] 前端：联队选择器（从 wings CSV 选取）。
- [ ] 前端：新建/删除装配。
- [ ] 验收：列表 → 选择 → 编辑装配 → 保存。

## Phase 8: 生涯系统扩展

覆盖剩余生涯相关文件。

### Phase 8.1: 生涯 CSV 补全

- [ ] 添加 `abilities.csv` 编辑支持（舰队能力定义）。
- [ ] 添加 `commodities.csv` 编辑支持（贸易商品）。
- [ ] 添加 `submarkets.csv` 编辑支持（市场类型）。
- [ ] 添加 `market_conditions.csv` 编辑支持（市场条件）。
- [ ] 添加 `bar_events.csv` 编辑支持（酒吧事件）。
- [ ] 添加 `sim_opponents.csv` 编辑支持（模拟对手）。
- [ ] 添加 `special_items.csv` 编辑支持（特殊物品）。

### Phase 8.2: 经济系统编辑

- [ ] 后端：扫描 + 加载 `data/campaign/econ/*.json`。
- [ ] 前端：经济系统文件列表 + JSON 表单编辑。
- [ ] 前端：星系市场配置可视化。

### Phase 8.3: 星系生成参数（Procgen）

- [ ] 后端：扫描 `data/campaign/procgen/*.csv`。
- [ ] 前端：Procgen CSV 表格编辑。
- [ ] 前端：参数调优界面（数值范围、权重等）。

## Phase 9: 角色与本地化

### Phase 9.1: NPC 系统

- [ ] 添加 `data/characters/skills.csv` 编辑支持（角色技能）。
- [ ] 添加 `data/characters/people/*.json` 编辑支持（NPC 定义）。

### Phase 9.2: 本地化

- [ ] 添加 `data/strings/*.json` 编辑支持。
- [ ] 添加 `data/strings/descriptions.csv` 编辑支持。
- [ ] 前端：多语言对照编辑界面。

## Phase 10: 高级配置

### Phase 10.1: 游戏全局设置

- [ ] 添加 `data/config/settings.json` 编辑支持。
- [ ] 前端：分类浏览（战斗/舰队/市场/UI 等大类）。
- [ ] Schema 定义覆盖所有已知设置项。

### Phase 10.2: 战斗与引擎配置

- [ ] 添加 `data/config/battle_objectives.json` 编辑支持。
- [ ] 添加 `data/config/engine_styles.json` 编辑支持。
- [ ] 添加 `data/config/hull_styles.json` 编辑支持。
- [ ] 添加 `data/config/sounds.json` 编辑支持。

### Phase 10.3: 任务编辑

- [ ] 后端：扫描 `data/missions/*/descriptor.json`。
- [ ] 前端：任务列表 + 任务元数据编辑。
- [ ] 前端：任务描述和目标配置。

## Phase 11: 可视化逻辑编辑器（蓝图系统）

目标：将 Starsector 高度模板化的 Java 模块（Ship System、Bar Event、Mission、rules.csv 对话）抽象为可视化节点图，使 Mod 作者无需编写 Java 即可完成常见场景的逻辑配置。

集成社区核心库支持：MagicLib、GraphicsLib、LazyLib、LunaLib、BoxUtil。

### Phase 11.1: 模板向导（Template Wizard）

- [ ] Ship System 新建向导：选择 type + 配置 stat 效果列表 → 生成 `.system` JSON + `ship_systems.csv` 行 + Java Stats 类。
- [ ] Bar Event 新建向导：配置出现条件 + 对话文本 + 选项分支 → 生成 Java BarEvent + BarEventCreator 类。
- [ ] HubMission 新建向导：配置目标类型 + 奖励 + 完成条件 → 生成 Java Mission 类骨架。
- [ ] 代码生成引擎：Rust 端模板渲染（Tera/Handlebars）→ 输出 `.java` 源文件。
- [ ] 生成代码可读性保证：缩进、注释、import 整理。
- [ ] MagicLib 集成：向导可选使用 MagicBarEvent JSON 配置模式替代纯 Java。
- [ ] LunaLib 集成：向导可选使用 LunaSettings 配置面板绑定。
- [ ] 验收：通过向导生成的 Ship System 能在游戏中正常工作。

### Phase 11.2: 对话流编辑器（Dialogue Flow Editor）

- [ ] 对话节点画布：拖拽创建/连线/缩放/平移。
- [ ] 节点类型：开场白、NPC 台词、玩家选项、条件分支、动作节点、结束节点。
- [ ] 条件节点：声望判断、标记检查、货物持有、势力关系、星球类型、MemoryAPI 变量。
- [ ] 动作节点：设置标记、给予物品、修改声望、开始任务、触发事件、调用脚本。
- [ ] 序列化：对话图 → rules.csv 行 + Java BarEvent 骨架。
- [ ] 导入现有 rules.csv：解析 vanilla/mod 的 rules.csv 为可视化图（只读参考）。
- [ ] MagicLib 集成：支持导出为 MagicBarEvent JSON 格式。
- [ ] LazyLib 集成：条件节点可引用 LazyLib 工具方法。
- [ ] 验收：通过编辑器创建完整对话 → 生成代码 → 游戏中正常触发。

### Phase 11.3: 效果蓝图编辑器（Effect Node Graph）

- [ ] 节点画布：多输入/输出端口、类型着色、分组、注释、小地图。
- [ ] 触发节点：系统激活/关闭/每帧/受击/发射/弹体命中/阶段切换。
- [ ] 条件节点：幅能阈值/HP 阈值/速度判断/目标距离/冷却就绪/effectLevel。
- [ ] 数值效果节点：MutableShipStatsAPI stat 的 modifyPercent/Flat/Mult。
- [ ] 战斗效果节点：生成 EMP、施加伤害、推力、生成临时弹体、召唤无人机。
- [ ] 视觉效果节点：引擎颜色/粒子发射/屏幕闪光/抖动/轨迹。
- [ ] 状态节点：计时器、计数器、标记读写、随机分支。
- [ ] 流程控制：顺序/并行/延迟/循环/状态机子图。
- [ ] GraphicsLib / MagicLib / LazyLib / BoxUtil / LunaLib 节点集成。
- [ ] Java 代码生成：图 → Java AST → 格式化源码。
- [ ] 预览/模拟：简化的效果预览。
- [ ] 验收：通过蓝图创建完整 Ship System → 生成代码 → 游戏中效果正确。

### Phase 11.4: Starsector API 节点库

- [ ] MutableShipStatsAPI 全量 stat 枚举。
- [ ] ShipAPI 常用方法节点化。
- [ ] CombatEngineAPI 效果方法节点化。
- [ ] MagicLib API 节点：MagicRender、MagicAnim、MagicCampaign。
- [ ] GraphicsLib API 节点：ShaderAPI、RippleDistortion。
- [ ] LazyLib API 节点：MathUtils、CollisionUtils、CombatUtils、WeaponUtils。
- [ ] LunaLib API 节点：LunaSettings 运行时参数读取、LunaCombatPlugin 钩子。
- [ ] BoxUtil API 节点：BoxCollider、BoxUtil 范围计算、BoxIntersect 碰撞。
- [ ] 节点注册表格式定义。
- [ ] 节点搜索与分类。
- [ ] 社区节点扩展机制。

## Phase 12: 社区库数据文件集成（MagicLib / GraphicsLib / LazyLib）

将社区核心库的数据文件格式纳入工具编辑范围。与蓝图系统互补，本阶段聚焦纯数据配置文件的编辑支持。

前置条件：Mod 的 `mod_info.json` 声明对应库为依赖时，才暴露相关编辑入口。

### Phase 12.1: 直接嵌入

- [ ] `ship_systems.csv` 加入主表格模块。
- [ ] `.system` JSON 文件列表 + 编辑器。
- [ ] 编写 `schemas/ship-system.schema.json`。
- [ ] 后端扫描范围扩展：`data/config/*.json` 加入可编辑文件列表。
- [ ] 后端扫描范围扩展：`data/lights/*.csv` 加入可编辑 CSV 扫描。
- [ ] 依赖检测：读取 `mod_info.json` 的 `dependencies`，条件性暴露 MagicLib/GraphicsLib 编辑入口。
- [ ] 验收：Mod 依赖 MagicLib 时可编辑 modSettings.json；依赖 GraphicsLib 时可编辑 light_data.csv。

### Phase 12.2: Schema 驱动的库配置编辑

- [ ] 编写 `schemas/magic-bounty.schema.json`。
- [ ] MagicLib 赏金编辑器：Hjson 解析 → ID 列表 → SchemaFormRenderer 表单编辑 → 写回。
- [ ] Hjson 解析适配：确认现有宽松解析器兼容 Hjson 格式。
- [ ] GraphicsLib `texture_data.csv` 的 `path` 列使用 path-image 类型渲染。
- [ ] MagicLib 赏金的势力/市场引用：Schema source 字段解析。
- [ ] MagicLib 赏金的 fleet_composition：嵌套 array-of-object + 舰船 ID 选择器。
- [ ] 验收：完整编辑 magicBounty_data.json → 保存 → 游戏中正常加载。

### Phase 12.3: CSV 列 Schema 系统

- [ ] 定义 CSV 列 Schema 格式（`schemas/csv/ship_data.columns.json` 等）。
- [ ] 前端 MissionView / 主表格根据列 Schema 渲染富控件。
- [ ] GraphicsLib `texture_data.csv` 的 `path` 列自动关联 path-image 富编辑。
- [ ] GraphicsLib `light_data.csv` 的 `color` 列自动关联 color-rgb 编辑器。
- [ ] 为 `ship_systems.csv` 编写列 Schema。
- [ ] 验收：CSV 表格中 path-image 列显示缩略图，enum 列显示下拉。

### Phase 12.4: 高级集成

- [ ] MagicLib `magic_paintjobs.csv` 编辑支持。
- [ ] MagicLib achievements 编辑支持。
- [ ] GraphicsLib 法线贴图/材质贴图关联预览。
- [ ] LunaLib `LunaSettings` JSON 配置文件编辑支持。
- [ ] LunaLib 配置与 MagicLib modSettings 的对照/互补关系处理。
- [ ] 验收：完整编辑各库配置文件 → 保存 → 游戏中正常加载。

## Phase 13: 最终硬化、回归与整理

- [ ] 在全部大功能完成后，统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/editor-flows.md`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的跨阶段回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向，避免项目再次进入迁移期状态。
