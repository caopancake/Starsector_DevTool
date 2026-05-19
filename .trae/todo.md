# Todo

## Phase 1: 舰队能力 CSV 接入

- [x] 添加 `abilities.csv` 编辑支持（舰队能力定义）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 2: 贸易商品 CSV 接入

- [x] 添加 `commodities.csv` 编辑支持（贸易商品）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 放在“舰队能力”下方
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 3: 市场类型 CSV 接入

- [x] 添加 `submarkets.csv` 编辑支持（市场类型）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 放在“贸易商品”下方
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 4: 市场条件 CSV 接入

- [x] 添加 `market_conditions.csv` 编辑支持（市场条件）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 放在“市场类型”下方
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 5: 模拟对手 CSV 接入

- [x] 添加 `sim_opponents.csv` 编辑支持（模拟对手）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 放在“舰船装配”下方
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 6: 特殊物品 CSV 接入

- [x] 添加 `special_items.csv` 编辑支持（特殊物品）。
- [x] 注册 CSV 表路径、表格标签、默认列顺序和图标/缩略图字段。
- [x] 完整读取 Mod 时缺 CSV 返回空表，不影响其它模块加载。
- [x] 前端通过现有 CSV 表格系统展示、编辑、保存和记录文件历史。
- [x] 放在“贸易商品”下方
- [x] 如该 CSV 引用图标或其它游戏实体，接入现有原版引用分组选项和资源回退。

## Phase 7: 生涯 CSV 补全收尾

- [x] 检查 Phase 1-6 新增生涯 CSV 是否全部进入 CSV 表格、完整读取、局部加载、保存、文件历史和原版引用链路。

## Phase 8: CSV 列 Schema 试点

- [x] 明确本阶段只做主 CSV 表格的列级编辑控件，不迁移 `.ship`、`.wpn`、`.proj` 专用编辑器，也不改变 `.skin`、`.variant`、配置 schema 表单。
- [x] 定义 CSV 列 Schema 格式，覆盖列名、显示名、控件类型、source/options、默认值、只读、数字范围和显示优先级。
- [x] 新增 CSV 列 Schema 注册入口，使已注册 CSV 表可按 table key 查找列 schema；未注册列继续按原 header 文本编辑。
- [x] 扩展主表格单元格渲染，使列 schema 可驱动文本、数字、布尔、枚举、引用下拉、tag、多值、图片路径和颜色输入。
- [x] CSV 引用下拉沿用当前 Mod + 原版分组来源，继续过滤 `#` 开头 ID，并允许保留当前已有但不在来源中的值。
- [x] 全量支持项目内已注册 CSV 表的列 schema：`ships`、`weapons`、`wings`、`hullmods`、`shipSystems`、`industries`、`skills`、`abilities`、`commodities`、`specialItems`、`submarkets`、`marketConditions`、`simOpponents`。
- [x] 为上述每个已注册 CSV 表编写列 schema；确定类型和确定引用的列使用专用控件，未知或高风险列保持文本编辑。
- [x] 保持 CSV 读取、dirty、草稿 undo/redo、保存、文件历史和 AppData 同步链路不变；本阶段只改变单元格展示和输入约束。
- [x] 增加最小测试或静态检查，确认 table key、CSV 列 schema 注册和前端列控件覆盖不会漂移。
- [x] 手动验收新增生涯 CSV、舰船、武器、联队、插件和战术系统表格的 schema 控件、普通文本回退、保存和撤销重做。

## Phase 8.1: 右侧只读 Schema 速览

- [x] 在 Phase 8 的 CSV 列 schema 稳定后，为右侧详情区接入只读 schema 速览。
- [x] 右侧详情区只读取当前行和列 schema，不写入单元格、不修改 dirty、不触发保存。
- [x] 按列 schema 展示字段标签、类型化值、引用 label、来源分组、缩略图、tag、多值、颜色和图片路径。
- [x] 未被列 schema 覆盖的列继续进入普通字段速览或其它字段区。
- [x] 保留现有缩略图预览、操作按钮和文件/专用编辑器入口，不改变右侧详情动作链路。
- [x] 明确主表格仍是 CSV 行编辑入口，右侧 schema 速览只负责上下文阅读。

