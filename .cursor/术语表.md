# 术语表（AI 速查）

中文用于产品/UI/文档；英文用于 Starsector 资料；反引号为真实字段或枚举。讨论对象时先说明 CSV 行、spec 文件还是画布对象，不能因同名字段混用语义。

## 核心对象与保存边界

| 对象            | 主标识与文件                            | 保存 owner / 关键关系                                                                       |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| 舰船 Ship       | CSV `id`；`.ship` 的 `hullId`           | Ship Editor 只写 `.ship`；`hullId` 应与 CSV `id` 一致。`hullName` 是显示/惯例字段，非主键。 |
| 武器 Weapon     | `id`；`.wpn`                            | Weapon Editor 只写 `.wpn`；`projectileSpecId` 指向 `.proj`。                                |
| 弹体 Projectile | `.proj`；`specClass=projectile/missile` | Projectile Editor 保存 `.proj`；产品层“弹体”覆盖 projectile/missile，但代码分支须区分。     |
| 装配 Variant    | `.variant`                              | 配置编辑链路，不把文件、字段和引用关系混作同一对象。                                        |
| 发射预览        | `kind=weapon-preview, modRoot, id`      | 只读 ProjectSession 数据；不读取未保存 editor draft，不写文件。                             |

## 舰船与槽位

- `hullSize`：`FIGHTER/FRIGATE/DESTROYER/CRUISER/CAPITAL_SHIP`；`style`：`LOW_TECH/MIDLINE/HIGH_TECH/CUSTOM`，均为数据字段，不是 UI 风格。
- 结构：`center`、`shieldCenter`、`shieldRadius`、`collisionRadius`、`bounds`、`weaponSlots`、`engineSlots`、`builtInMods/Wings/Weapons`。`builtInWeapons` 是槽位 ID 到武器 ID 的对象映射。
- `collisionRadius` 与 `center` 的圆必须包住 shield、槽位、引擎；`spriteName` 是贴图引用，`viewOffset` 通常不改。
- 槽位：`id/size/type/mount/angle/arc/locations`。`mount=TURRET/HARDPOINT/HIDDEN` 分别译为炮塔/插槽/隐藏；普通武器槽仅一个 location，`LAUNCH_BAY` 可多点。
- 武器 `type` 是武器类别，槽位 `type` 是准入类别；`HYBRID/SYNERGY/COMPOSITE/UNIVERSAL/SYSTEM/STATION_MODULE/BUILT_IN` 仅槽位，`LAUNCH_BAY` 不得作为普通新增槽位或武器类型。

## 武器、发射点与光束

- 武器 `size=SMALL/MEDIUM/LARGE`；`type=BALLISTIC/ENERGY/MISSILE/DECORATIVE`。武器 `MISSILE` 不等于 `.proj` 的 `specClass=missile`。
- `.wpn.specClass=projectile/beam` 决定弹体或光束表单/预览分支；`barrelMode=ALTERNATING/LINKED`。
- 炮管：`turretOffsets/turretAngleOffsets` 与 `hardpointOffsets/hardpointAngleOffsets` 分别为炮塔/插槽视图的发射位置与角度。
- 光束字段：`fringeColor/coreColor/glowColor`（RGBA）、`textureType=ROUGH/SMOOTH/NONE`、`textureScrollSpeed`、`convergeOnPoint`、`darkCore`。

## 弹体与引擎

- `specClass=projectile` 使用 `spawnType=BALLISTIC/BALLISTIC_AS_BEAM/ENERGY`、`bulletSprite`；`specClass=missile` 使用 `missileType=MISSILE/ROCKET/MIRV/PHASE`、`sprite`。
- 共享/同名字段依对象解释：`collisionRadius`、`bounds`、`engineSlots`。舰船引擎位置为 `location`，弹体引擎常为 `loc`；`engineSpec`、`explosionSpec` 是对象编辑字段。

## 其它表、文件与资源

- `wing_data.csv`（联队）、`hull_mods.csv`（舰船插件）、`industries.csv`（工业）走表格链路；不要假定有专用编辑器。
- 文件：`.ship/.wpn/.proj/.variant` 与 `mod_info.json`。资源写入：舰船 `graphics/ships/`、武器 `graphics/weapons/`、弹体/导弹 `graphics/missiles/`。
- 预览倍速：`0.25/1/2/4`。`preview` 只是打开只读预览的交互名，不表示保存或编辑。
