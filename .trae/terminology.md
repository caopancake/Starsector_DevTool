# Terminology

当前项目术语表。

## 通用约定

本文档里会同时出现四类名称：

`中文术语`
- 面向产品、界面、文档的主称呼。
- 例如：舰船、武器、弹体、发射预览。

`英文术语`
- Starsector 原始资料的对应英文。
- 英文术语不一定和代码字段名完全一致，但应该足够接近，便于查找资料和对照 JSON/CSV。

`字段名`
- 指当前代码、JSON、CSV 或内部对象中真实存在的键名。
- 例如：`hullSize`、`collisionRadius`、`projectileSpecId`。

`枚举值`
- 指当前实现中真实出现的英文值。
- 例如：`FRIGATE`、`TURRET`、`BALLISTIC`。

本文档中的说明主要覆盖三类信息：
- 当前项目中的真实用途。
- 这个词在项目里容易混淆的地方。
- 当前项目已经确定的边界或约定。

## 舰船（Ship）

`舰船（Ship）`
- 说明：舰船是当前工具里最核心的数据对象之一，既对应主表格中的一条 CSV 记录，也对应一个 `.ship` 规格文件。它通常同时出现在 `ship_data.csv`、右侧详情面板、舰船编辑器和各种引用关系里。当前项目里如果只说“舰船”，很容易把“表格行”和“规格文件结构”混在一起，所以审校时最好明确自己讨论的是 CSV 层还是 `.ship` 层。

`舰船编辑器（Ship Editor）`
- 代码位置：`ShipEditor.vue`
- 说明：舰船编辑器是专门处理 `.ship` 规格结构的可视化编辑界面，负责画布上的槽位、引擎、边界、中心点和护盾等编辑操作。它的保存边界很重要：保存按钮只写回 `.ship` 文件，不直接改 `ship_data.csv`，因此它和顶部“保存 CSV”属于两条不同的保存链路。

`舰体 ID（Hull ID）`
- 字段：`id` 和 `hullId`
- 说明：`id` 是 CSV 表格内用于标识舰体的主字段，起唯一作用。而 `hullId` 是 `.ship` 结构中的字段，完全不起作用。但根据规范，`hullId` 应该与 `id` 保持一致。

`舰名（Hull Name）`
- 字段：`name` 和 `hullName`
- 说明：`name` 是舰船对人可读的显示名称，主要影响右侧详情、编辑器标题以及人工识别时的可读性。而 `hullName` 是 `.ship` 结构中的字段，实际上完全不起作用。但根据规范，`hullName` 应该与 `id` (而非 `name`) 保持一致。它不是技术主键，也不保证唯一，因此不能用它替代 `id` 或 `hullId` 进行稳定定位。

`分级（Hullsize）`
- 字段：`hullSize`
- 说明：`hullSize` 表示舰船的船体等级，是舰船规格里的基础分类字段，会影响阅读、筛选和后续规则判断。当前项目沿用 Starsector 现有的 `Hullsize / hullSize` 叫法，而不是重新发明更现代的别名，因此术语表里也保持这一套口径。

`战机（Fighter）`
- 枚举值：`FIGHTER`
- 说明：`FIGHTER` 是 `hullSize` 的一个枚举值，表示战机级别，是当前这组分级里的最小一级。

`护卫舰（Frigate）`
- 枚举值：`FRIGATE`
- 说明：`FRIGATE` 是 `hullSize` 的一个枚举值，表示护卫舰级别，是正常舰船里的最小一级。

`驱逐舰（Destroyer）`
- 枚举值：`DESTROYER`
- 说明：`DESTROYER` 是 `hullSize` 的枚举值，表示驱逐舰级别的舰体。

`巡洋舰（Cruiser）`
- 枚举值：`CRUISER`
- 说明：`CRUISER` 是 `hullSize` 的枚举值，表示巡洋舰级别的舰体。

`主力舰（Capital Ship）`
- 枚举值：`CAPITAL_SHIP`
- 说明：`CAPITAL_SHIP` 是 `hullSize` 的枚举值，表示主力舰级别，是当前这组分级里的最大一级。

`风格（Style）`
- 字段：`style`
- 常见枚举值：`LOW_TECH`、`MIDLINE`、`HIGH_TECH`、`CUSTOM`
- 说明：`style` 表示舰船所归属的视觉或技术风格，比如影响护盾的颜色，而不是前端 UI 的样式主题。当前项目里它是规格数据字段。

