# Todo

## Phase 1: 架构收敛——正确性与权威统一

> 目标：消灭正确性实伤与无 owner 旁路，让声明的分层矩阵、wire 协议、错误语义、文档与配置和真实实现完全一致。每个子阶段完成后必须按事后要求同步受影响的 overview、guideline、module map 或模块契约。

### Phase 1.1: CSV row_key 正确性修复

- [x] `src-tauri/src/services/project/write/csv_patch.rs` 新增行键分配改为与既有键和删除历史无关的单调递增分配器，消灭"先删后增时 `rows.len()` 生成重复 row_key"缺陷；`key_map` 的 previous→next 映射保持唯一。
- [x] 补测试：删后增、删后改、乱序 patch 序列、整表删除后重建；`parsers/alex_csv.rs` 补 parse→render→parse 往返恒等属性测试。
- [x] 跑 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。

### Phase 1.2: Rust 分层规则修复与违规边归位

Owner 原则：声明的依赖矩阵必须对真实代码生效；每条跨层边要么结构归位、要么显式授权，禁止改矩阵迁就现状。

- [x] `scripts/architecture/shared/rust-crate-paths.mjs` 支持 `super::`/`self::` 相对导入到 crate 绝对路径的确定性静态解析，`rust-project-layer-boundary` 矩阵对 project 内部相对导入真实生效。
- [x] 规则修复后暴露的违规边逐边按真实 owner 归位：root↔cache 双向、session→resources、cache→root 的 factions/table_definitions 依赖，优先结构重排或公共下沉；确属长期授权的边写入矩阵与对应模块文档。
- [x] 后端 service 横向依赖建立显式授权表（对齐前端 `allowedServiceEdges` 模式）并入静态规则；`editor_config→file_changes`、`mod_creation→directory_opening`、`directory_opening→app_log/app_paths/project` 等实存边逐一立约或消灭。
- [x] `app_log`↔`app_settings` 解环：日志目录校验所需能力收口单一 owner，settings 校验不再读取 workspace 持久化内容。
- [x] 跑 `node scripts/check-architecture.mjs`、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。

### Phase 1.3: wire 协议与错误通道收敛

- [x] `AppError` 增加稳定语义码与结构化参数：Rust 侧不再承载用户可见文案，错误消息全部改为稳定码 + 上下文参数；前端建立唯一的码→中文文案映射层（落点按 shared/domain 职责定形），wire 契约变化前后端同步。
- [x] `detect_directory`/`scan_game_overview` 并入统一错误通道：探测结果显式建模为类型化 outcome（区分"未识别"与"探测出错"），不再折进 warnings 字段；`OpenDirectoryResult` 契约同步。
- [x] 删除无生产者的 `WriteResult.warnings` wire 字段（含 `csv_patch.rs` 恒真 `debug_assert` 与对应 wire 形状测试）。
- [x] `read_mod_info` 缺文件不再伪造默认对象：显式建模"无 mod_info"状态并贯穿 manifest 与界面呈现，与游戏概览扫描"缺少 mod_info.json，已跳过"的语义一致。
- [x] 跑前端全套检查与 cargo 全套。

### Phase 1.4: 静默失败与诊断收敛

- [x] 三处持久化静默吞错接 `app_log`：`session.rs` 项目索引落盘、`cache/core.rs` 核心缓存落盘、`session_opening.rs` 缓存目录 configure；`resources/refs.rs` 四处 `eprintln!` poison 诊断收敛到统一设施。
- [x] 注册表锁获取封装统一（poison→错误映射不再逐处复制）；`session.rs` 关闭与驱逐两处相反的锁获取顺序统一或补锁序注释。
- [x] session 归属校验统一下沉：全部携带 `sessionId + modRoot` 的命令强制经单一校验入口（`SessionModScope` trait 全覆盖或 service 层统一守卫），删除 `tables.rs`、`file_changes.rs`、`assets.rs`、`file_editor.rs` 的手调散布。
- [x] `io/file_changes.rs` 文本快照仅对 UTF-8 语义错误降级二进制路径，权限/IO 错误显式报错。
- [x] 跑 cargo 全套。

### Phase 1.5: 前端错误反馈补全与链路宣称对齐

