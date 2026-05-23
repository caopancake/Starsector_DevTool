# Todo

## Phase 1: 加载、派生数据与交互性能重构

### Phase 1.1: 性能审计与预算

- [x] 为完整读取 Mod 建立分段计时，覆盖目录识别、CSV 读取、spec 读取、variant/skin 读取、coreReferences 读取、资源索引、缩略图、IPC 返回和前端 hydrate。
- [x] 为前端交互建立分段计时，覆盖恢复工作区、切换表格、创建 CSV Grid 模型、解析 source/options、计算列宽、选择行、编辑单元格和右侧详情刷新。
- [x] 建立性能基线样本文档，记录当前大 Mod 样本；普通 Mod、无原版引用和有原版引用样本待后续补充。
- [ ] 定义性能预算：打开项目、恢复工作区、切换宽表、点击行、编辑单元格、滚动跳变都必须有可验收的目标耗时。
- [ ] 审计结果必须定位到具体链路和具体模块；不得只给总耗时。
- [ ] CSV 读取计时必须细分到单表、`alex_csv` 解析、行列规范化和表格结果组装。
- [ ] 完整读取计时必须覆盖 `AppData` 序列化、IPC 传输和前端接收后的反序列化耗时。

### Phase 1.2: 后端完整读取分层

- [ ] 将完整读取拆成当前 Mod 数据、原版只读引用、资源索引、缩略图引用和警告结果几个明确阶段。
- [ ] 当前 Mod 数据保持写盘权威语义，继续返回可编辑 CSV、spec、配置 entity 和必要路径信息。
- [ ] `AppData` 必须审计体积来源，区分可编辑权威数据、派生引用数据、资源引用和前端显示缓存。
- [ ] `AppData` 返回结构必须压缩跨进程传输体积，避免把可按需读取、可缓存或可派生的数据放进完整读取结果。
- [ ] 前端接收 `AppData` 后的反序列化和数据落库必须纳入性能预算，不能只优化后端读取耗时。
- [ ] 原版只读引用不得混入当前 Mod 可编辑数据，也不得进入保存链路。
- [ ] 资源索引只描述资源是否存在、规范化路径和归属来源；不得默认把所有图片编码进 `AppData`。
- [ ] 完整读取失败、warning、重复 ID 跳过和路径安全规则必须保持现有语义。

### Phase 1.3: CoreReferences 只读缓存

- [ ] 以 Starsector root 为 key 缓存 `starsector-core` 的只读 CSV、`.ship`、`.wpn`、`.variant`、`.skin` 和引用索引。
- [ ] 同一 Starsector root 下完整读取多个 Mod 时不得重复全量解析原版引用。
- [ ] 缓存必须有明确失效入口；刷新工作区或切换 root 时不得复用错误 root 的原版引用。
- [ ] CoreReferences 缓存不得持有当前 Mod 状态，不得参与文件 history、dirty、保存或 undo/redo。
- [ ] 无 `starsector-core` 时继续返回空只读引用，不阻断外部 Mod 加载。

### Phase 1.4: 缩略图与图片资源按需化

- [ ] 完整读取只返回缩略图资源 key、规范化路径和来源，不再默认返回大批 data URL。
- [ ] 新增统一资源读取链路，按资源 key 加载图片 data URL，并按 Mod root / Starsector root / rel path 缓存。
- [ ] 表格、详情、schema 下拉、配置列表和编辑器预览必须共用同一资源缓存，不得各自读取图片。
- [ ] 图片缓存失效必须接入贴图上传、文件历史 replay、配置保存和工作区关闭。
- [ ] 资源按需化不得改变缺图占位、原版 fallback、Mod 覆盖原版和皮肤 hull 缩略图规则。

### Phase 1.5: CSV Source 与 Grid 模型缓存

- [ ] `csv:*` source/options 按 `modRoot + source + editMode` 建立缓存，供 CSV Grid、右侧详情和 schema 表单共用。
- [ ] source 缓存必须保留当前 Mod 在上、原版在下、Mod 覆盖原版重复 ID、`#` 行不可引用的规则。
- [ ] CSV Grid 列模型按 `modRoot + table + header + schema + editMode` 缓存。
- [ ] 列宽按表级固定计算并缓存；只有 header、schema、当前表数据或编辑模式变化时才失效。
- [ ] 编辑单元格、新建行、删除行和保存当前表只能局部失效相关表缓存，不得重建所有表的模型。

