# Todo

## Phase 1: ProjectSession 查询式加载架构重构

### Phase 1.1: Session Manifest 与兼容边界

- [x] 废弃完整项目数据包作为跨进程传输模型，改为打开 Mod 后返回轻量 `ProjectManifest`。
- [x] 新增 `ProjectSessionId` 和 `ProjectManifest`，包含 sessionId、modRoot、starsectorRoot、coreAvailable、modInfo、tableSummaries、entitySummaries 和 warnings。
- [x] Rust 建立 `ProjectSession`，session 内持有当前 Mod 的 CSV 索引、spec 索引、variant/skin 索引、资源索引、warning 和 core cache 引用。
- [x] 删除旧完整项目数据包入口；打开 Mod 只能建立 session 并返回 manifest，不得返回全量表、spec、原版引用或图片 data URL。
- [x] 保留读取失败、warning、重复 variant/skin 跳过、路径安全和保存边界现有语义。

### Phase 1.2: 查询式数据 API

- [x] 新增 session query API：关闭 session、查询 CSV 表窗口、查询 CSV source options、查询实体、查询资源 data URL、失效 session。
- [x] CSV 表窗口 query 返回 header、totalRows、rowKey、rows 和窗口范围；不得要求前端一次接收整表。
- [x] 实体 query 覆盖 ship、weapon、projectile、variant、skin、faction、mission 和现有详情/编辑器需要的数据。
- [x] `csv:*` source query 在后端返回“当前 Mod / 原版”分组选项，并保持 Mod 覆盖原版重复 ID、`#` 行不可引用。
- [x] 独立编辑器窗口通过 sessionId 和 entity id 查询所需数据，不再自己打开 Mod。

### Phase 1.3: CSV 表格服务化与 Patch 保存

- [x] CSV Grid 按当前表请求窗口 rows，滚动时按 row window 查询或命中前端窗口缓存。
- [x] `tables.store` 改为 query-backed 状态，只维护当前表窗口缓存、dirty patch、选择、编辑和草稿 history。
- [x] 新建、删除、撤销、重做继续按 `modRoot + table + rowKey` 隔离。
- [x] 保存当前表时前端提交当前表 patch，Rust 用 session baseline + patch 渲染 CSV 并进入现有 changeset / file history。
- [x] 保存成功后只刷新当前表 baseline、清空当前表 dirty 和当前表草稿 history，不影响其它表。

### Phase 1.4: 原版引用服务端缓存

- [x] 以 Starsector root 为 key 建立进程内 core cache。
- [x] core CSV、`.ship`、`.wpn`、`.variant`、`.skin`、引用索引和资源索引只保存在 Rust 进程内。
- [x] 前端只通过 source query 获取当前需要的原版引用选项，不接收整套原版引用数据。
- [x] 切换 root、刷新工作区或关闭工作区时按 root / session 失效。
- [x] 无 `starsector-core` 时继续返回空只读引用，不阻断外部 Mod 加载。

### Phase 1.5: 资源按需化

- [x] 新增 `ResourceRef`，表达 source、relPath、ownerKind、ownerId 和 key。
- [x] 打开 Mod 和 manifest 不返回任何图片 data URL。
- [x] 表格、详情、schema 下拉、配置列表、舰船编辑器、武器编辑器和发射预览统一通过资源服务按需加载图片。
- [x] 前端图片缓存按 sessionId / modRoot / starsectorRoot / relPath / source 隔离；首屏先显示占位，data URL 返回后原位补图。
- [x] 贴图上传、文件 history replay、配置保存和关闭工作区必须按变更路径精确失效资源缓存。

### Phase 1.6: alex_csv 热点重构

- [x] 使用统一字节状态机重写 `alex_csv` records 阶段，降低大文本、多行字段和长字段 CSV 的解析成本。
- [x] 保留当前宽松 CSV 语义：可见空行、`#` 行、短 `#` 行补齐、CP1252 兼容字符、多行字段和错误路径。
- [x] 不允许 descriptions 专用解析分支；性能提升必须属于统一 parser 模型。
- [x] 更新 CSV parser 模块文档，移除过时的 csv crate 读取链路描述。

