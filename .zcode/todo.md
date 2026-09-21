# Todo

## Phase 1: 架构修正——正确性、响应性与防护基础

> 目标：先消灭正确性实伤、收紧静态防护并清空死代码，为 Phase 2 的 Owner 重构提供安全网。`build.bat` 为必要发布设施，与 `build.ps1` 并存是既定决策，不属整改对象。

### Phase 1.1: Rust 命令线程模型与锁边界

Owner 原则：`PROJECT_SESSIONS` 注册表锁只保护 `sessionId -> Arc<Mutex<ProjectSession>>` 的插入、移除与查找；每个 session 持有独立状态锁，操作（含磁盘 IO）只串行本 session，永不阻塞其它 session；一切含 IO 的 command 在异步线程执行。

- [x] `commands/project.rs` 7 个 query/invalidate、`app_feedback_log.rs` 6 个、`app_settings.rs` 2 个同步命令全部改为 `#[tauri::command(async)]`（经 tauri-macros 与 tauri 源码核实：`(async)` 同步函数经 `async_runtime::spawn` 执行，不占主线程）。
- [x] 注册表改存 `Arc<Mutex<ProjectSession>>`，以 `session_handle`（短注册表锁 + Arc clone）与 `lock_session` 取代 `session_for`/`session_for_mut`；`csv_window`/`entities`/`hull_references`/`source_options`/`csv_patch`/`session` 六文件九处调用点换取锁序言，下游函数签名不变。
- [x] `save_csv_patch` 全程持本 session 锁：同 session 写入天然串行防丢更新，写盘只阻塞本 session；无需 snapshot/commit 拆分，无新增错误路径。
- [x] `query_resource_data_urls` 先短锁克隆 `SpriteSourceContext`，批量贴图加载移出 session 锁；`sprite_resource_bytes_cached` 收窄为 `sprite_source_context` + `sprite_resource_bytes`。
- [x] invalidation 目录重扫与 source-options core 加载只持本 session 锁，跨 session 不再互阻；锁序固定为注册表锁 -> session 锁 -> core/sprite/持久化缓存锁。
- [x] 补并发冒烟测试 `concurrent_threads_on_separate_sessions_run_without_blocking_or_corruption`（4 线程 × 2 session 屏障并发混合操作）；锁模型契约已写入 `.zcode/modules/project-session.md`。
- [x] 跑 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（261 通过）。

### Phase 1.2: core 缓存指纹与外设正确性

- [x] core 指纹改为进程级缓存（按 canonical 游戏根）：首次读取时计算一次，`load_core_cache` 校验与 `save_core_cache` 落盘共用同一指纹，消灭"每个加载器未命中即全量重读+重哈希"的放大；`invalidate_core_cache` 清内存核心缓存时同步丢弃指纹缓存，下次访问重新现算。
- [x] `resources/sprites.rs` 的 data URL MIME 按扩展名判定（png/jpg/jpeg/gif），`image_mime_type` 为类型白名单与 MIME 的唯一来源，`core_graphics.rs` 扫描过滤复用同一函数；未知扩展保持既有宽容回退。
- [x] `services/system_open.rs` Windows 分支改为 `explorer.exe`（目录直接打开、文件 `/select,` 定位），移除 `cmd /C start` 元字符解释面；explorer 退出码不可信，仅进程启动失败视为错误（文件不再用默认应用打开，为已确认的行为变化）。
- [x] `services/project/projectiles.rs` 删除恒为 true 的 `overwrite` 参数与不可达分支。
- [x] `persistent.rs` 的 FNV-1a 内容指纹保留，实现处已注明：非抗碰撞、仅防意外变更；换算法将一次性作废全部持久化缓存并由下次打开静默重建。
- [x] 跑 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（263 通过）。

### Phase 1.3: Rust 单一实现收敛

Owner 原则：每个通用机制只有一个正式实现与一个 owner 模块；镜像成对的实体文件合并为参数化单一实现。