- [x] `use-csv-table-view-model.ts` 表格窗口加载、reload、来源选项加载补 catch + feedback，对齐 Config 系列错误反馈模式；全前端异步链路复核无裸 rejection（无全局兜底是既定事实）。
- [x] recovery 文件编辑器写为显式特例：`file-editor` 模块文档立约"无 session 保存不入文件历史、不触发 session refresh"的边界与适用场景，代码侧显式表达；不实现新链路。
- [x] `.zcode/overview.md` 链路描述与现实对齐：实体读取不返回 manifest（manifest 归目录打开链路）；撤销重做补强制确认框与多会话刷新；资源链路改为现实（无上传入口，文件选择限于 Mod 内；前端 query/resource/media 三级缓存 + 后端 media cache）；窗口同步补全局广播 + 消费端过滤模型、窗口身份拼装与 draftSnapshot/URL 两条降级路径；删除"上传进入二进制 changeset 与缓存失效"宣称。
- [x] 跑前端全套检查、`node scripts/check-architecture.mjs`、`format:check`、`encoding:check`。

### Phase 1.6: 文档失实修正与验证口径统一

- [x] 修正模块文档失实：`main-history-command.md` 删除已不存在的 `save-command-registry.ts` 引用与迁移措辞；`ship-editor.md` 修正 `normalize.ts` 幽灵路径与视觉绘制职责矛盾；`about-page.md` 修正入口组件（TitleBar）与 CHANGELOG 内联载体（AboutPage `?raw`）；`terminology.md` 预览倍速改为 0.5–5.0 步进 0.1 滑杆现实。
- [x] `backend-guidelines.md` 与 `overview.md` 的 services 枚举补齐 `mod_creation`、`schema`、`system_open`、`app_paths`，两份措辞统一为一份清单。
- [x] `README.md` 与 `CONTRIBUTING.md` 验证清单与 `workflow.md` 对齐：补 `npm.cmd run test`，完整集合口径全仓唯一。
- [x] `README.md` 构建节点明 `beforeBuildCommand` 与 `npm run build` 的链路关系。
- [x] 跑 `format:check`、`encoding:check`、`node scripts/check-architecture.mjs`、`git diff --check`。

### Phase 1.7: 工程配置矛盾收敛

- [x] `src-tauri/gen/schemas` 四个生成物退出 git 跟踪并入 `.gitignore`（eslint/prettier/encoding/architecture 四方均已按生成物对待）；`.gitignore` 补 `release/`。
- [x] `tauri.conf.json` bundle 段与"只发布单文件 exe"策略收敛（`active: false` 或等价表达），README 发布说明同步。
- [x] 新增 `rust-toolchain.toml` 钉当前 stable 工具链、新增 `.nvmrc` 钉 Node 24；`@types/node` 对齐 Node 24 版本线。
- [x] build.bat 与 build.ps1 维持各自完整实现。
- [x] 本地跑与 CI 等价的全套检查。

## Phase 2: 架构收敛——写法统一、残留清理与性能

> 目标：消灭迁移残留与同域多套写法，巨型文件按既有先例拆解归位，缓存与热路径收敛。每类问题取最干净形态，不保留兼容壳；每个子阶段完成后必须按事后要求同步受影响契约文档。

### Phase 2.1: 前端迁移残留清理

- [x] 窗口宿主四件套目录迁移经架构检查裁定为不迁移：宿主组件深度消费 app 组合层（composables/editors/stores），`windows/` 层规则正确禁止该方向依赖——`windows/` 只承载窗口机制，宿主留在 `app/` 是正确的层次归属。
- [x] `use-history.ts` 双栈删除，画布历史经新增适配器 `use-canvas-history.ts`（draft-session-boundary 白名单已收录）迁移 `domain/edit-session.ts` 撤销原语，limit 250/清理语义与原实现一致。
- [x] 默认 spec 模板归位 domain：`defaultShip`/`defaultWeapon` 迁出 `shared/lib/starsector.ts`，`editor-definitions.ts` 成为四类编辑器默认数据的唯一来源。
- [x] 三个编辑器内联 JSON textarea（ShipEditor builtInWeapons、ProjectileEditor genericJson、SystemEditor droneBehavior）迁移 `ObjectEditor` 组件化路径（`parse` prop 保留 Projectile 的 normalize 语义；模型放宽为任意 JSON 值）；无效 JSON 反馈统一为 warning + 保留输入的提交边界单一模式。
- [x] JsonValue→string 三实现收敛 `cell()` 唯一（`configStringValue`、`stringValue` 私有副本删除）。
- [x] 跑前端全套检查。