### Phase 1.7: 前端状态与派生缓存重排

- [x] `project.store` 改为保存 session manifest 和活动 session，不保存完整项目数据包。
- [x] schema source、右侧详情、配置页和编辑器入口改为通过 session query / selector 获取数据。
- [x] CSV source / Grid model 缓存按 `sessionId + table/source + editMode` 失效。
- [x] 文件 history replay 后只通知 session 中受影响目标失效，不重建整个项目状态。
- [x] 前端大型派生计算必须可缓存、可分帧或可延后，不得阻塞点击、滚动和输入。

### Phase 1.8: 静态检查与模块文档收口

- [x] 补充 ProjectSession 架构相关静态检查。
- [x] 修改不再适用于查询式加载架构的旧静态检查。
- [x] 静态检查必须按严格工程规范编写，优先封死边界，完全不关心误伤。
- [x] 禁止用业务白名单、临时例外、兼容放行绕过新架构边界。
- [x] 更新模块文档，记录 session、query、CSV window、resource、core cache、history invalidation 的长期边界。

## Phase 2: 架构收束与调用链统一

### Phase 2.1: 后端 ProjectSession 模块重排

- [x] 将 `src-tauri/src/services/project/mod.rs` 按正式职责重排为 session、query、write、cache 和 model 子模块。
- [x] `session` 只负责打开、关闭、session 生命周期、session cache 和 root cache 生命周期，不承载 CSV、entity、resource 业务逻辑。
- [x] `query` 只负责读取，按 CSV window、entity、source options、resource data URL、hull reference 分模块组织。
- [x] `write` 只负责写入事务，按 CSV patch、config entity、文件保存、贴图上传和 history invalidation 分模块组织。
- [x] `cache` 明确区分 session cache 与 core cache；session 按 sessionId 失效，core 按 starsectorRoot 失效。
- [x] `model` 放 ProjectSession 内部模型、QueryKey、WriteResult、ResourceRef 辅助模型和 rowKey / patch 规则。
- [x] Rust command 层继续只调用 service；拆分不得恢复 command 直接访问 IO、parser 或业务 helper。

### Phase 2.2: 后端读写模型统一

- [x] 所有 query 入口统一为 `sessionId + query kind + parameters` 的模型，不允许各模块自定义不可复用 query 形态。
- [x] 所有写入入口统一返回 changes、invalidatedPaths、必要刷新数据和 keyMap；写入结果必须能直接驱动前端 cache invalidation。
- [x] CSV 保存、config entity 保存、文件编辑器保存、贴图上传和 history replay 必须进入同一套 invalidation 输出模型。
- [x] source query、hull reference query 和 resource query 的 `ResourceRef` 生成规则必须统一，禁止前后端重复拼接资源路径。
- [x] core cache 继续按类型懒加载，不允许 source query 或 resource query 预读整套 core 数据。

### Phase 2.3: 前端 API 与 Service 重排

- [x] `src/shared/api` 按正式边界重命名和重排为 session、query、write、workspace / app config 等 wire adapter，不再按旧功能碎片命名。
- [x] `src/services` 按业务能力收束为 session service、query service、resource cache service、config entity service、CSV table service 和 write service。
- [x] `config.service.ts` 拆出保存、查询、hull reference 和 schema entity 相关职责；组件不得通过一个杂糅 service 横跨读写边界。
- [x] `table.service.ts` 只保留 CSV query、source options、grid model 输入和当前表保存能力，不承载配置 entity 或编辑器候选逻辑。
- [x] 编辑器候选项、schema 下拉、CSV 增强控件和配置新建弹窗必须复用同一套 source query / resource cache 服务。

### Phase 2.4: 前端 ViewModel 收束

