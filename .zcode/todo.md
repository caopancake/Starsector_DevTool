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

- [ ] `tsconfig.json` 补 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`verbatimModuleSyntax`，并统一与 `tsconfig.node.json` 的 target；`noUncheckedIndexedAccess` 单独评估改动面后决定是否启用。
- [ ] 新增 CI 工作流：push/PR 执行 format:check、encoding:check、lint（含架构与标识符检查）、typecheck、test、build 与 cargo fmt/clippy/test。
- [ ] 处置零消费的 `schemas/_meta.json`：默认删除。
- [ ] 确认 `.zcode/bugs.md` 删除现状的处置（保持删除则同步移除 `module-map.md` 中对它的唯一引用），消除悬空契约。
- [ ] README 技术栈说明补 Pinia。

## Phase 2: 架构修正——Owner 职责重构

> 目标：为重复机制建立唯一正式 Owner，归位 service / orchestrator / component / composable 职责。每个子阶段完成后必须按事后要求同步 `.zcode` 对应契约文档。

### Phase 2.1: 统一编辑会话原语

Owner 原则："基线-草稿-dirty-外部更新挂起-撤销/重做"在全仓只有一个正式模型与一个 owner；CSV 单元粒度、整文件快照与纯文本是同一原语的三种特化，不是三套实现。

- [ ] 在 `src/domain` 建立框架无关的统一 EditSession 正式模型：baseline、draft、派生 dirty、revision、pendingExternal、undo/redo 栈与 historyLimit，equals/clone 以选项注入；原语配完整单元测试。
- [ ] 分步迁移：先迁配置/编辑器草稿（`use-draft-session.ts`）与文本撤销（`use-text-history.ts`），再迁文件历史（`file-history.store.ts`）与 CSV 撤销（`tables-edit-history.store.ts`）的栈与 id 生成，最后迁 CSV 表格草稿（`tables.store.ts` ModTableState 的 draft 部分与 `domain/tables/csv-table-draft.ts`）；删除各机制的私有实现。
- [ ] 建立 Mod 级未保存工作查询的唯一 owner（workspace store 聚合），`ModTabsBar.vue`、`AppContent.vue`、`use-workspace-shell-actions.ts` 中的手工 `||` 并集全部改走唯一入口。
- [ ] dirty 登记模型统一：CSV 表格草稿与配置草稿向同一注册点登记，消费方不再感知机制差异。
- [ ] 迁移完成后清退旧术语与旧 API；`csv-draft-boundary`、`draft-session-boundary`、`file-history-boundary` 规则同步改写为新原语的边界断言。
- [ ] 跑前端全套检查 + 手工验收：CSV 编辑/撤销/重做、配置草稿/外部更新交接、文件编辑器撤销、未保存关闭确认全链路。

### Phase 2.2: 缓存原语统一

Owner 原则：通用缓存机制（key 版本、pending 去重、容量淘汰、失效订阅、可重置）只有一个 owner 实现；query/resource/media 三种缓存只是配置差异。

- [ ] 在 `src/shared/runtime` 建立通用缓存原语（可注入 key、容量、失效事件类型，支持重置以隔离测试）。
- [ ] `query-cache.service.ts`、`resource-cache.service.ts`、`resource-media.service.ts` 改为原语实例，删除各自的四件套 Map 与 bump/evict/notify/subscribe 副本。
- [ ] 失效链路保持唯一 owner：写后仍由 project-session-refresh 统一先资源后查询，顺序不变。
- [ ] `stableStringify` 三份实现（`shared/lib/stable-compare.ts`、`query-cache.service.ts`、`domain/schema/schema-sections.ts`）合并为 `shared/lib/stable-compare.ts` 唯一实现。
- [ ] 补缓存原语单元测试（失效、去重、LRU、重置）。

### Phase 2.3: service 层 owner 归位

Owner 原则：service 只包装单一后端能力并与 `shared/api` 一一映射；跨能力组合、媒体水合与遥测埋点属 orchestrator 或横切设施，不属于任何 service。

