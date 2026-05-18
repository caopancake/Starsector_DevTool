# Todo

## Phase 1: 舰船编辑器 / 武器编辑器窗口化

- [x] 抽象可复用的编辑器窗口打开能力，支持按业务 key 复用已有窗口。
- [x] 舰船编辑器改为独立窗口打开，允许不同舰船同时打开。
- [x] 武器编辑器改为独立窗口打开，允许不同武器同时打开。
- [x] 同一个舰船或同一个武器不允许重复打开多个窗口；再次打开时聚焦已有窗口。
- [x] 保持现有保存边界：`.ship` / `.wpn` 只写回对应 spec，不隐式保存 CSV。
- [x] 保持 per-Mod 状态隔离，编辑器窗口引用必须包含 `modRoot` 和目标 id。
- [x] 验收：主窗口在舰船/武器编辑器打开时仍可切换、查看和操作其它内容。

## Phase 2: 战术系统 CSV 接入（Ship System）

- [x] 读取 `data/shipsystems/ship_systems.csv` 文件。
- [x] 根据 `ship_systems.csv` 中的定义，读取对应的 `data/shipsystems/*.system`，先按当前 CSV 列式文件的基础接入方式提供列表、选择，并通过文件编辑器打开对应 `.system`。
- [x] 后端：加载、保存 `ship_systems.csv`。
- [x] 后端：扫描、加载 `.system` 文件；保存由通用文件编辑器链路处理。
- [x] 前端：战术系统列表，支持选择、查看、CSV 基础字段编辑和保存。
- [x] 前端：右侧上下文预览和字段速览，行为对齐现有列式文件。
- [x] 集成左侧树，在“舰船插件”的下方。
- [x] 验收：列表 → 选择 → 基础编辑 → 保存。

## Phase 3: 技能编辑器 CSV 接入（Skills）

- [x] 读取 `data/characters/skills/skill_data.csv` 文件。
- [x] 根据 `skill_data.csv` 中的定义，读取对应的 `data/characters/skills/*.skill`，先按当前 CSV 列式文件的基础接入方式提供列表、选择、文本/字段基础编辑和保存。
- [x] 后端：扫描、加载、保存 `.skill` 文件。
- [x] 前端：技能列表，支持选择、查看、基础字段编辑和保存。编辑和保存由通用文件编辑器链路处理。
- [x] 前端：右侧上下文预览和字段速览，行为对齐现有列式文件。
- [x] 集成左侧树，在“工业”的下方。
- [x] 验收：列表 → 选择 → 基础编辑 → 保存。

## Phase 4: 装配编辑器（Variants）

- [x] 覆盖 `data/variants/**/*.variant`，以 schema 表单方式提供列表、选择、字段编辑和保存。
- [x] 后端：加载 + 保存 `.variant` 文件。
- [x] 前端：装配列表，支持选择、查看、schema 字段编辑和保存。
- [x] 前端：右侧 schema 表单和字段速览，行为对齐势力 / 战役类左右布局。
- [x] 集成左侧树，在“战术系统”的下方。
- [x] 验收：列表 → 选择 → schema 基础编辑 → 保存。

## Phase 5: 舰船皮肤编辑器（Skins）

- [ ] 覆盖 `data/hulls/skins/*.skin`，先按当前 CSV 列式文件的基础接入方式提供列表、选择、文本/字段基础编辑和保存。
- [ ] 后端：扫描、加载、保存 `.skin` 文件。
- [ ] 前端：舰船皮肤列表，支持选择、查看、基础字段编辑和保存。编辑和保存由通用文件编辑器链路处理。
- [ ] 前端：右侧上下文预览和字段速览，行为对齐现有列式文件。
- [ ] 集成左侧树，在“装配”的下方。
- [ ] 验收：列表 → 选择 → 基础编辑 → 保存。

## Phase 6: 生涯 CSV 补全