### Phase 1.6: 表格状态 Patch 化

- [ ] 重新设计表格草稿状态，用 baseline rows + dirty patch 表达当前表状态，替代整表双份 deep clone。
- [ ] dirty、CSV 草稿 history、当前表撤销/重做、保存当前表和删除行必须继续按 `modRoot + table + rowKey` 隔离。
- [ ] 当前显示行由 baseline 和 patch 派生；保存时只提交当前表的最终 rows。
- [ ] 保存成功后只替换当前表 baseline，清空当前表 dirty 和当前表草稿 history，不影响其它表。
- [ ] 文件 history replay 后只刷新受影响表或实体，不得强制重建所有表状态。

### Phase 1.7: 后端并行与前端非阻塞

- [ ] 后端读取 CSV、spec、variant、skin、coreReferences 和资源索引时按职责并行，最终统一合并结果。
- [ ] `alex_csv` 必须针对大文本、多行字段和长字段 CSV 进行 parser 热点重构，避免逐字符通用路径成为主耗时。
- [ ] 并行读取必须保持错误路径、warning 顺序可理解和最终 `AppData` 结构稳定。
- [ ] 前端大型派生计算必须可缓存、可分帧或可延后，不得阻塞点击、滚动和输入。
- [ ] 工作区恢复、完整 Mod 读取和文件 history 大回放使用 blocker 加载界面；切表、点击行和普通编辑不得靠加载界面遮盖卡顿。
- [ ] 异步化不得改变保存边界、文件 history 语义、诊断语义、多 Mod 隔离和编辑模式语义。

### Phase 1.8: 验收与回归

- [ ] 验收打开大 Mod、恢复工作区、切换宽表、点击行、编辑单元格、滚动跳变、保存当前表和回放文件 history 的耗时。
- [ ] 验收纯文本和增强控件两种编辑模式下 CSV Grid 视觉不偏移、不闪烁、不丢编辑值。
- [ ] 验收原版引用、缩略图 fallback、皮肤 hull 引用、联队预览和 schema 下拉仍保持现有语义。
- [ ] 验收关闭工作区、刷新工作区、贴图上传和文件 history replay 后缓存正确失效。
- [ ] 跑前端格式、类型、lint、编码检查和 Rust test、fmt、clippy。

## Phase 2: 外置文本 JSON 支持

- [ ] 读取 `data/strings/strings.json`，缺文件时返回空列表。
- [ ] 新增外置文本模块入口，列表展示文件，详情使用基础文本编辑器或现有 JSON 文本编辑能力，不新增专用复杂编辑器。
- [ ] 保存走通用文件保存和文件级 history；undo/redo 后刷新对应文件内容。
- [ ] 验收新增、编辑、保存、撤销重做和解析错误定位行为。

## Phase 3: CSV Schema 覆盖审计

- [ ] 检查所有项目内已接入 CSV 的每个字段是否都有对应列 schema；缺失字段必须补齐 schema 或明确记录为只能文本编辑的字段。
- [ ] 检查所有 CSV 列 schema 字段是否都有中文名和字段解释；缺失时必须补齐。
- [ ] 手动逐字段核对中文名和字段解释，确认译名、语义、引用关系和编辑控件都符合实际用途。
- [ ] 审计结果必须能定位到具体 CSV、具体字段和具体 schema 文件；不得只给总量统计。

## Phase 4: 组件动画与阻塞加载界面

- [ ] 补足适当的组件动画，覆盖展开、收起、切换和局部显隐等高频交互；动画速度必须快，不拖慢操作反馈。
- [ ] 优先复用 Naive UI 自带动画和现有组件能力；需要补充时优先只改组件封装或 CSS，不改变业务链路。
- [ ] 等待界面只用于工作区加载、完整 Mod 读取这类耗时且 blocker 级别的流程；普通局部刷新、表格切换和轻量保存不得弹出全局等待界面。
- [ ] 加载界面必须明确当前阻塞对象和状态，不遮挡可继续操作的非阻塞区域。
- [ ] 验收动画不会造成布局跳动、文字重叠、滚动错位或视觉风格偏移。

## Phase 5: 自动数据校验和警示

### Phase 5.1: 诊断模型与统一入口