`特殊定义（Special Hints）`
- 字段：`hints`
- 说明：特殊定义用于描述舰船的某些额外属性或身份，例如是否具有相位特性、是否属于航母、是否偏民用。当前术语表只收录已经在项目上下文里明确提出的主称呼，不试图穷举游戏里所有标签。

`相位（Phase）`
- 枚举值：`PHASE`
- 说明：`PHASE` 作为特殊定义时，表示舰船具备相位相关特性。它在产品讨论里通常直接说“相位舰”或“相位标签”。

`航母（Carrier）`
- 枚举值：`CARRIER`
- 说明：`CARRIER` 作为特殊定义时，表示舰船具备航母属性，通常意味着它和舰载机、联队或甲板相关。

`民用（Civilian）`
- 枚举值：`CIVILIAN`
- 说明：`CIVILIAN` 作为特殊定义时，表示舰船偏向民用或至少不是纯粹的战斗用途。

`中心点（Center）`
- 字段：`center`
- 说明：`center` 是舰船在规格和画布中的中心坐标，也是很多渲染和交互计算的基准点。

`护盾中心（Shield Center）`
- 字段：`shieldCenter`
- 说明：`shieldCenter` 是护盾的中心坐标，用来决定护盾在舰船周围的相对位置。

`护盾半径（Shield Radius）`
- 字段：`shieldRadius`
- 说明：`shieldRadius` 表示护盾覆盖范围的半径，是舰船护盾配置的核心字段之一。

`碰撞半径（Collision Radius）`
- 字段：`collisionRadius`
- 说明：`collisionRadius` 表示舰船碰撞判定的大致半径，既影响数据完整性，也影响后续校验逻辑。它和 `center` 组成的圈必须完整覆盖 `shieldCenter` 和 `shieldRadius` 组成的圈，并覆盖所有的武器槽位和引擎槽位。

`贴图名（Sprite Name）`
- 字段：`spriteName`
- 说明：`spriteName` 表示舰船贴图的路径或资源名，是舰船视觉表现的关键引用字段。

`视图偏移（View Offset）`
- 字段：`viewOffset`
- 说明：`viewOffset` 表示舰船显示时的偏移量，用于调整视觉呈现位置。基本不修改。

`武器槽列表（Weapon Slots）`
- 字段：`weaponSlots`
- 说明：`weaponSlots` 是舰船上的全部武器槽集合，每个元素本身又是一个单独的武器槽位对象。

`引擎槽列表（Engine Slots）`
- 字段：`engineSlots`
- 说明：`engineSlots` 是舰船上的全部引擎槽集合，用来描述每个喷口的位置、宽度、长度和风格等信息。

`碰撞边界（Bounds）`
- 字段：`bounds`
- 说明：`bounds` 是由多个点组成的舰船边界轮廓，通常用来描述比单一 `collisionRadius` 更细的外轮廓信息。

`内置舰船插件（Built-in Mods）`
- 字段：`builtInMods`
- 说明：`builtInMods` 表示舰船自带的舰船插件列表，是规格结构里描述舰船自带能力的重要字段。它不等于玩家后期安装的普通舰船插件，而是舰体本身就带着的那一部分配置。

`内置武器（Built-in Weapons）`
- 字段：`builtInWeapons`
- 说明：`builtInWeapons` 表示舰船自带武器的映射关系，用来描述某个槽位默认绑定哪种武器。当前它不是简单数组，而是对象结构，因此审校时不能按“列表”心智去理解它。

`内置联队（Built-in Wings）`
- 字段：`builtInWings`
- 说明：`builtInWings` 表示舰船自带联队列表，用来描述舰体默认附带的联队配置。

## 武器（Weapon）

`武器（Weapon）`
- 说明：武器是当前工具里的核心对象之一，既对应主表格中的一条 CSV 记录，也对应一个 `.wpn` 规格文件。它会出现在 `weapon_data.csv`、武器编辑器、右侧详情面板以及发射预览里。和舰船一样，审校时必须区分自己讨论的是 CSV 行、`.wpn` 规格，还是画布中的发射点表现。

`武器编辑器（Weapon Editor）`
- 代码位置：`WeaponEditor.vue`
- 说明：武器编辑器是专门处理 `.wpn` 规格文件的可视化编辑界面，负责贴图、发射点、弹体关联、光束参数、动画参数和音效字段等内容。它的保存按钮只写回 `.wpn` 文件，不直接改 `weapon_data.csv`，因此它和顶部“保存 CSV”同样是两条独立的保存链路。