- [ ] 覆盖剩余生涯相关 CSV 文件。
- [ ] 添加 `abilities.csv` 编辑支持（舰队能力定义）。
- [ ] 添加 `commodities.csv` 编辑支持（贸易商品）。
- [ ] 添加 `submarkets.csv` 编辑支持（市场类型）。
- [ ] 添加 `market_conditions.csv` 编辑支持（市场条件）。
- [ ] 添加 `sim_opponents.csv` 编辑支持（模拟对手）。
- [ ] 添加 `special_items.csv` 编辑支持（特殊物品）。

- [ ] 添加复杂生涯 CSV：`bar_events.csv` 编辑支持（酒吧事件）。

## Phase 7: Schema Registry 收尾

- [ ] 补齐 CSV 列 schema，并评估现有编辑器检查器是否适合局部 schema 化。

- [ ] 编写 CSV 列定义 Schema：`csv/ship_data.columns.json`、`csv/weapon_data.columns.json` 等。
- [ ] 定义 CSV 列 Schema 格式：key、type、source、options、显示标签和可编辑性。
- [ ] 主表格根据列 Schema 渲染富控件，例如下拉选择器、path-image 缩略图、颜色块和数字输入。
- [ ] 为已基础接入的 `.skill`、`.skin`、`.variant`、`.system` 和 `ship_systems.csv` 补 Schema 适配。
- [ ] 评估并补充技能等级效果、基础船体选择、武器槽覆盖、装配武器/插件/联队选择等富编辑控件。
- [ ] 保持 CSV 保存链路不变，只改变编辑展示和输入约束。
- [ ] 评估 `ShipEditor` / `WeaponEditor` / `ProjectileEditor` 的右侧检查器面板是否可部分迁移到 schema 驱动。
- [ ] 明确画布交互、hit detection、拖拽、贴图上传等逻辑继续留在专用编辑器内。
- [ ] 如果迁移可行，先选低风险字段分组试点，不一次性重写整个编辑器。

## Phase 8: 自动数据校验和警示

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

## Phase 9: 重新梳理主界面快捷键

- [ ] 为主界面定义搜索、模块切换、记录选择、保存 CSV、删除、新建等快捷键。
- [ ] 明确主界面快捷键与多 Mod 导航、总览页、设置页之间的切换规则。
- [ ] 统一主界面的撤销、重做、保存、关闭等通用行为，并接入全局修改链路。
- [ ] 避免主界面快捷键和输入框、文本域、系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 10: 定义右键行为

- [ ] 定义主表格右键菜单：复制 ID、打开编辑器、删除、定位资源等。
- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 确保右键菜单不会破坏画布右键拖动平移体验。
- [ ] 为右键菜单行为补手动验收清单。

## Phase 11: 角色与本地化

- [ ] 添加 NPC 系统：`data/characters/skills.csv` 编辑支持（角色技能）。
- [ ] 添加 NPC 系统：`data/characters/people/*.json` 编辑支持（NPC 定义）。
- [ ] 添加本地化：`data/strings/*.json` 编辑支持。
- [ ] 添加本地化：`data/strings/descriptions.csv` 编辑支持。
- [ ] 前端：多语言对照编辑界面。

## Phase 12: 高级配置

- [ ] 添加游戏全局设置：`data/config/settings.json` 编辑支持。
- [ ] 前端：分类浏览（战斗/舰队/市场/UI 等大类）。
- [ ] Schema 定义覆盖所有已知设置项。
- [ ] 添加战斗与引擎配置：`data/config/battle_objectives.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/engine_styles.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/hull_styles.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/sounds.json` 编辑支持。

## Phase 13: 可视化逻辑编辑器（蓝图系统）

- [ ] 将 Starsector 高度模板化的 Java 模块（Ship System、Bar Event、Mission、rules.csv 对话）抽象为可视化节点图。
- [ ] 集成社区核心库支持：MagicLib、GraphicsLib、LazyLib、LunaLib、BoxUtil。