- [ ] 建立统一诊断模型，至少包含 severity、source kind、entity id、field/path、message 和可定位目标；诊断只描述问题，不负责写盘。
- [ ] 建立统一校验入口，读取当前 `AppData`、CSV 草稿状态、schema 资产和资源索引后产出诊断；不得让组件、store 或保存函数各自散落校验逻辑。
- [ ] 明确 severity 行为：warning 默认允许保存；error 只用于确定会破坏写入边界、解析边界或唯一 ID 边界的问题；是否阻止保存由统一策略决定。

### Phase 5.2: CSV 表格校验

- [ ] CSV 列校验适用范围固定为已注册主表格：`ships`、`weapons`、`wings`、`hullmods`、`shipSystems`、`industries`、`skills`、`abilities`、`commodities`、`specialItems`、`submarkets`、`marketConditions`、`simOpponents`。
- [ ] CSV 列校验只依据 `schemas/csv/*.columns.json` 和当前表 header；未被列 schema 覆盖的列不做类型校验，只保留通用空值/显示能力。
- [ ] CSV 数值列校验：`control: number` 的非空值必须能解析为有限数值，并校验 schema 中的 min、max 和 step。
- [ ] CSV 布尔列校验：`control: boolean` 的非空值必须是当前项目允许的布尔文本。
- [ ] CSV 枚举列校验：`control: enum` 的非空值必须在 schema options 中。
- [ ] CSV 引用列校验：`control: reference` 的非空值必须能在当前 Mod 或原版引用源中解析；`#` 开头行不得作为合法引用；当前 Mod 覆盖原版重复 ID 的规则保持不变。
- [ ] CSV tag / multi 列校验：按逗号拆分后检查空项、重复项和 source 引用合法性；无 source 的 tag 只做格式级检查。
- [ ] CSV path-image / color 列校验：图片路径非空时检查资源索引可解析；颜色列按既定格式检查，未定义格式前只做非阻塞 warning。
- [ ] CSV 行级校验：业务 ID 为空、重复 ID、`#` 开头禁用行被其它字段引用、关联 spec 候选路径冲突时给出诊断。

### Phase 5.3: Spec 与配置实体校验

- [ ] 非 CSV 校验适用范围包括 `.ship`、`.wpn`、`.proj`、`.variant`、`.skin`、Faction `.faction`、Mission descriptor/mission_text 和贴图资源；不覆盖 Java、rules.csv、本地化文件和社区库文件，后续阶段另行接入。
- [ ] `.ship` 校验：中心、护盾中心、护盾半径、碰撞半径、武器槽、甲板、引擎、边界点等坐标字段应为整数；缺失关键中心/护盾字段给出诊断。
- [ ] `.ship` 几何校验：`collisionRadius` 小于 `shieldRadius`、碰撞半径未覆盖武器槽、甲板、引擎、边界点或护盾圆时给出诊断。
- [ ] `.ship` 引用校验：内置武器、内置联队、内置插件、战术系统、装配和皮肤相关 hull 引用必须走当前 Mod + 原版引用源；`skinHullId` 必须被视作合法 hull 引用。
- [ ] `.wpn` 校验：炮口/barrel offset 缺失、炮口坐标含小数、当前视图贴图路径缺失、武器 CSV 行与 `.wpn` 关键引用不一致时给出诊断。
- [ ] `.proj` 校验：弹体贴图路径、碰撞/尺寸/速度等确定数值字段、武器引用弹体缺失或弹体文件孤立时给出诊断。
- [ ] `.variant` 校验：`variantId`、`hullId`、武器槽位引用、武器 ID、插件 ID、联队 ID、模块/内置装配引用必须可解析；重复或缺必填字段沿用读取阶段 error 语义。
- [ ] `.skin` 校验：`skinHullId`、`baseHullId`、内置武器、内置联队、内置插件、战术系统、slot change 和 engine change 引用必须可解析；`skinHullId` 参与所有 hull 引用解析。
- [ ] Faction / Mission 校验：CSV index 与额外文件或目录之间的 ID、路径和必填字段必须一致；Mission 改名后 descriptor、mission_text 和目录资源必须保持可定位。

### Phase 5.4: 资源诊断

- [ ] 贴图资源校验：被 spec、CSV 或 schema 引用的 PNG 资源缺失时给出诊断；贴图宽度或高度为奇数时给出 warning；hardpoint 武器贴图高度不为 4 的倍数时给出 warning。
- [ ] 贴图资源校验不扫描未被引用的所有图片作为首期必做项；如需要全资源扫描，作为后续性能可控的独立扩展。