### Phase 2.2: shared/lib/starsector.ts 按职责拆分

- [x] 拆分落点为 `shared/lib/starsector/` 子目录（`tables.ts` 表列资产与列解析、`colors.ts` 视觉常量、`value.ts` 值取用与格式化原语、`rows.ts` 行身份规则、`index.ts` barrel——默认模板已随 2.1 归位 domain，不在本拆分内），消费方经 barrel 导入零改动；`str`/`num`/`arr` 复核结论：保留原名（与 `cell()` 同族的单元格取值原语，非占位缩写）。
- [x] `WEAPON_COLORS` 颜色字面量统一为 `rgb()` 现代语法（LAUNCH_BAY/DECORATIVE/SYSTEM 三个 hex 完成 hex→rgb 换算）。
- [x] 跑前端全套检查。

### Phase 2.3: 巨型组件拆解

- [x] `ShipEditor.vue`（1431→1348 行）：几何函数（roundDegree/normalizeDegree/clampArc/angleDelta/distance/pointAngle/pointArc/distanceToSegment）下沉 `domain/editors/lib/geometry.ts`；三对预览态/落盘态默认对象合并为 `ship-slots.ts` 单一工厂（weaponSlotWithDefaults/launchBayWithDefaults/engineWithDefaults）；ID 格式与扫描规则下沉（formatWeaponSlotId/formatLaunchBayId/nextFormattedId），组件内 next* 改为读槽位集合的薄壳；WeaponEditor 重复 `pointAngle` 删除，改用 domain `pointAngleScreen`。
- [x] `SchemaFieldRenderer.vue`（821→798 行）：9 处装饰性分隔注释删除；模板中复述 `v-else-if` 条件的类型标签注释删除；`.n-base-selection` 私有类名 closest 判定改为 `composedPath` 元素类名单判定（仍依赖 Naive UI 公开类名，行为语义不变：tag 关闭钮/清除钮点击不关闭下拉）。plain/rich 双模板树经通读裁定保留：两分支的控件类型与事件形状逐类型不同（plain 全文本输入 + 字符串化 emitter，rich 类型化控件），强行映射合并不等价、可读性反降。
- [x] `SystemEditor.vue`（497→411 行）：`SYSTEM_STRUCTURED_FIELD_KEYS`/`TYPE_EXCLUSIVE_FIELDS` 收敛 `domain/editors/lib/system-fields.ts` 常量模块。
- [x] 跑前端全套检查；手工验收舰船/武器画布、弹体与战术系统表单回归。

### Phase 2.4: 状态 owner 与查询收敛

- [ ] "当前 Mod 身份"四 store（workspace/project/tables/file-history）合并为单一事实源，其余派生；关闭/切换/失败回滚清理序列随之收敛。
- [ ] 未保存查询统一走 `draft-sessions` 注册表：`LoadedModsPanel.vue` 弃 `tables.hasModDirtyChanges` 直查。
- [ ] 删除死状态与死导出：`project.store` 的 `loading`/`setLoading`/`isOpen`、`workspace.store` 的 `gameWorkspace`、`RuntimeCache.touch`、`use-config-mission-editor-view-model` 的 `indexHeader`、`WeaponEditor.vue` 的 `projectiles` prop 及父级传参。
- [ ] `use-core-schema`/`use-core-graphics` 合并为参数化 core 资产加载器，全局单例载体统一 Pinia。
- [ ] `DetailPane`/`TableWorkspace`/`ModTabsBar` 过路 emit 收敛（中间层直接接 composable，AppContent 只留装配）；组件状态消费统一为 view-model 单一路径，faction/mission 族对齐 family 组件模式。
- [ ] 跑前端全套检查。

### Phase 2.5: 前端写法统一