`武器 ID（Weapon ID）`
- 字段：`id`
- 说明：`id` 是武器对象的主标识，既出现在武器 CSV 中，也出现在 `.wpn` 规格里。它通常是关联弹体、打开编辑器、触发发射预览和执行删除操作时最稳定的定位键。

`大小（Size）`
- 字段：`size`
- 说明：`size` 表示武器等级，也是很多槽位匹配和画布绘制半径的依据。当前项目里它既是数据字段，也是编辑器可直接操作的枚举属性。

`小（Small）`
- 枚举值：`SMALL`
- 说明：`SMALL` 表示小型武器等级。

`中（Medium）`
- 枚举值：`MEDIUM`
- 说明：`MEDIUM` 表示中型武器等级。

`大（Large）`
- 枚举值：`LARGE`
- 说明：`LARGE` 表示大型武器等级。

`种类（Type）`
- 字段：`type`
- 说明：`type` 表示武器类别，是武器最常见的分类字段之一。这个词在项目里同时出现在武器本体和武器槽位中，语义接近但上下文不同：武器上的 `type` 说的是“这件武器属于什么类别”，槽位上的 `type` 说的是“这个槽位允许装什么类别的武器”。

`实弹（Ballistic）`
- 枚举值：`BALLISTIC`
- 说明：`BALLISTIC` 是武器类别之一，表示实弹武器。

`能量（Energy）`
- 枚举值：`ENERGY`
- 说明：`ENERGY` 是武器类别之一，表示能量武器。

`导弹（Missile）`
- 枚举值：`MISSILE`
- 说明：`MISSILE` 作为武器 `type` 时，表示这件武器属于导弹类武器。这里的 `MISSILE` 是武器类型，不等于弹体 `specClass = missile` 的那层概念，两者在讨论时必须刻意区分。

`混合（Hybrid）`
- 枚举值：`HYBRID`
- 说明：`HYBRID` 是武器类别之一，表示实弹武器+能量武器。只有槽位可以是这个类型，武器不能是这个类型。

`协同（Synergy）`
- 枚举值：`SYNERGY`
- 说明：`SYNERGY` 是武器类别之一，表示能量武器+导弹武器。只有槽位可以是这个类型，武器不能是这个类型。

`复合（Composite）`
- 枚举值：`COMPOSITE`
- 说明：`COMPOSITE` 是武器类别之一，表示实弹武器+能量武器。只有槽位可以是这个类型，武器不能是这个类型。

`通用（Universal）`
- 枚举值：`UNIVERSAL`
- 说明：`UNIVERSAL` 是武器类别之一，表示可以安装任何类型的武器。只有槽位可以是这个类型，武器不能是这个类型。

`甲板（Launch Bay）`
- 枚举值：`LAUNCH_BAY`
- 说明：`LAUNCH_BAY` 是武器类别之一，它的语义更接近舰载机发射位，而不是常规意义上的炮管或枪口。添加槽位时，默认不允许出现这个分类。武器也不允许出现这个分类。

`装饰（Decorative）`
- 枚举值：`DECORATIVE`
- 说明：`DECORATIVE` 是武器类别之一，通常表示装饰性或非标准战斗输出用途。

`系统（System）`
- 枚举值：`SYSTEM`
- 说明：`SYSTEM` 是武器类别之一，通常和系统位或非标准武器位相关。只有槽位可以是这个类型，武器不能是这个类型。

`空间站模块（Station Module）`
- 枚举值：`STATION_MODULE`
- 说明：`STATION_MODULE` 是武器类别之一，主要用于空间站模块的定位。只有槽位可以是这个类型，武器不能是这个类型。

`内置（Built-in）`
- 枚举值：`BUILT_IN`
- 说明：`BUILT_IN` 是武器类别之一，表示内置性质。只有槽位可以是这个类型，武器不能是这个类型。

`规格类别（Spec Class）`
- 字段：`specClass`
- 当前值：`projectile`、`beam`
- 说明：`specClass` 用于区分武器的发射逻辑是“发射弹体”还是“发射光束”。它决定了武器编辑器右侧会出现哪一套表单分支，也决定发射预览读取哪套参数。