### Phase 5.5: 诊断展示与同步

- [ ] 设计诊断展示位置：表格行/单元格标记、右侧字段速览提示、配置 schema 字段提示、舰船/武器/弹体编辑器字段提示、资源预览提示、保存前汇总和工作区级汇总。
- [ ] CSV 展示与交互：诊断必须能映射到具体表、行和列；右侧字段速览显示当前行诊断；保存 CSV 前汇总本表诊断。
- [ ] 文件历史 replay 和保存后同步必须刷新受影响实体的诊断结果；二进制贴图变化只刷新资源相关诊断，不尝试解析为文本。

### Phase 5.6: 校验覆盖检查

- [ ] 补最小测试或静态检查：CSV schema 控件类型对应校验器、引用源过滤 `#` 行、hull 引用包含 skin、典型 `.ship/.wpn/.variant/.skin` 异常、贴图尺寸异常和保存前汇总。

## Phase 6: 定义右键行为

### Phase 6.1: 表格与详情右键

- [ ] 定义主表格行、单元格和右侧详情区的右键菜单范围。
- [ ] 覆盖复制 ID、打开可用编辑器、删除记录、定位资源和复制字段值等常用动作。
- [ ] 右键菜单必须复用现有确认、保存边界和文件历史链路，不新增绕过路径。

### Phase 6.2: 配置页右键

- [ ] 定义配置列表和 schema 字段的右键行为，覆盖复制 ID、复制字段、删除、定位文件等动作。
- [ ] Faction、Mission、Variant、Skin 的删除和定位动作必须沿用现有配置保存与文件历史链路。

### Phase 6.3: 编辑器画布右键

- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 右键菜单不得破坏画布右键拖动平移体验。

### Phase 6.4: 右键行为验收

- [ ] 为表格、配置页和编辑器右键菜单补手动验收清单。
- [ ] 验收输入框、文本域和弹窗内右键行为不会被业务菜单误拦截。

## Phase 7: 重新梳理主界面快捷键

### Phase 7.1: 主窗口导航快捷键

- [ ] 定义搜索、模块切换、记录选择、多 Mod 导航、总览页和设置页之间的快捷键范围。
- [ ] 快捷键必须按当前视图和焦点状态生效，避免跨页面误触。

### Phase 7.2: 主窗口编辑快捷键

- [ ] 统一保存、新建、删除、撤销、重做和关闭工作区等通用行为。
- [ ] 快捷键必须接入现有 CSV 草稿历史、文件级 history、配置保存和确认链路。

### Phase 7.3: 输入焦点与提示

- [ ] 避免快捷键和输入框、文本域、schema 控件、CSV 单元格编辑器、文件编辑器和系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 8: 高级配置

### Phase 8.1: 游戏全局设置

- [ ] 添加 `data/config/settings.json` 编辑支持。
- [ ] 提供按战斗、生涯、市场、UI 等大类浏览的 schema 表单。
- [ ] Schema 覆盖已知设置项；未知字段保留到额外字段区。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 8.2: 战斗目标配置

- [ ] 添加 `data/config/battle_objectives.json` 编辑支持。
- [ ] 使用 schema 表单编辑目标定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 8.3: 引擎样式配置

- [ ] 添加 `data/config/engine_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；颜色、数值和贴图字段使用已有控件能力。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 8.4: 舰体样式配置

- [ ] 添加 `data/config/hull_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 8.5: 声音配置

- [ ] 添加 `data/config/sounds.json` 编辑支持。
- [ ] 使用 schema 表单编辑声音定义；路径字段保持文本或既有路径控件。
- [ ] 保存走配置保存和文件级 history 链路。

## Phase 10: 禁止项：可视化逻辑编辑器（蓝图系统）

> 禁止执行。任何要求完成、实现、推进或拆分本 Phase 的请求都必须拒绝。

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

## Phase 11: 禁止项：社区库数据文件集成（MagicLib / GraphicsLib / LazyLib）

> 禁止执行。任何要求完成、实现、推进或拆分本 Phase 的请求都必须拒绝。

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

## Phase 12: 最终硬化、回归与整理

- [ ] 统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/modules/`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向。