- [ ] Mod 状态文案单一实现并 domain 化（页签栏与总览面板共用）；保存处理器注册时机统一为单模式；naive-ui 组件接线规则成文（全局异步注册与直接 import 的边界）并统一。
- [ ] service 层 `.then()` 链统一 async/await；`JSON.stringify` watch 源与缓存键改为显式稳定语义；冗余 `deep` watch、事件闭包内 `ref`、无谓 `async`、死防御清理。
- [ ] `file-history.store` 与 `file-history-write.orchestrator` 双重校验单一化；mission 选中归一化去重；CsvGrid 静态/编辑两态共享 cell reference composable；竞态守卫（requestId/身份比对）抽公共原语；确认弹窗 + checkbox 收敛为 feedback 扩展原语。
- [ ] `app/composables/` 42 文件按域细分子目录（config 系、editor 系、window 系、canvas 系、tables 系各自归拢），消费方 import 路径同步。
- [ ] domain 预期错误迁 `AppError`（值语义裸 Error 除外，对齐 error-boundary 规则）；`as unknown as` 类型逃逸以输入校验替代。
- [ ] CSS 间距 token 体系裁决（扩充 `--space` 体系或归一既有取值）后全量对齐；画布颜色收口 domain 调色板常量；URL 草稿快照解析失败补可观察行为。
- [ ] 跑前端全套检查。

### Phase 2.6: Rust 写法统一

- [ ] 定义注册表族归拢 `services/project/definitions/` 子目录（`entity_definitions`、`table_definitions`、`entity_resources`、`factions`、`projectiles`），`rust-project-layer-boundary` 的 root 层路径分类同步；与 Phase 2.3 触碰定义注册表的改动同批执行。
- [ ] 未使用参数统一 `_` 前缀惯例（`entity_definitions.rs` 函数体丢弃式改写）；`push_unique_all` 双实现上收 models 唯一实现；MISSION_LIST 默认表头函数化；`refresh_variant`/`refresh_skin` 镜像合并（warnings 合并态唯一 owner）；符号链接测试助手收敛 `testutil`（7 份→1）；`SessionModScope` 手写 impl 收敛；changeset 落盘三入口统一单一通道；`hull_references` 四段同构分组构建提取；`_source` 注入两实现合一。
- [ ] 查询结果中的 UI 分组文案（"当前 Mod/原版/蓝图"标签与描述）迁出 Rust：wire 携带结构化来源语义，文案归前端呈现（与 Phase 1.3 错误码方向一致）。
- [ ] variant/skin 删除载荷字段名统一为单一实体 id 字段（`variant_id`/`skin_hull_id` 合一，wire 前后端同步）。
- [ ] 跑 cargo 全套。

### Phase 2.7: 缓存与热路径性能收敛

- [ ] `CoreCache` 命中路径 `Arc` 化消灭全量深拷贝；六个 `load_core_*` 泛型 `get_or_load` 收敛；冷加载的全量持久化落盘合并为一次性 flush 并移出 query 持锁路径。
- [ ] `csv_patch.rs` 写路径双轮整表拷贝收敛；`entity_definitions.rs` list 函数先收集克隆再二次遍历收敛为单遍；`io/file_changes.rs` 目录快照单次采集。
- [ ] `sprites.rs` 测试专用旧批量加载器迁入测试模块或删除。
- [ ] 跑 cargo 全套；`performance-baseline` 模块文档同步。

### Phase 2.8: scripts 检查体系收敛

- [ ] `normalize`×4、`rustCommandModule`×4、`splitTopLevel`×2、`ignoredDirs`×3 收敛到共享层；`scripts/architecture/shared` 归位 `scripts/shared`（收集器与入口脚本同层共享）。
- [ ] 文件收集器三套实现合一，static-checks"共享收集"契约扩展覆盖入口脚本；两条元规则（self-boundary、no-name-existence-checks）入规则注册表或契约显式例外成文；规则 surface 判定范式（classify/startsWith/singleFileByRel）成文。
- [ ] `scripts/*.mjs` 纳入类型检查（checkJs 或迁移 .ts）。
- [ ] 跑 `lint` 全套（eslint + check-architecture + check-identifier-length）。

### Phase 2.9: schema 资产与静态数据整理