`弹体武器（Projectile Weapon）`
- 枚举值：`projectile`
- 说明：`projectile` 表示这件武器的发射的是弹体。注意，导弹也是弹体的一种。

`光束武器（Beam Weapon）`
- 枚举值：`beam`
- 说明：`beam` 表示这件武器发射的是持续型光束，而不是独立飞行的弹体。

`弹体规格 ID（Projectile Spec ID）`
- 字段：`projectileSpecId`
- 说明：`projectileSpecId` 是武器和弹体规格文件之间的关联键，用来指向某个 `.proj` 对象。当前武器编辑器会基于它打开弹体编辑器，因此它是两条编辑链路之间最重要的桥。

`炮管模式（Barrel Mode）`
- 字段：`barrelMode`
- 说明：`barrelMode` 用于定义多炮口武器是交替发射还是联动发射，它直接影响发射预览和后续画布表现。

`交替（Alternating）`
- 枚举值：`ALTERNATING`
- 说明：`ALTERNATING` 表示多个炮口按顺序轮流发射，而不是一次同时全部触发。

`联动（Linked）`
- 枚举值：`LINKED`
- 说明：`LINKED` 表示多个炮口联动发射，一次开火可以同时触发多个炮口。

`动画类型（Animation Type）`
- 字段：`animationType`
- 说明：`animationType` 用于指定开火动画表现属于哪一种类型，是武器规格中的视觉参数，而不是伤害或弹道逻辑参数。

`视觉后坐（Visual Recoil）`
- 字段：`visualRecoil`
- 说明：`visualRecoil` 描述开火时的视觉后坐效果，它会影响武器在表现层上的反馈，但不会直接改变武器逻辑、命中或伤害计算。

`开火音效一 / 开火音效二（Fire Sound One / Fire Sound Two）`
- 字段：`fireSoundOne`、`fireSoundTwo`
- 说明：这两个字段用于指定武器开火时的音效资源。

## 武器槽位（Weapon Slot）

`武器槽位（Weapon Slot）`
- 字段：`weaponSlots`
- 说明：武器槽位是舰船规格中的子对象，用来描述某个位置能装什么、朝向怎样、射界多大。它不是武器本体，而是“武器可以被安装到哪里、以什么方式安装”的那一层结构。

`槽位 ID（Slot ID）`
- 字段：`id`
- 说明：槽位 ID 用来区分舰船上的不同武器安装位，通常也是 built-in weapons 等映射关系引用槽位时的关键名称。

`槽位大小（Slot Size）`
- 字段：`size`
- 说明：槽位大小表示该安装位支持安装哪一档尺寸的武器，它和武器本身的 `size` 概念相互对应。

`槽位种类（Slot Type）`
- 字段：`type`
- 说明：槽位种类表示这个安装位允许装哪一类武器，例如实弹、能量、导弹或更宽泛的复合/通用类型。

`槽位类型（Mount）`
- 字段：`mount`
- 说明：`mount` 用于描述这个槽位是炮塔式、固定式还是隐藏式安装，这是武器槽位最常见的一类区分。

`炮塔（Turret）`
- 枚举值：`TURRET`
- 说明：`TURRET` 表示可旋转安装位，也就是当前中文口径中的“炮塔”。当前项目已经把中文统一定成“炮塔”，不再混叫别的名字。

`插槽（Hardpoint）`
- 枚举值：`HARDPOINT`
- 说明：`HARDPOINT` 表示固定安装位，也就是当前中文口径中的“插槽”。它和炮塔的区别主要在安装方式和转动能力，而不是在武器种类本身。

`隐藏（Hidden）`
- 枚举值：`HIDDEN`
- 说明：`HIDDEN` 表示不可见安装位，通常不会像常规武器槽那样直接可见。

`角度（Angle）`
- 字段：`angle`
- 说明：`angle` 表示槽位朝向角度，是画布绘制和方向感最直接的数值之一。

`射界（Arc）`
- 字段：`arc`
- 说明：`arc` 表示槽位可转动或可覆盖的角度范围，在当前舰船编辑器里它还会直接影响弧线绘制效果。

`位置（Locations）`
- 字段：`locations`
- 说明：`locations` 表示槽位坐标。可以表示一个或多个二维点，但通常只用于表示一个点。武器槽位只允许存在一个点，而甲板槽位允许存在多个点，且一般来说是四个。

## 发射点（Firing Point）