- [x] 为复杂页面建立 `*.view-model.ts`，组件只接收状态、动作和渲染数据，不直接拼 query、cache、ResourceRef 或保存请求数据。
- [x] Config Mission、Faction、Variant、Skin 优先接入 ViewModel；列表、详情、创建、删除、保存和缩略图加载由 ViewModel 统一编排。
- [x] CSV 表格 ViewModel 统一管理当前表 window query、search、faction filter、row selection、dirty patch、草稿 history 和保存动作。
- [x] 编辑器窗口 ViewModel 统一管理 entity query、候选 source query、资源批量加载、保存和窗口事件。
- [x] ViewModel 不直接调用 shared/api；只能调用 service 或 orchestrator。

### Phase 2.5: 前端 Query / Cache 标准模型

- [x] 建立统一前端 query cache 模型，key 固定为 `sessionId + query kind + normalized parameters`。
- [x] CSV source options、hull references、resource data URLs、entity list、entity detail 和 CSV grid model 全部接入标准 cache / invalidation。
- [x] 所有资源 data URL 继续只接受批量 `ResourceRef[]`，组件不能直接发资源 query，也不能逐项补图。
- [x] session invalidation、changed paths、关闭 session、切换 root 必须统一清理相关 query cache 和 resource cache。
- [x] 性能日志接入标准 query 模型，记录 query kind、命中/未命中、耗时和结果规模。

### Phase 2.6: 旧 API、旧模型和命名清理

- [x] 删除或重命名所有仍带旧完整项目包、旧全局应用数据包、旧配置 API、旧任务读取和旧表格 service 语义的文件、函数和类型。
- [x] 检查 `shared/api`、`services`、`orchestrators`、`stores`、`windows` 的命名是否表达正式职责；不清晰的必须重命名。
- [x] 清理旧兼容函数、空占位实现、超大窗口查询、重复缓存和组件内临时 Promise 编排。
- [x] Rust 和前端测试按新模块边界重排；不保留围绕旧入口的 test-only 链路。

### Phase 2.7: 静态检查体系重写

- [x] 删除不再适配 Phase 2 新结构的静态检查脚本；剩余检查必须重新审计职责和边界。
- [x] 以 Phase 2 的正式目录、模型和调用链为准重写前端架构检查，禁止旧 API、旧全局应用数据包、组件直连 query、组件直连 resource、组件内临时缓存和绕过 ViewModel 的复杂页面编排。
- [x] 以 Phase 2 的 Rust session/query/write/cache/model 分层为准重写后端架构检查，禁止 command 直接业务、query 写盘、write 读完整项目、cache 预读整套 core 和跨层调用。
- [x] 静态检查必须以目录角色、导入方向、类型形状和正式入口为依据；不允许业务名单、临时例外、兼容放行或为了减少误伤而放宽边界。
- [x] 静态检查自检也必须按新规则重写，继续禁止名单式边界漂移，并允许必要的单文件语义检查。
- [x] 新静态检查必须覆盖 shared/api、services、orchestrators、view-model、stores、windows、Rust commands/services/domain/io/parsers/models 的长期边界。

### Phase 2.8: 模块文档体系重写

- [x] 按 Phase 2 新架构重写 `.trae/module-map.md`，模块索引必须反映 session/query/write/cache/view-model 的正式结构。
- [x] 重写 ProjectSession、CSV tables、config、resource/core fallback、file history、workspace、editor、schema 等受影响模块文档。
- [x] 模块文档只记录长期定义、边界、规范和正式链路；不得记录迁移过程、临时理由、阶段过程或实现细枝末节。
- [x] 删除仍围绕旧完整项目读取、旧全局应用数据包、旧表格 service、旧任务读取和旧配置 API 语义的文档表述。
- [x] overview / frontend-guidelines / backend-guidelines 只保留总边界；具体链路和模块规则必须落到 `.trae/modules/`。
- [x] 文档重写后必须能从 module map 追踪到每条正式读链路、写链路、cache invalidation 链路和 UI ViewModel 链路。