- [x] `path_is_or_in_dir` / `path_affects_target` 收敛为 `domain/config.rs` 单一 pub 实现（落点修正：domain 现为纯层，收敛到 io 会新增 domain→io 依赖；该谓词与 `validate_config_file_rel_path` 同属纯 rel-path 逻辑）；`domain/editor_config_definitions.rs`、`services/project/entity_definitions.rs`、`cache/invalidation.rs` 各自私有副本删除。
- [x] `normalize_rel_path`（`model.rs`、`persistent.rs`）与 `relative_path_key`（`io/paths.rs`）合并为 `io/paths.rs` 的 `forward_slash_path` / `forward_slash_relative_path`。
- [x] JSON 目录扫描统一：`io/json_files.rs::walk_json_dir` 为唯一 walkdir 扫描入口（统一"遍历 {label} 目录失败"错误上下文与链接校验）；`load_json_dir` 变为其投影，`project/spec_files.rs` variant/skin 扫描与 `editor_config/spec_files.rs::find_json_target` 全部复用。
- [x] `editor_config/variants.rs` 与 `skins.rs` 合并为 `spec_entities.rs`（`save/create/delete_spec_entity` 按 `EntityKind` 参数化，`EntitySpecDefinition` 新增 `display_name` 驱动全部文案）；命令层 wire 函数名与 payload 类型不变；两套镜像测试合并为参数化运行器（10 个用例保留）。
- [x] CP1252 智能引号归一化收敛到 `io/text.rs::known_cp1252_char` 单一映射表，`parsers/alex_csv.rs` 复用；"读入即归一化、随保存写盘不可逆"契约写入 `rust-file-io-changeset.md`。
- [x] indexed config 链路 refreshed entity 改为 models 层 `IndexedEntityRefresh` 类型化 wire 模型（camelCase 序列化与原 json! 键完全一致）。
- [x] `commands/editor_config.rs` 十处重复 session 守卫下沉：payload 实现 `SessionModScope` trait，统一 `ensure_session_mod_scope` 校验。
- [x] 守卫后 `unwrap()` 全部改写为 `if let Some`/`filter`；`entity_definition`、`editor_spec_definition`、`indexed_config_definition` 改为返回 `AppResult` 的查找（调用点 `?` 传播）；`csv_table_definition` 因键为封闭枚举改为穷举 `match` 实现（编译期全量性，表项拆为具名常量，零调用方级联）；faction 的 expect-shim 直接改用 `FACTION_SPEC_DEFINITION` 常量；`lib.rs` 启动 expect 与 `alex_json` 正则常量 expect 非注册表查找，保留。
- [x] `session_id` 生成改为 `AtomicU64` 单调计数器（20 位零填充保持字典序=创建序）；session 注册表加 32 上限，超限驱逐最旧并清其 sprite 媒体缓存。
- [x] `sprites.rs` 测试内联贴图字段数组改为引用 `model::WEAPON_SPRITE_FIELDS` 生产常量。
- [x] 跑 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（263 通过）。

### Phase 1.4: 静态规则引擎修复

- [x] 修复 `.zcode/modules/*.md` 不被文件收集器收录导致 `workspace-module-boundary` 文档检查永不触发的死分支：收集器纳入 `.zcode/modules/*.md`，规则以 `singleFileByRel` 锚定文档并注入验证检查真实触发。
- [x] `check-identifier-length.mjs` 与 `rust-project-layer-boundary.mjs` 的 `#[cfg(test)]` 块剥离统一到 `shared/rust-source.mjs` 单一实现；剥离改为确定性状态机（嵌套块注释、原始串 hash、lifetime 先于 char literal 判定、单遍扫描），先剥注释/字符串再配平花括号；旧链式正则会被 `'\"'` 类字符字面量与 lifetime 撇号打跨行失配（已实证并修复）。
- [x] 清理规则引擎死导出：`rustLayerForPath`、`rustLayerForCratePath`、`withTsExtension`、`fileTextByRel` 及其模块级可变状态全部删除；`exportedFunctionNames` 双实现合一（naming-boundary 改用 shared 版）。
- [x] `directory-opening-boundary.mjs` 的裸路径正则特判改写为锚点数据表（rel → 名单/文案），并将该正则形态显式纳入 self-boundary 禁令（`usesBarePathRegexIdentity`），注入验证对旧形态真实触发。
- [x] 引擎修复暴露并修复两个被掩盖的真实违规：`parsers→io` 依赖（`known_cp1252_char` 迁至 models，依赖矩阵允许 parsers/io 共同依赖）与超长函数名 `clear_sprite_media_cache_for_session`（重命名为 `clear_sprite_media_for_session`）。
- [x] 跑 `check-architecture`、`check-identifier-length`、`check-encoding` 三个脚本并确认全绿（配套 cargo fmt/clippy/test 263 通过）。

### Phase 1.5: 前端死代码与残留清理