## Phase 9: 自动数据校验和警示

- [ ] 建立统一诊断模型，至少包含 severity、source kind、entity id、field/path、message 和可定位目标；诊断只描述问题，不负责写盘。
- [ ] 建立统一校验入口，读取当前 `AppData`、CSV 草稿状态、schema 资产和资源索引后产出诊断；不得让组件、store 或保存函数各自散落校验逻辑。
- [ ] 设计诊断展示位置：表格行/单元格标记、右侧字段速览提示、配置 schema 字段提示、舰船/武器/弹体编辑器字段提示、资源预览提示、保存前汇总和工作区级汇总。
- [ ] 明确 severity 行为：warning 默认允许保存；error 只用于确定会破坏写入边界、解析边界或唯一 ID 边界的问题；是否阻止保存由统一策略决定。
- [ ] CSV 列校验适用范围固定为已注册主表格：`ships`、`weapons`、`wings`、`hullmods`、`shipSystems`、`industries`、`skills`、`abilities`、`commodities`、`specialItems`、`submarkets`、`marketConditions`、`simOpponents`。
- [ ] CSV 列校验只依据 `schemas/csv/*.columns.json` 和当前表 header；未被列 schema 覆盖的列不做类型校验，只保留通用空值/显示能力。
- [ ] CSV 数值列校验：`control: number` 的非空值必须能解析为有限数值，并校验 schema 中的 min、max 和 step。
- [ ] CSV 布尔列校验：`control: boolean` 的非空值必须是当前项目允许的布尔文本。
- [ ] CSV 枚举列校验：`control: enum` 的非空值必须在 schema options 中。
- [ ] CSV 引用列校验：`control: reference` 的非空值必须能在当前 Mod 或原版引用源中解析；`#` 开头行不得作为合法引用；当前 Mod 覆盖原版重复 ID 的规则保持不变。
- [ ] CSV tag / multi 列校验：按逗号拆分后检查空项、重复项和 source 引用合法性；无 source 的 tag 只做格式级检查。
- [ ] CSV path-image / color 列校验：图片路径非空时检查资源索引可解析；颜色列按既定格式检查，未定义格式前只做非阻塞 warning。
- [ ] CSV 行级校验：业务 ID 为空、重复 ID、`#` 开头禁用行被其它字段引用、关联 spec 候选路径冲突时给出诊断。
- [ ] CSV 展示与交互：诊断必须能映射到具体表、行和列；右侧字段速览显示当前行诊断；保存 CSV 前汇总本表诊断。
- [ ] 非 CSV 校验适用范围包括 `.ship`、`.wpn`、`.proj`、`.variant`、`.skin`、Faction `.faction`、Mission descriptor/mission_text 和贴图资源；不覆盖 Java、rules.csv、本地化文件和社区库文件，后续阶段另行接入。
- [ ] `.ship` 校验：中心、护盾中心、护盾半径、碰撞半径、武器槽、甲板、引擎、边界点等坐标字段应为整数；缺失关键中心/护盾字段给出诊断。
- [ ] `.ship` 几何校验：`collisionRadius` 小于 `shieldRadius`、碰撞半径未覆盖武器槽、甲板、引擎、边界点或护盾圆时给出诊断。
- [ ] `.ship` 引用校验：内置武器、内置联队、内置插件、战术系统、装配和皮肤相关 hull 引用必须走当前 Mod + 原版引用源；`skinHullId` 必须被视作合法 hull 引用。
- [ ] `.wpn` 校验：炮口/barrel offset 缺失、炮口坐标含小数、当前视图贴图路径缺失、武器 CSV 行与 `.wpn` 关键引用不一致时给出诊断。
- [ ] `.proj` 校验：弹体贴图路径、碰撞/尺寸/速度等确定数值字段、武器引用弹体缺失或弹体文件孤立时给出诊断。
- [ ] `.variant` 校验：`variantId`、`hullId`、武器槽位引用、武器 ID、插件 ID、联队 ID、模块/内置装配引用必须可解析；重复或缺必填字段沿用读取阶段 error 语义。
- [ ] `.skin` 校验：`skinHullId`、`baseHullId`、内置武器、内置联队、内置插件、战术系统、slot change 和 engine change 引用必须可解析；`skinHullId` 参与所有 hull 引用解析。
- [ ] Faction / Mission 校验：CSV index 与额外文件或目录之间的 ID、路径和必填字段必须一致；Mission 改名后 descriptor、mission_text 和目录资源必须保持可定位。
- [ ] 贴图资源校验：被 spec、CSV 或 schema 引用的 PNG 资源缺失时给出诊断；贴图宽度或高度为奇数时给出 warning；hardpoint 武器贴图高度不为 4 的倍数时给出 warning。
- [ ] 贴图资源校验不扫描未被引用的所有图片作为首期必做项；如需要全资源扫描，作为后续性能可控的独立扩展。
- [ ] 文件历史 replay 和保存后同步必须刷新受影响实体的诊断结果；二进制贴图变化只刷新资源相关诊断，不尝试解析为文本。
- [ ] 补最小测试或静态检查：CSV schema 控件类型对应校验器、引用源过滤 `#` 行、hull 引用包含 skin、典型 `.ship/.wpn/.variant/.skin` 异常、贴图尺寸异常和保存前汇总。