- [ ] 模板向导：Bar Event 新建向导，配置出现条件 + 对话文本 + 选项分支 → 生成 Java BarEvent + BarEventCreator 类。
- [ ] 模板向导：HubMission 新建向导，配置目标类型 + 奖励 + 完成条件 → 生成 Java Mission 类骨架。
- [ ] 模板向导：代码生成引擎由 Rust 端模板渲染（Tera/Handlebars）→ 输出 `.java` 源文件。
- [ ] 模板向导：生成代码可读性保证，包括缩进、注释、import 整理。
- [ ] 模板向导：MagicLib 集成，可选使用 MagicBarEvent JSON 配置模式替代纯 Java。
- [ ] 模板向导：LunaLib 集成，可选使用 LunaSettings 配置面板绑定。
- [ ] 模板向导验收：通过向导生成的 Ship System 能在游戏中正常工作。
- [ ] 对话流编辑器：对话节点画布，支持拖拽创建、连线、缩放和平移。
- [ ] 对话流编辑器：节点类型覆盖开场白、NPC 台词、玩家选项、条件分支、动作节点、结束节点。
- [ ] 对话流编辑器：条件节点覆盖声望判断、标记检查、货物持有、势力关系、星球类型、MemoryAPI 变量。
- [ ] 对话流编辑器：动作节点覆盖设置标记、给予物品、修改声望、开始任务、触发事件、调用脚本。
- [ ] 对话流编辑器：序列化对话图 → rules.csv 行 + Java BarEvent 骨架。
- [ ] 对话流编辑器：导入现有 rules.csv 为可视化图，只读参考。
- [ ] 对话流编辑器：MagicLib 集成，支持导出为 MagicBarEvent JSON 格式。
- [ ] 对话流编辑器：LazyLib 集成，条件节点可引用 LazyLib 工具方法。
- [ ] 对话流编辑器验收：通过编辑器创建完整对话 → 生成代码 → 游戏中正常触发。
- [ ] 效果蓝图编辑器：节点画布支持多输入/输出端口、类型着色、分组、注释和小地图。
- [ ] 效果蓝图编辑器：触发节点覆盖系统激活/关闭/每帧/受击/发射/弹体命中/阶段切换。
- [ ] 效果蓝图编辑器：条件节点覆盖幅能阈值/HP 阈值/速度判断/目标距离/冷却就绪/effectLevel。
- [ ] 效果蓝图编辑器：数值效果节点覆盖 MutableShipStatsAPI stat 的 modifyPercent/Flat/Mult。
- [ ] 效果蓝图编辑器：战斗效果节点覆盖生成 EMP、施加伤害、推力、生成临时弹体、召唤无人机。
- [ ] 效果蓝图编辑器：视觉效果节点覆盖引擎颜色、粒子发射、屏幕闪光、抖动和轨迹。
- [ ] 效果蓝图编辑器：状态节点覆盖计时器、计数器、标记读写、随机分支。
- [ ] 效果蓝图编辑器：流程控制覆盖顺序、并行、延迟、循环和状态机子图。
- [ ] 效果蓝图编辑器：集成 GraphicsLib / MagicLib / LazyLib / BoxUtil / LunaLib 节点。
- [ ] 效果蓝图编辑器：Java 代码生成，图 → Java AST → 格式化源码。
- [ ] 效果蓝图编辑器：提供简化的效果预览/模拟。
- [ ] 效果蓝图编辑器验收：通过蓝图创建完整 Ship System → 生成代码 → 游戏中效果正确。
- [ ] Starsector API 节点库：MutableShipStatsAPI 全量 stat 枚举。
- [ ] Starsector API 节点库：ShipAPI 常用方法节点化。
- [ ] Starsector API 节点库：CombatEngineAPI 效果方法节点化。
- [ ] Starsector API 节点库：MagicLib API 节点，包括 MagicRender、MagicAnim、MagicCampaign。
- [ ] Starsector API 节点库：GraphicsLib API 节点，包括 ShaderAPI、RippleDistortion。
- [ ] Starsector API 节点库：LazyLib API 节点，包括 MathUtils、CollisionUtils、CombatUtils、WeaponUtils。
- [ ] Starsector API 节点库：LunaLib API 节点，包括 LunaSettings 运行时参数读取、LunaCombatPlugin 钩子。
- [ ] Starsector API 节点库：BoxUtil API 节点，包括 BoxCollider、BoxUtil 范围计算、BoxIntersect 碰撞。
- [ ] Starsector API 节点库：定义节点注册表格式。
- [ ] Starsector API 节点库：节点搜索与分类。
- [ ] Starsector API 节点库：社区节点扩展机制。