- [x] 删除零引用导出：`file-history.store.ts` 的 `canUndoFileSave`/`canRedoFileSave`/`activeUndoStack`/`activeRedoStack`/`activeHistoryCount`（含失用的 `computed` 导入）；`windows/editor.window.ts` 的 `openShipEditorWindow`/`openWeaponEditorWindow`/`openSystemEditorWindow`（`openProjectileEditorWindow`/`openWeaponPreviewWindow` 保留，有消费方）；`use-canvas-drawing.ts` 的 `drawDot`/`drawCrosshair`；`use-history.ts` 的 `reset`（连带删除失去唯一使用者的 `initial` 参数，两个编辑器调用点改显式 `useHistory<RowData>()`）；`csv-faction-filter.ts` 的 `isFilterableTable`（连带失用的 `TableKey` 导入）；`tables.store.ts` 末尾的 `MODULE_LABELS` 再导出（连带失用的导入）。
- [x] `tables.store.ts`：`discardTableDraftForReload` 与 `loadExternalTableDraft` 同体异名合一，保留语义准确的 `discardTableDraftForReload`，错名调用点 `use-csv-table-view-model.ts:133` 同步；`addNewRow`/`deleteSelected` 去除无 `await` 的 `async`（调用方包装器 `await void` 合法，try/catch 语义不变，未动）。
- [x] `settings-persistence.orchestrator.ts` 的 `startSettingsMirror`/`startSettingsPersistence` 返回 dispose（unlisten 数组闭包 + `watch` stop，守卫已启动返回空函数）；`useSettingsMirror`/`useSettingsPersistence` 以 `onUnmounted` 挂接，与 `window-save.orchestrator` 清理约定一致。
- [x] `SystemEditor.vue` 删除未使用的 `modRoot` prop，`EditorWindowContent.vue` 同步移除传参。
- [x] `schema-select-media.service.ts` 薄壳删除；`use-schema-select-media.ts` 直接导入 `resource-media.service` 的 `resourceMediaDataUrl`/`ensureResourceMedia`（'schema-select' surface 参数不变），五个组件消费方经 composable 无感。
- [x] `requireConfigRowData`/`requireEditorRowData` 无信息量包装删除，config-entity（13 处）/editor（8 处）就地统一为 `shared/lib/row-data` 的 `requireRowData`。
- [x] 移除生产依赖 `@vue/devtools-api`（实为 pinia 4 的非可选 peer，npm 自动安装提供，从直接依赖删除后由 peer 机制继续供给，package.json/package-lock 已同步）。
- [x] 跑前端 format:check、encoding:check、lint、typecheck、test、build 全绿（format:check 仅剩 HEAD 既有 `write.service.ts` 问题）。

### Phase 1.6: 工具链与配置硬化

- [x] `tsconfig.json` 补 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`verbatimModuleSyntax`（暴露 1 处 v-for 未用参数已修复），target/lib 与 `tsconfig.node.json` 统一为 ES2023。
- [ ] `noUncheckedIndexedAccess` 实测暴露 108 处错误（ShipEditor 30、settings.store 16、resource-cache 9 等），改动面大，暂缓启用；后续可按文件分批消化。
- [x] 新增 CI 工作流 `.github/workflows/ci.yml`：push/PR 在 windows-latest 执行 format:check、encoding:check、lint、typecheck、test、build 与 cargo fmt/clippy/test。
- [x] 处置零消费的 `schemas/_meta.json`：已删除（删除前复核全仓零引用）。
- [x] `.zcode/bugs.md` 删除已由用户提交入库，保持删除；`.zcode/module-map.md` 中对它的唯一引用已移除，悬空契约消除。
- [x] README 技术栈说明补 Pinia。

## Phase 2: 架构修正——Owner 职责重构

> 目标：为重复机制建立唯一正式 Owner，归位 service / orchestrator / component / composable 职责。每个子阶段完成后必须按事后要求同步 `.zcode` 对应契约文档。

### Phase 2.1: 统一编辑会话原语

Owner 原则："基线-草稿-dirty-外部更新挂起-撤销/重做"在全仓只有一个正式模型与一个 owner；CSV 单元粒度、整文件快照与纯文本是同一原语的三种特化，不是三套实现。

- [x] 在 `src/domain/edit-session.ts` 建立框架无关双原语（定形经确认）：`createEditSessionValue`（baseline/draft/派生 dirty/revision/pendingExternal，equals/clone 注入）+ `createUndoStack`（双栈/limit/nextId/clear，条目形状由机制自定）；配 16 个 vitest 单元测试。
- [x] 分步迁移：`use-draft-session.ts` 改为原语适配器（保持 Ref API，消费者零改动）；`use-text-history.ts`、`file-history.store.ts`（id 生成收敛为原语 `nextId`）、`tables-edit-history.store.ts` 的双栈全部迁移；CSV 表格草稿保持领域特化（单元格级 dirty 承载单元格 UI 标记，经确认不强迁值级原语），其撤销已由共享栈承载。
- [x] 建立 Mod 级未保存工作查询的唯一 owner：`draft-sessions.store` 扩为未保存工作注册表（`registerDraftSession` + `registerDirtySource` + `hasUnsavedWorkForMod`），`tables.store` 以 `hasModDirtyChanges` 注册判定源；`ModTabsBar.vue`、`AppContent.vue`、`use-workspace-shell-actions.ts` 三处手工 `||` 并集全部改走唯一入口（后两处连带删除失用的 tables 依赖）。
- [x] dirty 登记模型统一：配置草稿走会话登记、CSV 表格走判定源登记，消费方只查询注册表。
- [x] `draft-session-boundary` 新增"编辑会话原语禁止业务模块直引（仅四个适配器可消费）"断言；`csv-draft-boundary`、`file-history-boundary` 的归属断言经复核仍然成立，无需改写。
- [x] 跑前端全套检查全绿（format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：CSV 编辑/撤销/重做、配置草稿外部更新交接、文件编辑器撤销、未保存关闭确认四条链路待人工过一遍。