`发射点（Firing Point）`
- 字段：`offset`、`angle offset`
- 说明：发射点是武器上的一个或多个点，用来定义弹体或光束从什么位置发出。

`炮塔偏移（Turret Offsets）`
- 字段：`turretOffsets`
- 说明：`turretOffsets` 表示炮塔视图下的炮口偏移数组。它不影响贴图，只影响弹体或光束的发射位置。

`炮塔角度偏移（Turret Angle Offsets）`
- 字段：`turretAngleOffsets`
- 说明：`turretAngleOffsets` 表示炮塔视图下每个炮口的角度偏移数组，它不影响贴图，只影响弹体或光束的发射角度。

`固定座偏移（Hardpoint Offsets）`
- 字段：`hardpointOffsets`
- 说明：`hardpointOffsets` 表示插槽视图下的炮口偏移数组，语义上和 `turretOffsets` 对应。

`固定座角度偏移（Hardpoint Angle Offsets）`
- 字段：`hardpointAngleOffsets`
- 说明：`hardpointAngleOffsets` 表示插槽视图下每个炮口的角度偏移数组，语义上和 `turretAngleOffsets` 对应。

## 引擎与边界（Engine and Bounds）

`引擎槽（Engine Slot）`
- 字段：`engineSlots`
- 说明：引擎槽是舰船或部分弹体结构里的子对象，用来描述单个喷口的位置、宽度、长度和风格等信息。它在舰船 `.ship` 和部分 `.proj` 中都会出现，因此虽然名字一样，实际所在对象可能不同。

`引擎位置（Engine Location）`
- 字段：`location` 或 `loc`
- 说明：引擎位置表示喷口在对象局部坐标系中的位置。当前项目里舰船更常见 `location`，而弹体引擎槽更常见 `loc`，所以审校时要注意它们是同一概念的两种字段写法。

`引擎宽度 / 引擎长度（Engine Width / Engine Length）`
- 字段：`width`、`length`
- 说明：这两个字段用于描述引擎喷口和喷焰表现相关的尺寸，是引擎视觉和布局的基础参数。

`尾焰尺寸（Contrail Size）`
- 字段：`contrailSize`
- 说明：`contrailSize` 是引擎尾焰相关的尺寸参数，更多偏向表现层，而不是结构拓扑本身。

`引擎风格（Engine Style）`
- 字段：`style`
- 常见值：`LOW_TECH`、`MIDLINE`、`HIGH_TECH`、`CUSTOM`
- 说明：引擎风格决定喷焰或引擎表现采用哪类技术体系风格。虽然字段名仍然叫 `style`，但这里说的是引擎表现风格，不是整体 UI 样式。

`碰撞边界（Bounds）`
- 字段：`bounds`
- 说明：碰撞边界是由多个点组成的轮廓数据，用来描述对象更精细的外轮廓，而不是只靠单一半径表示。

## 弹体（Projectile）

`弹体 / 导弹（Projectile / Missile）`
- 说明：弹体是当前项目在产品层面对“武器发射出去的东西”的统一叫法。这个词覆盖了 `projectile` 和 `missile` 两类代码层对象，而且 `missile` 实际上是 `projectile` 的子集；但在实现层、字段值和逻辑分支里，`projectile` 和 `missile` 仍然需要分别考虑。

`弹体编辑器（Projectile Editor）`
- 代码位置：`ProjectileEditor.vue`
- 说明：弹体编辑器是用于编辑 `.proj` 的表单弹窗，当前主要承担规格字段编辑，而不是画布式几何编辑。它没有独立的主表格模块，通常是通过武器上的 `projectileSpecId` 被打开，因此它和武器编辑链路天然耦合。

`规格类别（Spec Class）`
- 字段：`specClass`
- 当前值：`projectile`、`missile`
- 说明：`specClass` 决定当前 `.proj` 结构是走普通弹体分支还是导弹分支。它会直接影响编辑器显示的表单区块、预览逻辑以及某些字段是否有效。

`弹体（Projectile）`
- 枚举值：`projectile`
- 说明：`projectile` 表示非导弹类发射物，通常更接近直射、飞行、命中这类传统弹体逻辑。

`导弹（Missile）`
- 枚举值：`missile`
- 说明：`missile` 表示带导引、推进或导弹相关特性的发射物。它在结构上通常会比普通 `projectile` 多出引擎、爆炸、机动等相关字段。