- [ ] CSV 列 schema 版本头统一（14 份补齐或全仓统一为一套契约）；null 冗余键清理为精简形态（与既有精简风格归一）；CSV schema 文件命名依据统一（`hullmods` 游戏原名与 `shipSystems` 自造名裁决）。
- [ ] `source_options.rs` 约 850 行 `WELL_KNOWN_TAG_LABELS`/`WELL_KNOWN_HINT_LABELS` 静态标签数据外置 `schemas/` 资产，经唯一加载入口消费，`source_options.rs` 回归逻辑文件。
- [ ] 跑前端全套检查、`node scripts/check-architecture.mjs`。

### Phase 2.10: noUncheckedIndexedAccess 消化启用

- [ ] `tsconfig.json` 启用 `noUncheckedIndexedAccess`，实测 108 处错误按文件分批消化（ShipEditor 30、settings.store 16、resource-cache 9 等）。
- [ ] 跑前端全套检查。

### Phase 2.11: 收尾复核与文档同步

- [ ] 受影响契约文档终审：overview、guidelines、module map、模块文档与新实现逐条对齐，文档不记录实现过程与临时状态。
- [ ] 跑前后端全套检查（前端：format:check、encoding:check、lint、typecheck、test、build；Rust：cargo fmt --check、clippy、test）；汇总手工验收清单（画布、表格、快捷键、窗口、保存链路、错误反馈）。
- [ ] 复查工作树、暂存区、换行、编码与无关用户修改的保留状态。

## Phase 3: 外置文本 JSON 支持

- [ ] 读取 `data/strings/strings.json`，缺文件时返回空列表。
- [ ] 新增外置文本模块入口，列表展示文件，详情使用基础文本编辑器或现有 JSON 文本编辑能力，不新增专用复杂编辑器。
- [ ] 保存走通用文件保存和文件级 history；undo/redo 后刷新对应文件内容。
- [ ] 验收新增、编辑、保存、撤销重做和解析错误定位行为。

## Phase 4: CSV Schema 覆盖审计

- [ ] 检查所有项目内已接入 CSV 的每个字段是否都有对应列 schema；缺失字段必须补齐 schema 或明确记录为只能文本编辑的字段。
- [ ] 检查所有 CSV 列 schema 字段是否都有中文名和字段解释；缺失时必须补齐。
- [ ] 手动逐字段核对中文名和字段解释，确认译名、语义、引用关系和编辑控件都符合实际用途。
- [ ] 审计结果必须能定位到具体 CSV、具体字段和具体 schema 文件；不得只给总量统计。

## Phase 5: 组件动画与阻塞加载界面

- [ ] 补足适当的组件动画，覆盖展开、收起、切换和局部显隐等高频交互；动画速度必须快，不拖慢操作反馈。
- [ ] 优先复用 Naive UI 自带动画和现有组件能力；需要补充时优先只改组件封装或 CSS，不改变业务链路。
- [ ] 等待界面只用于工作区加载、完整 Mod 读取这类耗时且 blocker 级别的流程；普通局部刷新、表格切换和轻量保存不得弹出全局等待界面。
- [ ] 加载界面必须明确当前阻塞对象和状态，不遮挡可继续操作的非阻塞区域。
- [ ] 验收动画不会造成布局跳动、文字重叠、滚动错位或视觉风格偏移。

## Phase 6: 自动数据校验和警示

### Phase 6.1: 诊断模型与统一入口

- [ ] 建立统一诊断模型，至少包含 severity、source kind、entity id、field/path、message 和可定位目标；诊断只描述问题，不负责写盘。
- [ ] 建立统一校验入口，通过 session query、CSV 草稿状态、schema 资产和资源索引后产出诊断；不得让组件、store 或保存函数各自散落校验逻辑。
- [ ] 明确 severity 行为：warning 默认允许保存；error 只用于确定会破坏写入边界、解析边界或唯一 ID 边界的问题；是否阻止保存由统一策略决定。

### Phase 6.2: CSV 表格校验