### Phase 2.9: 顶层文档与完成状态收口

- [x] 修整 `.trae/frontend-guidelines.md`，只保留 Phase 2 新前端架构的长期总边界、层级职责、入口规则和验证目标。
- [x] 修整 `.trae/backend-guidelines.md`，只保留 Phase 2 新后端架构的长期总边界、层级职责、command/service/domain/io/parser 规则和验证目标。
- [x] 修整 `.trae/overview.md`，只保留当前项目状态、正式架构方向和必要总览，不写模块细节。
- [x] 清理 frontend/backend guide 与 overview 中应归属模块文档的细节；模块文档已覆盖的内容不得重复堆在顶层文档。
- [x] 根据 Phase 2.1 到 2.8 的实际完成状态勾选 todo；只勾已实现、已验证、文档已同步的条目。
- [x] 跑文档格式、编码检查和前后端必要验证，确保完成状态不是仅靠文字判断。

## Phase 3: 架构一致性、API 语义与命名收束

### Phase 3.1: 调用链一致性审计

- [x] 审计前端从组件、ViewModel、service、shared/api 到 Rust command/service 的完整调用链，确认读链路、写链路、资源链路和缓存失效链路都遵守同一套入口和返回模型。
- [x] 审计 Rust project service、config service、file history、editor spec、asset 上传等后端链路，确认 command 只进入 service，service 再进入 query/write/cache/io/parser 的正式边界。
- [x] 标记仍然存在的跨层调用、重复编排、组件内临时拼装、service 兼容旧语义和 orchestrator 过度承载问题；不得用静态检查放行代替结构修复。

### Phase 3.2: API 分组与命名统一

- [x] 审计 `shared/api` 的文件名、函数名和 payload/result 类型，确认命名表达 wire 边界而不是旧功能碎片。
- [x] 审计前端 service 的公开函数名，确认只表达业务能力，不混入 history 细节、临时迁移语义或重复后缀。
- [x] 审计 Rust service 的公开函数名，确认 command-facing、query、write、cache、root、session 的命名边界清晰一致。
- [x] 清理仍然带有旧 `load`、旧完整数据包、旧 config-api、旧 mission load、旧 project tables 或含义不明的 API / service / helper 命名。

### Phase 3.3: 文件职责与拆分粒度收束

- [x] 审计职责过重文件，判断是否需要拆分；拆分必须基于稳定边界，不得按文件大小拆。
- [x] 审计拆分过细文件，合并只能靠上下文共同理解、没有独立职责、只包装单个同层函数的碎片文件。
- [x] 审计 ViewModel、service、orchestrator、store、domain、shared/api 的职责重叠，去掉重复模型、重复缓存、重复资源补图和重复保存结果适配。

### Phase 3.4: 模型统一与数据形状收束

- [x] 审计 query result、write result、entity data、source option、ResourceRef、CSV row patch、cache key 等核心模型，确认同类数据只有一种正式形状。
- [x] 清理前端和后端各自重复构造的同形结构；跨窗口配置、session 上下文、资源引用和写入结果必须由正式链路传递。
- [x] 审计字段转换和 UI 派生模型，确认转换位置固定在 service / ViewModel / domain 中，不在组件和 store 中散落。

### Phase 3.5: 回归与文档同步

- [x] 修复完成后更新 module map 和相关模块文档，只记录长期边界、正式链路和命名规则。
- [x] 更新 frontend / backend guide 中仍过宽、过旧或与新调用链不一致的总边界描述；细节归模块文档。
- [x] 跑前端格式、类型、lint、编码检查和 Rust test、fmt、clippy；只在验证通过后勾选本 Phase。

## Phase 4: 加载改善性能验收与回归