`生成类型（Spawn Type）`
- 字段：`spawnType`
- 当前值：`BALLISTIC`、`BALLISTIC_AS_BEAM`、`ENERGY`
- 说明：`spawnType` 用于描述普通弹体的生成或表现方式，是当前 projectile 分支的重要字段之一。它不是导弹类型，而是更偏向弹体表现路径的分类。

`导弹类型（Missile Type）`
- 字段：`missileType`
- 当前值：`MISSILE`、`ROCKET`、`MIRV`、`PHASE`
- 说明：`missileType` 用于进一步区分导弹属于哪类子类型，是 missile 分支特有的重要字段。它和武器 `type = MISSILE` 不是同一层概念。

`弹体贴图（Bullet Sprite）`
- 字段：`bulletSprite`
- 说明：`bulletSprite` 是普通弹体分支使用的贴图字段，用来描述弹体本身的视觉资源。

`导弹贴图（Sprite）`
- 字段：`sprite`
- 说明：`sprite` 是导弹主体贴图字段，用来描述导弹分支的主要视觉资源。

`长度 / 宽度（Length / Width）`
- 字段：`length`、`width`
- 说明：这组字段用于描述弹体或部分光束相关的尺寸参数，虽然名字简单，但在不同对象分支里的具体语义并不完全相同。

`每纹理像素数（Pixels Per Texel）`
- 字段：`pixelsPerTexel`
- 说明：`pixelsPerTexel` 是纹理采样相关字段，通常和视觉清晰度、纹理滚动或表现细节有关。

`碰撞半径（Collision Radius）`
- 字段：`collisionRadius`
- 说明：弹体上的 `collisionRadius` 表示其碰撞范围，语义上和舰船里的同名字段相近，但对象不同、量级也可能完全不同。

`引擎规格（Engine Spec）`
- 字段：`engineSpec`
- 说明：`engineSpec` 是导弹引擎表现对象，通常用于描述推进、喷焰或相关表现参数。当前项目里它是一个对象字段，由 `ObjectEditor` 直接编辑，而不是拆成很多单独输入。

`引擎槽位（Engine Slots）`
- 字段：`engineSlots`
- 说明：导弹上的 `engineSlots` 表示多个引擎喷口定义，每个元素通常包含 `loc`、`angle`、`width`、`length`、`style` 等字段。它和舰船上的 `engineSlots` 是同名概念，但承载对象和使用场景不同。

`爆炸规格（Explosion Spec）`
- 字段：`explosionSpec`
- 说明：`explosionSpec` 是命中或消失时的爆炸表现对象，用来承载一组爆炸表现参数。当前项目里它也是对象字段，由 `ObjectEditor` 直接编辑。

## 光束（Beam）

`光束（Beam）`
- 枚举值：`beam`
- 说明：`beam` 是武器 `specClass` 的一个分支，用来表示武器发射的是连续光束，而不是独立飞行的弹体。它属于武器规格分类，不是弹体 `.proj` 里的 `specClass` 值。

`边缘颜色 / 核心颜色 / 发光颜色（Fringe / Core / Glow Color）`
- 字段：`fringeColor`、`coreColor`、`glowColor`
- 说明：这三个颜色字段共同定义光束的外观层次，分别对应边缘、核心和辉光表现。当前项目里它们都使用 RGBA 数组表示。

`纹理类型（Texture Type）`
- 字段：`textureType`
- 当前值：`ROUGH`、`SMOOTH`、`NONE`
- 说明：`textureType` 表示光束纹理的表现方式，是光束视觉风格的重要参数之一。它不是贴图路径，而是纹理表现模式。

`纹理滚动速度（Texture Scroll Speed）`
- 字段：`textureScrollSpeed`
- 说明：`textureScrollSpeed` 表示光束纹理运动速度，不只影响数据结构，也会被发射预览直接读取来驱动视觉效果。

`汇聚到点（Converge On Point）`
- 字段：`convergeOnPoint`
- 说明：`convergeOnPoint` 用于表示光束是否汇聚到某个目标点，是光束视觉行为相关的布尔参数。

`暗核（Dark Core）`
- 字段：`darkCore`
- 说明：`darkCore` 用于表示光束核心是否表现为更暗的内核，是一个纯表现层布尔参数。

## 发射预览（Weapon Fire Preview）