- [ ] CSV 列校验适用范围固定为已注册主表格：`ships`、`weapons`、`wings`、`hullmods`、`shipSystems`、`industries`、`skills`、`abilities`、`commodities`、`specialItems`、`submarkets`、`marketConditions`、`simOpponents`。
- [ ] CSV 列校验只依据 `schemas/csv/*.columns.json` 和当前表 header；未被列 schema 覆盖的列不做类型校验，只保留通用空值/显示能力。
- [ ] CSV 数值列校验：`control: number` 的非空值必须能解析为有限数值，并校验 schema 中的 min、max 和 step。
- [ ] CSV 布尔列校验：`control: boolean` 的非空值必须是当前项目允许的布尔文本。
- [ ] CSV 枚举列校验：`control: enum` 的非空值必须在 schema options 中。
- [ ] CSV 引用列校验：`control: reference` 的非空值必须能在当前 Mod 或原版引用源中解析；`#` 开头行不得作为合法引用；当前 Mod 覆盖原版重复 ID 的规则保持不变。
- [ ] CSV tag / multi 列校验：按逗号拆分后检查空项、重复项和 source 引用合法性；无 source 的 tag 只做格式级检查。
- [ ] CSV path-image / color 列校验：图片路径非空时检查资源索引可解析；颜色列按既定格式检查，未定义格式前只做非阻塞 warning。
- [ ] CSV 行级校验：业务 ID 为空、重复 ID、`#` 开头禁用行被其它字段引用、关联 spec 候选路径冲突时给出诊断。

### Phase 6.3: Spec 与配置实体校验

- [ ] 非 CSV 校验适用范围包括 `.ship`、`.wpn`、`.proj`、`.variant`、`.skin`、Faction `.faction`、Mission descriptor/mission_text 和贴图资源；不覆盖 Java、rules.csv、本地化文件和社区库文件，后续阶段另行接入。
- [ ] `.ship` 校验：中心、护盾中心、护盾半径、碰撞半径、武器槽、甲板、引擎、边界点等坐标字段应为整数；缺失关键中心/护盾字段给出诊断。
- [ ] `.ship` 几何校验：`collisionRadius` 小于 `shieldRadius`、碰撞半径未覆盖武器槽、甲板、引擎、边界点或护盾圆时给出诊断。
- [ ] `.ship` 引用校验：内置武器、内置联队、内置插件、战术系统、装配和皮肤相关 hull 引用必须走当前 Mod + 原版引用源；`skinHullId` 必须被视作合法 hull 引用。
- [ ] `.wpn` 校验：炮口/barrel offset 缺失、炮口坐标含小数、当前视图贴图路径缺失、武器 CSV 行与 `.wpn` 关键引用不一致时给出诊断。
- [ ] `.proj` 校验：弹体贴图路径、碰撞/尺寸/速度等确定数值字段、武器引用弹体缺失或弹体文件孤立时给出诊断。
- [ ] `.variant` 校验：`variantId`、`hullId`、武器槽位引用、武器 ID、插件 ID、联队 ID、模块/内置装配引用必须可解析；重复或缺必填字段沿用读取阶段 error 语义。
- [ ] `.skin` 校验：`skinHullId`、`baseHullId`、内置武器、内置联队、内置插件、战术系统、slot change 和 engine change 引用必须可解析；`skinHullId` 参与所有 hull 引用解析。
- [ ] Faction / Mission 校验：CSV index 与额外文件或目录之间的 ID、路径和必填字段必须一致；Mission 改名后 descriptor、mission_text 和目录资源必须保持可定位。

### Phase 6.4: 资源诊断

- [ ] 贴图资源校验：被 spec、CSV 或 schema 引用的 PNG 资源缺失时给出诊断；贴图宽度或高度为奇数时给出 warning；hardpoint 武器贴图高度不为 4 的倍数时给出 warning。
- [ ] 贴图资源校验不扫描未被引用的所有图片作为首期必做项；如需要全资源扫描，作为后续性能可控的独立扩展。

### Phase 6.5: 诊断展示与同步

- [ ] 设计诊断展示位置：表格行/单元格标记、右侧字段速览提示、配置 schema 字段提示、舰船/武器/弹体编辑器字段提示、资源预览提示、保存前汇总和工作区级汇总。
- [ ] CSV 展示与交互：诊断必须能映射到具体表、行和列；右侧字段速览显示当前行诊断；保存 CSV 前汇总本表诊断。
- [ ] 文件历史 replay 和保存后同步必须刷新受影响实体的诊断结果；二进制贴图变化只刷新资源相关诊断，不尝试解析为文本。