### Phase 2.2: 缓存原语统一

Owner 原则：通用缓存机制（key 版本、pending 去重、容量淘汰、失效订阅、可重置）只有一个 owner 实现；query/resource/media 三种缓存只是配置差异。

- [x] 在 `src/shared/runtime/cache.ts` 建立通用缓存原语 `createRuntimeCache`（插入序 LRU 容量淘汰 + touch 重排、key 版本计数、pending 去重、`reset()` 测试隔离），配 8 个 vitest 单元测试。
- [x] `query-cache.service.ts` 重建于原语之上：按 `QueryCacheKind` 持 6 个实例（各自容量），失效/版本/pending 全走实例；`resource-cache.service.ts` 重建为单实例（容量 512）；语义层（queryScopes 匹配、资源匹配、批量加载、性能埋点）原样保留。
- [x] `resource-media.service.ts` 定型为 resource-cache 之上的响应式投影视图（模板绑定 + 25ms 合批队列），不构成第二份数据缓存 owner，不强迁原语（避免 services 层依赖 Vue reactive）；定位已写入模块契约。
- [x] 失效链路保持唯一 owner：写后仍由 project-session-refresh 统一先资源后查询，顺序不变；消费方零改动。
- [x] `stableStringify` 三份实现合并为 `shared/lib/stable-compare.ts` 唯一导出实现（query-cache 的 localeCompare 排序与 schema-sections 的 `schemaStableIdentity` 副本删除；参数键均为 ASCII，键序等价）。
- [x] 补缓存原语单元测试（LRU 逐出、touch 重排、版本、pending、reset）。附带修复 Phase 2.1 遗留回归：撤销原语改状态工厂 + 纯操作函数，消除 reactive 包装后闭包直改不触发 UI 更新的问题，并以 `computed` 断言测试锁定。

### Phase 2.3: service 层 owner 归位

Owner 原则：service 只包装单一后端能力并与 `shared/api` 一一映射；跨能力组合、媒体水合与遥测埋点属 orchestrator 或横切设施，不属于任何 service。

- [x] 重声明并执行 service 依赖规则：service 之间默认禁止 import，基础设施边以白名单显式维护（query→query-cache、resource-media→resource-cache、config-entity→config-resource/query、config-resource→query/resource-cache、csv-table→query/resource-cache/write、files→write、editor→files/query/resource-cache/write）；`frontend-layer-boundary.mjs` 已同步改写并实证拦截白名单外的边。
- [x] `performance.service` 删除，遥测迁为 `shared/runtime/performance` 横切设施（格式化 + 可注入日志 sink）；`app-feedback-log.service` 模块加载时注册 sink，全仓 14 个消费文件仅改 import 路径。
- [x] 聚合 service 拆解（按既有 resource-boundary/query-boundary 契约校正落点）：`csv-table.service` 保留为 CSV 查询 owner（源目录埋点归位，行预览+资源水合组合保留），写透传删除（table-save 直用 write.service）；`config-entity.service` 瘦身为配置实体读 service（-254 行：写直通别名删除，整形/解析迁 `domain/config/config-records.ts`）；`editor.service` 保留在 services 层（bundle 读组合必须触 resource-cache，resource-boundary 契约要求），`loadImportedSpecFile` 改经 `files.service` 恢复 api↔service 一一映射。
- [x] `shared/api/files-api` 的直接消费并入 `files.service`，api 与 service 一一映射恢复。
- [x] orchestrator 层组合规则成文：frontend-layer-boundary 新增 orchestrators import 图无环检测（DFS）；`file-history-session` 拆分为 `file-history-write.orchestrator`（写入完成登记）与 `file-history-replay.orchestrator`（回放计划/执行，含确认 UI），规则豁免集同步。
- [x] 更新 `.zcode/overview.md` 与 `frontend-guidelines.md` 的 service 契约描述。

### Phase 2.4: 配置实体组件族参数化

Owner 原则：同构实体族（列表 + 草稿编辑器 + 新建/删除确认）只有一个参数化实现；实体类型差异只存在于定义数据。