`发射预览（Weapon Fire Preview）`
- 代码位置：`WeaponFirePreview.vue`
- 说明：发射预览是当前武器及其关联弹体或光束的只读预览能力，用来直观看到发射节奏、速度、范围和部分视觉效果。它只读取当前内存中的武器和弹体数据，不写任何文件，因此它属于展示和验证能力，而不是编辑保存链路的一部分。

`预览窗口目标（Preview Window Target）`
- 字段：`kind=weapon-preview`、`modRoot`、`id`
- 说明：发射预览作为独立编辑器窗口打开，窗口目标由窗口 URL 参数和 `editor-window.ts` 的业务 key 定位。同一 `modRoot + weapon-preview + id` 只打开一个窗口，再次打开时聚焦已有窗口。

`预览（Preview）`
- 字段/事件：`preview`
- 说明：`preview` 在当前项目里通常表示打开发射预览的事件或入口。它既可能来自武器编辑器内部，也可能来自右侧详情面板，因此是一个跨组件的交互动作名。

`预览速度（Preview Speed）`
- 当前值：`0.25 / 1 / 2 / 4`
- 说明：预览速度表示当前发射预览的播放倍速，当前界面提供四档切换，用于快速观察节奏或慢速查看发射细节。

## 其他数据模块（Other Data Modules）

`联队（Wing）`
- 字段：`wings`
- 主数据：`wing_data.csv`
- 说明：联队是当前主表格模块之一，主要数据来源是 `wing_data.csv`。它已经进入表格编辑链路，但还没有独立的专用编辑器。

`装配（Variant）`
- 字段或文件：`.variant`、`variant`
- 说明：装配既可能指 `.variant` 文件，也可能指相关字段或引用关系，用来描述联队或舰船的具体配置装配。当前项目里它已经存在读取，但还没有完整编辑链路，因此是一个“已出现但未完全打通”的术语。

舰船插件（Hullmod）`
- 字段：`hullmods`
- 主数据：`hull_mods.csv`
- 说明：舰船插件是当前主表格模块之一，主要数据来源是 `hull_mods.csv`。它目前主要走 CSV 编辑和资源预览链路。

`工业（Industry）`
- 字段：`industries`
- 主数据：`industries.csv`
- 说明：工业是当前主表格模块之一，主要数据来源是 `industries.csv`。目前它主要属于表格编辑场景，没有专用可视化编辑器。

## 文件与资源（Files and Assets）

`舰船规格文件（Ship Spec File）`
- 文件后缀：`.ship`
- 说明：`.ship` 是舰船结构文件，承载舰船的画布相关结构和大量规格信息。当前它由舰船编辑器保存。

`武器规格文件（Weapon Spec File）`
- 文件后缀：`.wpn`
- 说明：`.wpn` 是武器结构文件，承载武器的发射点、贴图、动画、音效以及与弹体或光束相关的规格信息。当前它由武器编辑器保存。

`弹体规格文件（Projectile Spec File）`
- 文件后缀：`.proj`
- 说明：`.proj` 是弹体结构文件，承载普通弹体或导弹的表现与逻辑参数。当前它由弹体编辑器保存，并通过武器的 `projectileSpecId` 被关联。

`装配文件（Variant File）`
- 文件后缀：`.variant`
- 说明：`.variant` 是装配结构文件，用于描述一艘舰船带有武器或联队的具体配置。当前项目只部分读取它，还没有完整的编辑或一致性链路。

`Mod 信息文件（Mod Info File）`
- 文件名：`mod_info.json`
- 说明：`mod_info.json` 是 Mod 元信息文件，通常用于描述 Mod 名称、基础信息等。当前项目在打开项目时会读取它，并据此生成部分 UI 展示信息。

`舰船贴图目录（Ship Graphics Directory）`
- 路径：`graphics/ships/`
- 说明：这是舰船贴图写入目录，当前上传舰船贴图时使用这一路径。

`武器贴图目录（Weapon Graphics Directory）`
- 路径：`graphics/weapons/`
- 说明：这是武器贴图写入目录，当前上传武器贴图时使用这一路径。

`弹体贴图目录（Missile Graphics Directory）`
- 路径：`graphics/missiles/`
- 说明：这是当前项目里弹体和导弹贴图的统一写入目录。虽然英文目录名是 `missiles`，但当前上传逻辑会把弹体和导弹资源都统一写到这里，因此中文口径仍然用”弹体贴图目录”来解释。