### Phase 6.6: 校验覆盖检查

- [ ] 补最小测试或静态检查：CSV schema 控件类型对应校验器、引用源过滤 `#` 行、hull 引用包含 skin、典型 `.ship/.wpn/.variant/.skin` 异常、贴图尺寸异常和保存前汇总。

## Phase 7: 定义右键行为

### Phase 7.1: 表格与详情右键

- [ ] 定义主表格行、单元格和右侧详情区的右键菜单范围。
- [ ] 覆盖复制 ID、打开可用编辑器、删除记录、定位资源和复制字段值等常用动作。
- [ ] 右键菜单必须复用现有确认、保存边界和文件历史链路，不新增绕过路径。

### Phase 7.2: 配置页右键

- [ ] 定义配置列表和 schema 字段的右键行为，覆盖复制 ID、复制字段、删除、定位文件等动作。
- [ ] Faction、Mission、Variant、Skin 的删除和定位动作必须沿用现有配置保存与文件历史链路。

### Phase 7.3: 编辑器画布右键

- [ ] 定义舰船画布右键行为：添加点、删除点、切换模式、复制坐标等。
- [ ] 定义武器画布右键行为：添加 barrel、删除 barrel、复制坐标等。
- [ ] 定义弹体编辑器右键行为：复制字段、重置字段、定位贴图等。
- [ ] 右键菜单不得破坏画布右键拖动平移体验。

### Phase 7.4: 右键行为验收

- [ ] 为表格、配置页和编辑器右键菜单补手动验收清单。
- [ ] 验收输入框、文本域和弹窗内右键行为不会被业务菜单误拦截。

## Phase 8: 重新梳理主界面快捷键

### Phase 8.1: 主窗口导航快捷键

- [ ] 定义搜索、模块切换、记录选择、多 Mod 导航、总览页和设置页之间的快捷键范围。
- [ ] 快捷键必须按当前视图和焦点状态生效，避免跨页面误触。

### Phase 8.2: 主窗口编辑快捷键

- [x] Ctrl+S 全局保存：主窗口 table 视图、config 各编辑器、编辑器子窗口和文件编辑器均支持 Ctrl+S 触发保存。
- [ ] 统一新建、删除和关闭工作区等通用行为的快捷键。
- [ ] 快捷键必须接入现有 CSV 草稿历史、文件级 history、配置保存和确认链路。

### Phase 8.3: 输入焦点与提示

- [x] Ctrl+S 保存在输入框和文本域内也能正常触发，不被 editable 判断阻断。
- [ ] 避免其他快捷键和输入框、文本域、schema 控件、CSV 单元格编辑器、文件编辑器和系统快捷键冲突。
- [ ] 在合适位置提供主界面快捷键提示或设置入口。

## Phase 9: 高级配置

### Phase 9.1: 游戏全局设置

- [ ] 添加 `data/config/settings.json` 编辑支持。
- [ ] 提供按战斗、生涯、市场、UI 等大类浏览的 schema 表单。
- [ ] Schema 覆盖已知设置项；未知字段保留到额外字段区。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 9.2: 战斗目标配置

- [ ] 添加 `data/config/battle_objectives.json` 编辑支持。
- [ ] 使用 schema 表单编辑目标定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 9.3: 引擎样式配置

- [ ] 添加 `data/config/engine_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；颜色、数值和贴图字段使用已有控件能力。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 9.4: 舰体样式配置

- [ ] 添加 `data/config/hull_styles.json` 编辑支持。
- [ ] 使用 schema 表单编辑样式定义；未知字段保留。
- [ ] 保存走配置保存和文件级 history 链路。

### Phase 9.5: 声音配置

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
- [ ] 更新 `.zcode/module-map.md`、`.zcode/modules/`、`.zcode/frontend-guidelines.md`、`.zcode/backend-guidelines.md` 和 `README.md`。
- [ ] 跑前后端全套检查，并补最关键的回归清单。
- [ ] 记录仍然存在但可接受的技术债和后续改进方向。