- [x] Skin/Variant 两族参数化合并：新增 `domain/config/config-entity-families.ts`（`ConfigEntityFamilyDefinition` + variant/skin 定义，含 idField/companionField/文案/图标路径/媒体 surface）+ `use-config-family-view-model.ts`（列表/新建/删除/保存校验全收敛）+ `use-config-family-editor-view-model.ts`（draft session 接线收敛）+ `ConfigEntityFamilyList/Editor/View.vue` 三个通用组件；原 8 文件删除，`ConfigWorkspace.vue` 改用 family view ×2。Faction/Mission 族评估结论：两者编辑数据形状与 Skin/Variant 不同（Faction 含 description/crest 水合、Mission 聚合多源 editor data），暂缓纳入同一抽象，避免为对齐而破坏稳定族。
- [x] schema runtime context 统一（family 范围内）：通用 family editor 以 `createSchemaRuntimeContext` 单点创建；Faction 族的 props 注入路径保持（与 core-schema 合并流程耦合），暂缓统一，已记录。
- [x] 新建对话框校验与错误防线统一：family VM 层统一捕获与反馈（必填、ID 非法、冲突），组件层仅触发；Faction/Mission 的新建防线下沉至各自 view-model（VM 捕获异常并反馈，组件层只触发不捕获），四族模式一致。
- [x] config 组件族 props-as-DI 与直接取 store 双路径统一：family 组件经 props 接收 definition 与回调，view-model 统一从 store/orchestrator 取数，路径单一。
- [x] `ConfigModInfoEditor.vue` 借用 `settings.css` 类名改为通用 `config-page/config-page-header/config-page-footer` 类（config.css 新增骨架类）。
- [x] 跑前端全套检查全绿（format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：Skin/Variant 新建/编辑/删除/外部更新四链路待人工过一遍。

### Phase 2.5: 画布编辑器骨架下沉

- [x] 抽取 `use-canvas-editor` composable：命中检测（统一 `{kind, i, distance}` 目标形状）、镜像轴/光标/hover 预览绘制、选区同步（hovered/selected/activeTarget/inspectorLock）、undo 集成（pushUndo/doUndo/doRedo + useEditorShortcuts 接线）、window resize/keydown/keyup 三件套、resize 与 inspector reveal 联动、指针生命周期骨架（pan/drag/hover 分发）；`ShipEditor.vue` 与 `WeaponEditor.vue` 改为注入 viewport（`useCanvasViewport`）+ 状态（`createCanvasEditorState`）+ hooks 复用，两文件合计瘦身约 700 行；`use-canvas-viewport`/`use-canvas-drawing` 保留为其独占依赖。顺带删除：两编辑器重复的 `hitTarget`（恒不可达，nearestTarget 已覆盖判定）、ShipEditor 只写不读的 `dragStarted`。
- [x] `WeaponFirePreview.vue` 与 WeaponEditor 重复的坐标/贴图字段映射收敛为同源实现：`domain/editors/lib/weapon-sprite-fields.ts` 新增 `weaponOffsetsKey`/`weaponAnglesKey`/`weaponBarrelOffsetsFor`（只读投影，缺省 [10,0]）+ `WEAPON_SPRITE_ORIGIN_RATIO`；`canvas-visuals.ts` 新增 `drawWeaponSpriteLayer`（90° 旋转 + origin 比例定位）；配 `weapon-sprite-fields.spec.ts` 4 个单元测试。
- [x] 4 处 `deep: true, flush: 'sync'` 深度同步 watch 全部删除，改为显式提交模型（经确认全量显式）：所有 draft 变更路径显式 commit `draft-changed` -> Draft Session setDraft；画布拖拽在动作边界（onUp/onLeave）提交一次、拖拽中途不提交；检查器输入经 `setField`/具名变更函数逐事件提交；computed setter（颜色/动态标签/projectileSpecId）与 `useObjectField`（新增可选 `onCommit`）在 setter 内提交；undo/redo 由 composable 提交，draftRevision 重载不提交（父级发起）。可审计不变量：四编辑器模板不再有直连 draft 字段的 v-model（仅剩 setter 内含 commit 的 computed 与 UI 本地文本状态），已 grep 复核为零。行为修正：ShipEditor `selectedSlot.mount` 此前改动不重绘画布，已随 `setSlotField` 修复。
- [x] 跑前端全套检查全绿（typecheck、lint、架构三脚本、encoding、71 测试、build；format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：舰船画布拖拽/镜像成对/撤销重做/检查器 T 联动/贴图宽高同步、武器发射点拖拽/角度/镜像/U-H 视图/撤销、弹体与战术系统表单逐字段 dirty+保存、发射预览开火/光束/播放速度。