- [ ] `Kratogen_TA` 打开 Mod 目标小于 1 秒。
- [ ] `ProjectManifest` 体积必须显著低于历史约 42MB。
- [ ] 切换宽表目标小于 50ms；点击行、激活编辑和滚动跳变接近无感。
- [ ] descriptions.csv 不再在打开 Mod 时阻塞首屏；进入描述文本表时解析或 query 成本必须可定位。
- [ ] 验收纯文本和增强控件两种编辑模式下 CSV Grid 视觉不偏移、不闪烁、不丢编辑值。
- [ ] 验收原版引用、缩略图 fallback、皮肤 hull 引用、联队预览、schema 下拉、保存、file history replay、贴图上传和关闭工作区语义不变。
- [ ] 清空 log 后用 `D:\Starsector\mods\Kratogen_TA` 记录打开 Mod、切换宽表、source query、resource batch query 和 CSV grid model 的 PERF 日志。
- [ ] 跑前端格式、类型、lint、编码检查和 Rust test、fmt、clippy。

## Phase 5: 外置文本 JSON 支持

- [ ] 读取 `data/strings/strings.json`，缺文件时返回空列表。
- [ ] 新增外置文本模块入口，列表展示文件，详情使用基础文本编辑器或现有 JSON 文本编辑能力，不新增专用复杂编辑器。
- [ ] 保存走通用文件保存和文件级 history；undo/redo 后刷新对应文件内容。
- [ ] 验收新增、编辑、保存、撤销重做和解析错误定位行为。

## Phase 6: CSV Schema 覆盖审计

- [ ] 检查所有项目内已接入 CSV 的每个字段是否都有对应列 schema；缺失字段必须补齐 schema 或明确记录为只能文本编辑的字段。
- [ ] 检查所有 CSV 列 schema 字段是否都有中文名和字段解释；缺失时必须补齐。
- [ ] 手动逐字段核对中文名和字段解释，确认译名、语义、引用关系和编辑控件都符合实际用途。
- [ ] 审计结果必须能定位到具体 CSV、具体字段和具体 schema 文件；不得只给总量统计。

## Phase 7: 组件动画与阻塞加载界面

- [ ] 补足适当的组件动画，覆盖展开、收起、切换和局部显隐等高频交互；动画速度必须快，不拖慢操作反馈。
- [ ] 优先复用 Naive UI 自带动画和现有组件能力；需要补充时优先只改组件封装或 CSS，不改变业务链路。
- [ ] 等待界面只用于工作区加载、完整 Mod 读取这类耗时且 blocker 级别的流程；普通局部刷新、表格切换和轻量保存不得弹出全局等待界面。
- [ ] 加载界面必须明确当前阻塞对象和状态，不遮挡可继续操作的非阻塞区域。
- [ ] 验收动画不会造成布局跳动、文字重叠、滚动错位或视觉风格偏移。

## Phase 8: 自动数据校验和警示

### Phase 8.1: 诊断模型与统一入口

- [ ] 建立统一诊断模型，至少包含 severity、source kind、entity id、field/path、message 和可定位目标；诊断只描述问题，不负责写盘。
- [ ] 建立统一校验入口，通过 session query、CSV 草稿状态、schema 资产和资源索引后产出诊断；不得让组件、store 或保存函数各自散落校验逻辑。
- [ ] 明确 severity 行为：warning 默认允许保存；error 只用于确定会破坏写入边界、解析边界或唯一 ID 边界的问题；是否阻止保存由统一策略决定。

### Phase 8.2: CSV 表格校验