## Phase 14: 社区库数据文件集成（MagicLib / GraphicsLib / LazyLib）

- [ ] 将社区核心库的数据文件格式纳入工具编辑范围，本阶段聚焦纯数据配置文件的编辑支持。
- [ ] 仅当 Mod 的 `mod_info.json` 声明对应库为依赖时，暴露相关编辑入口。

- [ ] 直接嵌入：`data/config/*.json` 加入可编辑文件列表。
- [ ] 直接嵌入：`data/lights/*.csv` 加入可编辑 CSV 扫描。
- [ ] 直接嵌入：读取 `mod_info.json` 的 `dependencies`，条件性暴露 MagicLib/GraphicsLib 编辑入口。
- [ ] 直接嵌入验收：Mod 依赖 MagicLib 时可编辑 modSettings.json；依赖 GraphicsLib 时可编辑 light_data.csv。
- [ ] Schema 驱动的库配置编辑：编写 `schemas/magic-bounty.schema.json`。
- [ ] Schema 驱动的库配置编辑：MagicLib 赏金编辑器，Hjson 解析 → ID 列表 → SchemaFormRenderer 表单编辑 → 写回。
- [ ] Schema 驱动的库配置编辑：确认现有宽松解析器兼容 Hjson 格式。
- [ ] Schema 驱动的库配置编辑：GraphicsLib `texture_data.csv` 的 `path` 列使用 path-image 类型渲染。
- [ ] Schema 驱动的库配置编辑：MagicLib 赏金的势力/市场引用使用 Schema source 字段解析。
- [ ] Schema 驱动的库配置编辑：MagicLib 赏金的 fleet_composition 使用嵌套 array-of-object + 舰船 ID 选择器。
- [ ] Schema 驱动的库配置编辑验收：完整编辑 magicBounty_data.json → 保存 → 游戏中正常加载。
- [ ] CSV 列 Schema 系统：定义 CSV 列 Schema 格式（`schemas/csv/ship_data.columns.json` 等）。
- [ ] CSV 列 Schema 系统：前端 MissionView / 主表格根据列 Schema 渲染富控件。
- [ ] CSV 列 Schema 系统：GraphicsLib `texture_data.csv` 的 `path` 列自动关联 path-image 富编辑。
- [ ] CSV 列 Schema 系统：GraphicsLib `light_data.csv` 的 `color` 列自动关联 color-rgb 编辑器。
- [ ] CSV 列 Schema 系统验收：CSV 表格中 path-image 列显示缩略图，enum 列显示下拉。
- [ ] 高级集成：MagicLib `magic_paintjobs.csv` 编辑支持。
- [ ] 高级集成：MagicLib achievements 编辑支持。
- [ ] 高级集成：GraphicsLib 法线贴图/材质贴图关联预览。
- [ ] 高级集成：LunaLib `LunaSettings` JSON 配置文件编辑支持。
- [ ] 高级集成：LunaLib 配置与 MagicLib modSettings 的对照/互补关系处理。
- [ ] 高级集成验收：完整编辑各库配置文件 → 保存 → 游戏中正常加载。

## Phase 15: 最终硬化、回归与整理

- [ ] 在全部大功能完成后，统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/modules/`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的跨阶段回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向，避免项目再次进入迁移期状态。