### Phase 2.6: 表格渲染与交互一致性

- [x] 8 处 v-for index key 改为结构化稳定 key：新增 `shared/lib/entry-keys.ts`（WeakMap 引用身份 uid + 位置回退）用于 genericArrayItems/arrayItems 与舰船/弹体引擎槽列表；kv 行改为并行行 id（增行追加/删行截断），`kvSelectOpen` 按行 id 记录，`removeKvEntry` 手工重排补偿逻辑删除（改名/删除不再错位）；发射点与边界列表为天然位置型条目，改为显式结构前缀 key（`barrel-{view}-{i}`/`bound-{i}`）。
- [x] 快捷键统一（经确认全窗口对齐含 Ctrl+Y）：domain `shortcutCommandFromKeyEvent` 为唯一键位表（undo/redo/save/close，Ctrl+S 全局语义不受输入焦点限制，undoRedoInEditable 供文本面开启，Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y 三路重做）；`use-shortcut-dispatch` 为唯一分发器（window 监听 + 命中 preventDefault + 纯键表带输入豁免）；`use-editor-shortcuts` 删除（use-canvas-editor 改走分发器）、`EditorWindowContent` 与 `FileEditorContent` 自写 handler 删除、`use-main-window-shortcuts` 重写为分发器薄壳。行为对齐：编辑器子窗口新增 Ctrl+Y 重做；Escape 仅文件编辑窗口有 close 处理器。
- [x] JSON 编辑失败处理统一：`ObjectEditor` 解析失败发 `invalid-json` 事件，四个宿主（WeaponEditor muzzleFlash/smoke、ProjectileEditor engineSpec/explosionSpec）与 SystemEditor aiHints 接 warning 反馈；SystemEditor `applyDroneBehavior` 静默 catch 改 warning；`SchemaFieldRenderer` JSON 形态字段 textarea 增加 `@change` 提交边界校验（解析失败 warning 一次，逐键不告警）。
- [x] SystemEditor 内联额外字段 textarea（extraJson/applyExtra）删除，复用 `shared/ui/JsonFieldEditor`；归属评估结论：保留在 shared/ui（仅依赖 shared/lib、同时服务 schema 与 editors 两模块）。
- [x] `WeaponEditor.vue` 事件 `editProjectile` 改 kebab-case `edit-projectile`；naming-boundary 接线事件命名约束（defineEmits 裸驼峰键与 emit 调用驼峰字面量为违规），合成样例验证规则真实触发。
- [x] `use-table-dom-selection` 评估结论：完全收敛为响应式唯一来源——`CsvGridRow` 增加 `selected` prop 绑定 class（沿用 `.data-table tr.selected td` 样式），composable 与 DOM classList/querySelector 手工同步删除；虚拟滚动下选中变化仅重渲两行。
- [x] 跑前端全套检查全绿（typecheck、lint、架构三脚本、encoding、71 测试、build；format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：表格选中高亮（滚动后保持）、kv 行增删改名（展开态跟随正确行）、数组项删除焦点保持、三窗口快捷键（输入框内 Ctrl+S、文本区 undo/redo、编辑器 Ctrl+Y）、JSON 非法提交告警、SystemEditor 额外字段增删改、编辑弹体按钮。

### Phase 2.7: settings、主题与窗口层归位