- [ ] CSV 列校验适用范围固定为已注册主表格：`ships`、`weapons`、`wings`、`hullmods`、`shipSystems`、`industries`、`skills`、`abilities`、`commodities`、`specialItems`、`submarkets`、`marketConditions`、`simOpponents`。
- [ ] CSV 列校验只依据 `schemas/csv/*.columns.json` 和当前表 header；未被列 schema 覆盖的列不做类型校验，只保留通用空值/显示能力。
- [ ] CSV 数值列校验：`control: number` 的非空值必须能解析为有限数值，并校验 schema 中的 min、max 和 step。
- [ ] CSV 布尔列校验：`control: boolean` 的非空值必须是当前项目允许的布尔文本。
- [ ] CSV 枚举列校验：`control: enum` 的非空值必须在 schema options 中。
- [ ] CSV 引用列校验：`control: reference` 的非空值必须能在当前 Mod 或原版引用源中解析；`#` 开头行不得作为合法引用；当前 Mod 覆盖原版重复 ID 的规则保持不变。
- [ ] CSV tag / multi 列校验：按逗号拆分后检查空项、重复项和 source 引用合法性；无 source 的 tag 只做格式级检查。
- [ ] CSV path-image / color 列校验：图片路径非空时检查资源索引可解析；颜色列按既定格式检查，未定义格式前只做非阻塞 warning。
- [ ] CSV 行级校验：业务 ID 为空、重复 ID、`#` 开头禁用行被其它字段引用、关联 spec 候选路径冲突时给出诊断。

### Phase 8.3: Spec 与配置实体校验

- [ ] 非 CSV 校验适用范围包括 `.ship`、`.wpn`、`.proj`、`.variant`、`.skin`、Faction `.faction`、Mission descriptor/mission_text 和贴图资源；不覆盖 Java、rules.csv、本地化文件和社区库文件，后续阶段另行接入。
- [ ] `.ship` 校验：中心、护盾中心、护盾半径、碰撞半径、武器槽、甲板、引擎、边界点等坐标字段应为整数；缺失关键中心/护盾字段给出诊断。
- [ ] `.ship` 几何校验：`collisionRadius` 小于 `shieldRadius`、碰撞半径未覆盖武器槽、甲板、引擎、边界点或护盾圆时给出诊断。
- [ ] `.ship` 引用校验：内置武器、内置联队、内置插件、战术系统、装配和皮肤相关 hull 引用必须走当前 Mod + 原版引用源；`skinHullId` 必须被视作合法 hull 引用。
- [ ] `.wpn` 校验：炮口/barrel offset 缺失、炮口坐标含小数、当前视图贴图路径缺失、武器 CSV 行与 `.wpn` 关键引用不一致时给出诊断。
- [ ] `.proj` 校验：弹体贴图路径、碰撞/尺寸/速度等确定数值字段、武器引用弹体缺失或弹体文件孤立时给出诊断。
- [ ] `.variant` 校验：`variantId`、`hullId`、武器槽位引用、武器 ID、插件 ID、联队 ID、模块/内置装配引用必须可解析；重复或缺必填字段沿用读取阶段 error 语义。
- [ ] `.skin` 校验：`skinHullId`、`baseHullId`、内置武器、内置联队、内置插件、战术系统、slot change 和 engine change 引用必须可解析；`skinHullId` 参与所有 hull 引用解析。
- [ ] Faction / Mission 校验：CSV index 与额外文件或目录之间的 ID、路径和必填字段必须一致；Mission 改名后 descriptor、mission_text 和目录资源必须保持可定位。

### Phase 8.4: 资源诊断

- [ ] 贴图资源校验：被 spec、CSV 或 schema 引用的 PNG 资源缺失时给出诊断；贴图宽度或高度为奇数时给出 warning；hardpoint 武器贴图高度不为 4 的倍数时给出 warning。
- [ ] 贴图资源校验不扫描未被引用的所有图片作为首期必做项；如需要全资源扫描，作为后续性能可控的独立扩展。

### Phase 8.5: 诊断展示与同步

- [ ] 设计诊断展示位置：表格行/单元格标记、右侧字段速览提示、配置 schema 字段提示、舰船/武器/弹体编辑器字段提示、资源预览提示、保存前汇总和工作区级汇总。
- [ ] CSV 展示与交互：诊断必须能映射到具体表、行和列；右侧字段速览显示当前行诊断；保存 CSV 前汇总本表诊断。
- [ ] 文件历史 replay 和保存后同步必须刷新受影响实体的诊断结果；二进制贴图变化只刷新资源相关诊断，不尝试解析为文本。