## Phase 10: 定义右键行为

- [ ] 定义主表格右键菜单：复制 ID、打开编辑器、删除、定位资源等。
- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 确保右键菜单不会破坏画布右键拖动平移体验。
- [ ] 为右键菜单行为补手动验收清单。

## Phase 11: 重新梳理主界面快捷键

- [ ] 为主界面定义搜索、模块切换、记录选择、保存 CSV、删除、新建等快捷键。
- [ ] 明确主界面快捷键与多 Mod 导航、总览页、设置页之间的切换规则。
- [ ] 统一主界面的撤销、重做、保存、关闭等通用行为，并接入全局修改链路。
- [ ] 避免主界面快捷键和输入框、文本域、系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 12: 角色与本地化

- [ ] 添加 NPC 系统：`data/characters/skills.csv` 编辑支持（角色技能）。
- [ ] 添加 NPC 系统：`data/characters/people/*.json` 编辑支持（NPC 定义）。
- [ ] 添加本地化：`data/strings/*.json` 编辑支持。
- [ ] 添加本地化：`data/strings/descriptions.csv` 编辑支持。
- [ ] 前端：多语言对照编辑界面。

## Phase 13: 高级配置

- [ ] 添加游戏全局设置：`data/config/settings.json` 编辑支持。
- [ ] 前端：分类浏览（战斗/舰队/市场/UI 等大类）。
- [ ] Schema 定义覆盖所有已知设置项。
- [ ] 添加战斗与引擎配置：`data/config/battle_objectives.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/engine_styles.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/hull_styles.json` 编辑支持。
- [ ] 添加战斗与引擎配置：`data/config/sounds.json` 编辑支持。

## Phase 14: 可视化逻辑编辑器（蓝图系统）

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

## Phase 15: 社区库数据文件集成（MagicLib / GraphicsLib / LazyLib）

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
- [ ] CSV 列 Schema 系统：配置模块页面 / 主表格根据列 Schema 渲染富控件。
- [ ] CSV 列 Schema 系统：GraphicsLib `texture_data.csv` 的 `path` 列自动关联 path-image 富编辑。
- [ ] CSV 列 Schema 系统：GraphicsLib `light_data.csv` 的 `color` 列自动关联 color-rgb 编辑器。
- [ ] CSV 列 Schema 系统验收：CSV 表格中 path-image 列显示缩略图，enum 列显示下拉。
- [ ] 高级集成：MagicLib `magic_paintjobs.csv` 编辑支持。
- [ ] 高级集成：MagicLib achievements 编辑支持。
- [ ] 高级集成：GraphicsLib 法线贴图/材质贴图关联预览。
- [ ] 高级集成：LunaLib `LunaSettings` JSON 配置文件编辑支持。
- [ ] 高级集成：LunaLib 配置与 MagicLib modSettings 的对照/互补关系处理。
- [ ] 高级集成验收：完整编辑各库配置文件 → 保存 → 游戏中正常加载。

## Phase 16: 最终硬化、回归与整理

- [ ] 在全部大功能完成后，统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/modules/`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的跨阶段回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向，避免项目再次进入迁移期状态。