- [x] `settings.store.ts` 拆分（461 行 → 约 120 行状态 store）：色彩数学、accent 预设与主题令牌下沉 `domain/settings/theme.ts`（纯函数）；输入校验/归一化下沉 `domain/settings/rules.ts`（readTheme/readHistoryLimit 等）；写 DOM 的主题副作用上移 `app/composables/use-theme-dom-effect.ts`（由唯一 WindowShell 挂载）；store 只持状态、setter 与派生值，snapshot/replace 契约不变。消费方（SettingsPage/theme-overrides）改从 domain 取。
- [x] `WindowShell.vue` 合并为单一 shell：`mode: 'main' | 'child'` 参数区分设置持久化（落盘+广播）与设置镜像（监听替换），Provider 栈只写一份；`App.vue` 变为 `<WindowShell mode="main" />` 薄壳，EditorWindowApp/FileEditorApp 零改动。
- [x] `current.window.ts` 关窗 API 统一：删除 `closeCurrentWebviewWindow`（唯一调用方 FileEditorContent 改用 `closeCurrentWindow`）；`reloadCurrentWebviewWindow` 改名 `reloadCurrentWindow` 与 location.reload 实现对齐。
- [x] `managed.window.ts`：创建改 Promise 化并监听 `tauri://created`/`tauri://error`；新增 URL query 总长度守卫（超限 reject）；`openEditorWindow` 对 draftSnapshot 设独立上限、超限去掉参数优雅降级（预览回退已保存 bundle）；失败反馈接线至 4 个调用点（EditorWindowContent/use-workspace-shell-actions 三处 feedback.error、app-feedback 内部点记日志）。
- [x] `window-save.orchestrator.ts` 与 `use-editor-window-view-model.ts` 的 `EditorSpecSavedEvent` 统一从 `window.events` 取；editor.window.ts 零消费 re-export 删除。
- [x] `save-command-registry.ts` 迁为 `stores/save-command.store.ts`（register/unregister/dispatch），消除 `m_` 前缀特例；AppContent、4 个 config 编辑器、use-main-window-shortcuts 改为消费 store。
- [x] 关闭 Mod 的 5-store 清理序列抽为 `workspace-lifecycle.orchestrator.removeModRuntimeState` 唯一用例；`removeLoadedModRuntime` = 缓存失效 + 用例 + closeProject；`directory-opening.rollbackFailedModOpening` 复用用例 + showOverview。
- [x] `file-editor.css` 并入 `index.css` 聚合，`main.ts` 恢复单一样式入口。
- [x] `DataTable.vue`/`DetailPane.vue` 归位评估结论：移入 `components/tables/`（仅 TableWorkspace 消费且属表格域）。
- [x] 跑前端全套检查全绿（typecheck、lint、架构三脚本、encoding、71 测试、build；format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：主题切换/自定义强调色三窗口生效、子窗口设置镜像、设置页清空配置后重载、编辑器/预览/文件窗口打开失败反馈、大草稿预览降级、各表面 Ctrl+S、Mod 移除/打开失败回滚后残留状态、文件编辑器样式。

### Phase 2.8: schema 资产归一

- [x] `schemas/*.schema.json` 三种结构统一到 field-schema/v1 单一正式形态（基准：mission 形态 `$schema` + `sections` + 可选 `sources`）：mod-info/faction 扁平 fields 包进 `__all` 单节（与原回退产物逐字段一致，渲染零变化），variant/skin 补 `$schema`；`FileSchema` 类型删除 `fields`，getSchemaSections 回退分支删除，schema-sources/new-mod-template 改走 sections。
- [x] CSV 列 schema 与 spec schema 统一命名约定：14 个 `schemas/csv/*.columns.json` 重命名为 `*.schema.json`（git mv 保留历史），全仓 schema 资产单一后缀、spec/csv 按目录区分。
- [x] `schema-registry.ts` 合并为单一加载路径：5 个 spec + 14 个 csv 列资产全部经唯一入口 import + 逐属性运行时形状校验（`$schema` 版本、字段类型/CSV 控件闭合枚举、source 类型、递归 nested/item/valueSchema）产出类型化对象，15 处盲 `as` 强转清零；`CsvColumnSchema`/`CsvColumnControl` 类型迁入 `schema.types.ts`（附闭合枚举常量），csv-column-schema.ts 保留 tables 域 API、数据改从 registry 取；schema-module-boundary 规则同步为双访问器契约（getSchema/getCsvColumnSchemas）。
- [x] schema 消费端依赖核查：SchemaFormRenderer/SchemaFieldRenderer 仅依赖 `schema.types` 统一输出类型（FieldSchema/SectionSchema/FileSchema），无 raw asset 引用或 schema 级 `as` 强转；6 个 tables 消费文件的类型 import 改指 schema.types。
- [x] 跑前端全套检查全绿（typecheck、lint、架构三脚本、encoding、71 测试、build；format 仅剩 HEAD 既有 write.service.ts 问题）；手工验收清单：四类配置实体表单渲染与保存（mod-info/faction/mission/skin/variant）、CSV 表富控件（enum/reference/tags/布尔/图片路径列）、faction core 字段合并区、新建 Mod 模板默认值、表格富控件列筛选。

### Phase 2.9: 错误语义、命名与一致性收尾