### Phase 8.6: 校验覆盖检查

- [ ] 补最小测试或静态检查：CSV schema 控件类型对应校验器、引用源过滤 `#` 行、hull 引用包含 skin、典型 `.ship/.wpn/.variant/.skin` 异常、贴图尺寸异常和保存前汇总。

## Phase 9: 定义右键行为

### Phase 9.1: 表格与详情右键

- [ ] 定义主表格行、单元格和右侧详情区的右键菜单范围。
- [ ] 覆盖复制 ID、打开可用编辑器、删除记录、定位资源和复制字段值等常用动作。
- [ ] 右键菜单必须复用现有确认、保存边界和文件历史链路，不新增绕过路径。

### Phase 9.2: 配置页右键

- [ ] 定义配置列表和 schema 字段的右键行为，覆盖复制 ID、复制字段、删除、定位文件等动作。
- [ ] Faction、Mission、Variant、Skin 的删除和定位动作必须沿用现有配置保存与文件历史链路。

### Phase 9.3: 编辑器画布右键

- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 右键菜单不得破坏画布右键拖动平移体验。

### Phase 9.4: 右键行为验收

- [ ] 为表格、配置页和编辑器右键菜单补手动验收清单。
- [ ] 验收输入框、文本域和弹窗内右键行为不会被业务菜单误拦截。

## Phase 10: 重新梳理主界面快捷键

### Phase 10.1: 主窗口导航快捷键

- [ ] 定义搜索、模块切换、记录选择、多 Mod 导航、总览页和设置页之间的快捷键范围。
- [ ] 快捷键必须按当前视图和焦点状态生效，避免跨页面误触。

### Phase 10.2: 主窗口编辑快捷键

- [ ] 统一保存、新建、删除、撤销、重做和关闭工作区等通用行为。
- [ ] 快捷键必须接入现有 CSV 草稿历史、文件级 history、配置保存和确认链路。

### Phase 10.3: 输入焦点与提示

- [ ] 避免快捷键和输入框、文本域、schema 控件、CSV 单元格编辑器、文件编辑器和系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 11: 高级配置

### Phase 11.1: 游戏全局设置

- [ ] 添加 `data/config/settings.json` 编辑支持。
- [ ] 提供按战斗、生涯、市场、UI 等大类浏览的 schema 表单。
- [ ] Schema 覆盖已知设置项；未知字段保留到额外字段区。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 11.2: 战斗目标配置

- [ ] 添加 `data/config/battle_objectives.json` 编辑支持。
- [ ] 使用 schema 表单编辑目标定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 11.3: 引擎样式配置

- [ ] 添加 `data/config/engine_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；颜色、数值和贴图字段使用已有控件能力。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 11.4: 舰体样式配置

- [ ] 添加 `data/config/hull_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 11.5: 声音配置

- [ ] 添加 `data/config/sounds.json` 编辑支持。
- [ ] 使用 schema 表单编辑声音定义；路径字段保持文本或既有路径控件。
- [ ] 保存走配置保存和文件级 history 链路。

## Phase 13: 禁止项：可视化逻辑编辑器（蓝图系统）

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

## Phase 14: 禁止项：社区库数据文件集成（MagicLib / GraphicsLib / LazyLib）

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

## Phase 15: 最终硬化、回归与整理

- [ ] 统一回查前后端模块边界、命名一致性、状态链路和保存语义。
- [ ] 清理临时兼容层和死代码。
- [ ] 重新审视 store、service、component、composable 和 shared API 是否再次出现职责漂移。
- [ ] 更新 `.trae/module-map.md`、`.trae/modules/`、`.trae/frontend-guidelines.md`、`.trae/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向。