- [ ] 重声明并执行 service 依赖规则：service 禁止 import 其它 service，基础设施例外必须显式白名单入规则；`frontend-layer-boundary.mjs` 同步改写。
- [ ] `performance.service` 的遥测改为 `shared/runtime` 横切设施，摘除所有 service 对它的直接依赖（埋点上移 api 包装层或 orchestrator）。
- [ ] 拆解聚合型 service：`config-entity.service.ts`、`editor.service.ts`、`csv-table.service.ts` 的读聚合与保存编排上移至对应 orchestrator（config-save、table-save、编辑器保存编排），service 退回单一能力包装。
- [ ] `editor.service.ts` 对 `shared/api/files-api` 的直接消费并入 `files.service`，恢复 api 与 service 的一一映射。
- [ ] orchestrator 层组合规则成文：允许高层编排低层用例、必须单向无环；评估 `file-history-session` 的"写入完成登记"与"重放执行"是否拆分为两个 owner。
- [ ] 更新 `.zcode/overview.md` 与 `frontend-guidelines.md` 的 service 契约描述。

### Phase 2.4: 配置实体组件族参数化

Owner 原则：同构实体族（列表 + 草稿编辑器 + 新建/删除确认）只有一个参数化实现；实体类型差异只存在于定义数据。

- [ ] Skin/Variant 两族 8 文件（List/Editor/View + 两个 VM）合并为参数化实现，实体差异（ID 字段、schema、文案、比较器）收敛为定义对象；Faction/Mission 族评估纳入同一抽象。
- [ ] schema runtime context 统一构建路径：Faction 族的 props 注入与其余三族各自 computed 创建合一为单一来源。
- [ ] 新建对话框校验与错误防线统一为单一模式（VM 层捕获 + 组件层统一反馈），四族一致。
- [ ] config 组件族 props-as-DI 与直接取 store 双路径统一为一种。
- [ ] `ConfigModInfoEditor.vue` 借用 `settings.css` 类名改为通用 page/page-header 类。
- [ ] 跑前端全套检查 + 手工验收四族新建/编辑/删除/外部更新。

### Phase 2.5: 画布编辑器骨架下沉

- [ ] 抽取 `use-canvas-editor` composable：命中检测、镜像轴/光标/选区绘制、选区同步、undo 集成、window 事件三件套、resize 与 inspector 联动；`ShipEditor.vue` 与 `WeaponEditor.vue` 改为复用，现有 `use-canvas-viewport`/`use-canvas-drawing` 并入或作为其依赖。
- [ ] `WeaponFirePreview.vue` 与 WeaponEditor 重复的坐标/贴图字段映射纯函数收敛为同源实现。
- [ ] 4 处 `deep: true, flush: 'sync'` 深度同步 watch 改为显式提交模型：拖拽/输入在动作边界提交 draft 并记录撤销，删除同步深比较。
- [ ] 跑前端全套检查 + 手工验收舰船/武器画布拖拽、镜像、撤销与武器发射预览。

### Phase 2.6: 表格渲染与交互一致性

- [ ] 8 处 v-for index key 改为结构化稳定 key（字段路径/条目 id）；`SchemaFieldRenderer.vue` 的 `removeKvEntry` 手工重排补偿逻辑随之删除。
- [ ] 快捷键统一：单一 shortcut 分发（域命令式，含输入焦点豁免与 Ctrl+S 全局语义），`use-editor-shortcuts`、`EditorWindowContent` 与 `FileEditorContent` 的自写 handler、`use-main-window-shortcuts` 四套合一；键位语义与 Phase 8 规划对齐，不新增键位。
- [ ] JSON 编辑失败处理统一：ObjectEditor、SchemaFieldRenderer、SystemEditor 提交非法 JSON 统一给出 warning/error 反馈，禁止静默吞掉。
- [ ] SystemEditor 内联的额外字段编辑实现删除，复用 `JsonFieldEditor`；评估 `JsonFieldEditor` 归属（schema 模块或 shared/ui 择一）。
- [ ] `WeaponEditor.vue` 事件 `editProjectile` 改 kebab-case `edit-projectile`；naming 规则接线事件命名约束。
- [ ] 评估 `use-table-dom-selection` 的 DOM class 与响应式双轨选中态收敛为响应式唯一来源。
- [ ] 跑前端全套检查 + 手工验收表格选中、kv 字段增删、快捷键与 JSON 编辑。