- [x] 错误类型边界成文并入规则：新增 `error-boundary.mjs`——`services`/`orchestrators` 内 `throw new Error` 即违规（必须抛携带 `action` 的 `AppError`/`withCause`），domain 允许值语义裸 Error；修正 write.service 排他写冲突（action `exclusive-write`）与 mod-creation.orchestrator 三处打开结果分支（action `open-created-mod`）共 4 处裸 Error；frontend-guidelines 补错误语义边界说明。
- [x] Pinia store id 统一 kebab-case：`fileHistory` → `file-history`、`tablesEditHistory` → `tables-edit-history`（无字符串引用，仅 Pinia 内部标识）；naming-boundary 接线 `defineStore('id')` kebab-case 约束。
- [x] `app-feedback.ts` 工厂与 `use-app-feedback.ts` hook 关系成文：feedback-boundary 新增"工厂仅允许被 hook 消费"约束（以内容特征锚定，规避文件名存在性检查）；工厂内直取 store 与开窗的评估结论为**维持现状不上移**（耦合仅发生在点击回调运行时，上移是搬运而非消除），结论已写入 app-feedback-log.md。
- [x] `shared/types` barrel 直引收敛：barrel 增补 `FileHistoryItem`/`FileSaveHistoryEntry`/`CsvDraftOperation`/`CsvEditHistoryEntry` 4 个缺失导出；17 处绕桶直引（app 3、stores 2、domain 2、orchestrators 2、services 3、shared/api 4、shared/lib 1）全部改走统一 barrel；shared-types-boundary 补正向约束（barrel 外禁止直引成员文件）。
- [x] 全仓 grep 复核收尾：删除 6 处零消费死导出（`resolveEnumSource`、`assignTableRowKeys`、`saveTablePatch`、`toAppError`、`pathStem`、`normalizedProjectPath`；`isFileSaveEntry` 同批删除），csv-table→write 白名单边随之失效移除；同名同体函数定向抽查（formatTimestamp/formatChange/fileTitle 等经典嫌疑）无第二份同体实现；service 互调 10 条边全部在白名单内且 DFS 无环；其余"仅本文件使用"的导出保留（是 API 面非死代码）。
- [x] write.service 历史格式问题顺手修正，`format:check` 首次全仓通过（零例外）；前端全套检查全绿（typecheck、lint、架构三脚本、encoding、71 测试、build）；手工验收清单：同表重复 Ctrl+S 触发排他写提示、新建 Mod 目标已存在/无法打开的错误反馈、两 history store 撤销重做功能不变、各表面 Ctrl+S。

### Phase 2.10: 测试补强与文档同步

- [x] EditSession 原语与缓存原语测试已在 2.1/2.2 建立（17 + 8 个用例），本轮复核覆盖达标。
- [x] 快捷键分发测试：新增 `main-window-commands.spec.ts` 覆盖 `shortcutCommandFromKeyEvent` 全键位表（Ctrl+S 全局含输入框、Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y 三路重做、输入焦点豁免与 `undoRedoInEditable` 开关、Escape→close、Alt 阻断）。
- [x] schema 统一加载器测试：新增 `schema-registry.spec.ts` 断言 5 个 spec 资产按 field-schema/v1 形态加载（`$schema`、sections、sources 形状、字段闭合类型集合）、14 个 csv 表列 schema 键与控件闭合集合、未知 id 返回 null；资产形状损坏会在模块加载时抛错（运行时防线）。
- [x] 保存链路 orchestrator 直接测试：`table-save.orchestrator.spec.ts`（真实 store + mock write/history——capture 匹配、无 dirty noop、upsert/delete changeset 构造、历史登记先于草稿清理、session 变化 noop）、`config-save.orchestrator.spec.ts`（十个写动作委托、entityId 解析、indexedConfigHistoryLabel 标签、默认数据同源断言）、`file-save.orchestrator.spec.ts`（空变更过滤、spec/basename 标签）、`window-save.orchestrator.spec.ts`（事件注册、编辑器保存回调触发条件、dispose 释放）。
- [x] Rust 侧保持既有覆盖：cargo test 263 通过，editor_config 参数化测试覆盖 variants/skins 两实体保存改名/撤销重做/可回放删除/路径越界拒绝/ID 匹配全部行为。
- [x] 按 workflow.md 事后要求同步文档：overview.md 补唯一窗口壳与跨模块单一 owner 原语清单；frontend-guidelines 补错误语义边界、store id、类型桶约束；backend-guidelines 复核仍准确；module-map 与受影响 modules（schema/app-settings/windowing/workspace/ship-editor/weapon-editor/weapon-preview/projectile-editor/system-editor/app-feedback-log）已按阶段同步。
- [x] 跑前后端全套检查全绿（前端：typecheck、lint、架构三脚本、encoding、103 测试、build、format 零例外；Rust：fmt/clippy/test 263 通过）。仍需人工确认的运行时行为清单见各阶段 todo 与下方汇总：
  - 画布：舰船/武器拖拽、镜像成对、撤销重做、T 检查器联动、贴图宽高同步、发射点角度与删除。
  - 表格：选中高亮滚动保持、kv 行增删改名展开态跟随、数组项删除焦点、富控件列（enum/reference/tags/布尔/图片路径）。
  - 快捷键与窗口：三窗口 Ctrl+S、文本区 undo/redo、编辑器 Ctrl+Y、主题三窗口同步、子窗口设置镜像、开窗失败反馈、大草稿预览降级。
  - 配置：五类实体表单渲染与保存、faction core 字段合并区、新建 Mod 默认值与打开失败反馈、同表重复保存的排他写提示。

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