### Phase 2.7: settings、主题与窗口层归位

- [ ] `settings.store.ts` 拆分：色彩数学下沉 `src/domain` 纯函数；写 DOM 的主题副作用上移 app 层 effect；store 只持状态，输入校验规则下沉 domain。
- [ ] `App.vue` 与 `WindowShell.vue` 复制的 Provider 栈与 settings 持久化/镜像双入口合并为单一 shell 实现（以模式参数区分主窗口/子窗口）。
- [ ] `current.window.ts` 关窗 API 统一为单一 owner；`reloadCurrentWebviewWindow` 命名与实现对齐。
- [ ] `managed.window.ts` 子窗口创建补错误监听与失败反馈；draft/settings 大 JSON 走 URL query 增加长度守卫或改走结构化事件传递。
- [ ] `window-save.orchestrator.ts` 的事件类型 import 统一从 `window.events` 取。
- [ ] `shared/lib/save-command-registry.ts` 迁为正式 store（owner 归 stores/），消除 `m_` 前缀特例。
- [ ] 关闭 Mod 的 5-store 清理序列抽为单一用例函数，`directory-opening.orchestrator.ts` 与 `workspace-lifecycle.orchestrator.ts` 复用。
- [ ] `file-editor.css` 并入 `index.css` 聚合，`main.ts` 恢复单一样式入口。
- [ ] 评估 `DataTable.vue`/`DetailPane.vue` 根层组件归位到 components/ 对应子目录。

### Phase 2.8: schema 资产归一

- [ ] `schemas/*.schema.json` 三种结构统一到 field-schema/v1 单一正式形态（扁平 fields、sections、sources 聚合三选一为基准，其余迁移）。
- [ ] CSV 列 schema（`schemas/csv/*.columns.json`）与 spec schema 统一目录与后缀命名约定。
- [ ] `schema-registry.ts` 与 `csv-column-schema.ts` 合并为单一加载路径；散落的 `as` 强转收敛为唯一入口处的运行时形状校验。
- [ ] schema 消费端（SchemaFormRenderer/SchemaFieldRenderer）只依赖统一加载器的输出类型。
- [ ] 跑前端全套检查 + 手工验收四类配置实体与 CSV 富控件渲染。

### Phase 2.9: 错误语义、命名与一致性收尾

- [ ] 错误类型边界成文并入规则：domain 允许值语义裸 Error；service/orchestrator 必须抛带 action 的 AppError；修正 `write.service.ts` 与 `mod-creation.orchestrator.ts` 中的裸 Error。
- [ ] Pinia store id 统一 kebab-case，naming-boundary 接线。
- [ ] `app-feedback.ts` 工厂与 `use-app-feedback.ts` 的关系成文（工厂 + hook 单一入口），工厂内直取 store 与开窗的行为评估上移。
- [ ] `shared/types` barrel 直引的散点收敛走统一入口。
- [ ] 全仓 grep 复核收尾：死导出、同名同体方法、service 互调为零；三个静态检查脚本全绿。

### Phase 2.10: 测试补强与文档同步

- [ ] 为 EditSession 原语、缓存原语、快捷键分发、schema 统一加载器补 vitest 单元测试。
- [ ] 为保存链路 orchestrators（table-save/config-save/file-save/window-save）补直接测试：事件进出、changeset 提交、失效顺序。
- [ ] Rust 侧保持既有覆盖，variants/skins 合并后以参数化测试覆盖两实体全部行为。
- [ ] 按 workflow.md 事后要求同步 `.zcode/overview.md`、`frontend-guidelines.md`、`backend-guidelines.md`、`module-map.md` 与受影响 `modules/*.md` 契约。
- [ ] 跑前后端全套检查，列出仍需人工确认的运行时行为清单。

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
