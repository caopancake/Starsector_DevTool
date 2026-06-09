# ProjectSession / Manifest 缓存系统

## 定义

ProjectSession / Manifest 缓存系统以 Rust session 为项目运行态权威，并以前端 manifest registry、query cache 和 resource cache 支撑按需读取。

## 参考

- `src/orchestrators/project-session-refresh.orchestrator.ts`：拥有 WriteResult 到 ProjectSession refresh、完整 manifest 替换、本地 cache 清理和跨窗口失效广播。
- `src/services/query-cache.service.ts`：拥有前端 query cache、pending query 复用、query identity、结构化失效消费和 ViewModel 失效通知。
- `src/services/query.service.ts`：拥有 session query 的业务 service 入口和 query cache 接入。
- `src/services/resource-cache.service.ts`：拥有 ResourceRef data URL 缓存、批量查询结果校验和结构化资源失效消费。
- `src/services/session.service.ts`：拥有 session 打开、关闭、失效和 core cache 失效的前端 service 入口。
- `src/services/write.service.ts`：拥有写入 service 入口到 WriteResult 的统一返回边界。
- `src/shared/api/query-api.ts`：拥有 session query command 的 wire adapter。
- `src/shared/api/session-api.ts`：拥有 session lifecycle、目录识别和 core cache command 的 wire adapter。
- `src/stores/project.store.ts`：拥有前端 ProjectManifest registry、活动 Mod root、活动 session 和加载态。
- `src-tauri/src/services/project/cache/csv.rs`：拥有 Rust session CSV lazy rows、已加载 rows 边界和未知 table 错误语义。
- `src-tauri/src/services/project/cache/invalidation.rs`：拥有 changed path 归属校验、路径分类、session 索引刷新和 manifest summary 更新。
- `src-tauri/src/services/project/cache/mod.rs`：拥有 Rust ProjectSession map、core cache map 和 session/core cache 入口。
- `src-tauri/src/services/project/cache/core.rs`：拥有 core cache key 规范化和 core CSV/spec/source 数据缓存。
- `src-tauri/src/services/project/model.rs`：拥有 Rust ProjectSession、SessionCsvTable、SpecBundle 和 CoreCache 内部模型。
- `src-tauri/src/services/project/query/mod.rs`：拥有 Rust session query service re-export 边界。
- `src-tauri/src/services/project/session.rs`：拥有 ProjectSession 创建、关闭、manifest 构建、session 归属校验和 session 失效入口。

## 边界

- Core cache 归 Rust cache 层拥有，按规范化 starsectorRoot 身份读写。
- ProjectManifest 归 Rust session 构建，前端 project store 只登记、替换和移除完整 manifest。
- ProjectSession 归 Rust session map 拥有，前端不得缓存完整项目数据包或内部索引。
- Query cache 归前端 query cache service 拥有，调用方只能通过 query service 消费缓存能力；完成值按 `sessionId + query kind` 的 LRU 工作集缓存。
- ResourceRef 归 Rust session query 生成，前端不得拼接 source、relPath、ownerKind、ownerId 或 key。
- Resource data URL cache 归前端 resource cache service 拥有，以 sessionId 和 ResourceRef 身份常驻缓存，并在 ProjectInvalidation.session 时按 sessionId 整体清理。
- WriteResult 归写入 service 返回边界拥有，ProjectSession refresh 和缓存失效只能消费 Rust session invalidation 返回的结构化影响。
- changed path 归属校验归前后端共享路径语义和 Rust invalidation 共同拥有，外部绝对路径不得污染当前 session。
- manifest 活动状态归 workspace 导航和 project store 拥有，写入 manifest 不得隐式切换活动 Mod。
- query API 归 shared API adapter 拥有，只描述 Tauri command 调用形状，不定义业务模型。
- session lifecycle API 归 shared API adapter 拥有，只转交 payload，不保存运行态。
- session query 归 Rust query service 拥有，必须从 session map 中读取对应 session。
- session 写入后的运行态刷新归 ProjectSession refresh 编排和 Rust session invalidation 拥有，前端只发 changed paths。
- 资源失效通知归 resource cache invalidation event 拥有，ViewModel 只能按后端 ProjectInvalidation resource scope 和被命中的 ResourceRef 刷新派生状态。
- 结构化失效影响归 Rust session invalidation 生成，前端不得从 changed paths 推断受影响 table、entity、resource 或 hull reference。

## 链路

### 按需查询

1. ViewModel 或业务 service 调用 query service。
2. query service 用 sessionId、query kind 和参数调用 query cache。
3. query cache 生成结构化 cache key。
4. query cache 命中完成值时返回缓存结果。
5. query cache 命中 pending query 时复用同一个 promise。
6. query cache 未命中时调用 shared API。
7. shared API 调用 Rust query command。
8. Rust command 调用 query service。
9. Rust query service 从 session map 读取 ProjectSession。
10. Rust query service 读取 session 索引、lazy CSV rows 或资源数据。
11. Rust command 返回 query 结果。
12. query cache 在 key version 未变化时写入完成值，并按 `sessionId + query kind` 执行 LRU 淘汰。
13. query service 把结果返回调用方。

### 关闭 session

1. workspace shell 移除 Mod 或关闭工作区。
2. 前端按 sessionId 清理 resource cache。
3. 前端按 sessionId 清理 query cache。
4. 前端清理 project store 中对应 modRoot 的 manifest。
5. 前端调用 close project session service。
6. shared API 调用 Rust close project session command。
7. Rust command 调用 session service。
8. Rust session service 从 session map 移除该 sessionId。

### 打开 session

1. Directory Opening 编排调用 session service 打开 Mod。
2. session service 调用 shared API。
3. shared API 调用 Rust open project session command。
4. Rust command 调用 ProjectSession 打开入口。
5. Rust session service 构建 ProjectSession。
6. Rust session service 生成 ProjectManifest。
7. Rust session service 把 ProjectSession 写入 session map。
8. Rust command 返回 ProjectManifest。
9. 前端 project store 登记完整 manifest。
10. tables store 只消费 manifest summary 进行 hydrate。

### 写入后 ProjectSession refresh

1. 写入 service 返回 WriteResult。
2. 保存编排读取 WriteResult.invalidation.paths。
3. ProjectSession refresh 编排按 modRoot 取得当前 manifest。
4. ProjectSession refresh 编排校验 expectedSessionId。
5. ProjectSession refresh 编排过滤属于当前 Mod 的 changed paths。
6. 没有命中当前 Mod 的 changed paths 时，ProjectSession refresh 编排返回保存完成链路错误。
7. ProjectSession refresh 编排调用 ProjectSession 路径刷新 service。
8. shared API 调用 Rust invalidate project session command。
9. Rust session service 从 session map 取得目标 ProjectSession。
10. Rust invalidation 按 changed path 归属得到项目相对路径。
11. Rust invalidation 对路径进行正式目标分类。
12. Rust invalidation 刷新受影响 CSV rows、entity/spec 索引和 manifest summary。
13. Rust command 返回刷新后的 ProjectManifest 和结构化 invalidation。
14. 前端 project store 用返回的完整 manifest 替换对应 modRoot。
15. 前端 resource cache 按结构化 resource 影响清理命中的 mod 资源；session scope 时整 session 清理。
16. 前端 query cache 按 Rust 返回的 queryScopes 清理命中的 query。
17. 前端广播 ProjectSession 失效事件给独立窗口。

### core cache 失效

1. workspace shell 关闭工作区或切换 Starsector root。
2. 前端调用 invalidate core cache service。
3. shared API 调用 Rust invalidate core cache command。
4. Rust command 调用 project session service。
5. Rust cache 层规范化 starsectorRoot。
6. Rust cache 层从 core cache map 移除该 root 的缓存。

### resource data URL 查询

1. 调用方提交 sessionId 和 ResourceRef 列表。
2. resource cache 按 sessionId 与 ResourceRef 生成缓存 key。
3. resource cache 找出未缓存的 ResourceRef。
4. resource cache 复用同 ResourceRef 的 pending 请求。
5. resource cache 对仍缺失的 ResourceRef 调用 shared API。
6. shared API 调用 Rust resource query command。
7. Rust query 返回和请求同序的 data URL entries。
8. resource cache 校验返回 entry 与请求 ResourceRef 完全匹配。
9. resource cache 在 key version 未变化时写入 data URL 或 null。
10. resource cache 按原请求顺序返回 data URL 列表。

## 规范

- changed path 必须拒绝 parent-dir 逃逸和不属于当前 Mod root 的外部绝对路径。
- Core cache key 必须使用规范化后的 starsectorRoot。
- Entity query 返回值必须显式携带 resourceRefs；没有资源引用时返回空对象。
- ProjectManifest.tableEntitySummaries 必须表示有效实体数量，不能表示 CSV 总行数。
- ProjectManifest.tableSummaries 必须覆盖所有已注册公开 CSV 表；缺失文件用 available=false 表达。
- Query command 的可空参数必须显式提交 null。
- Query command 的集合参数必须显式提交数组。
- Query cache key 必须保留 sessionId、query kind 和规范化参数身份。
- Query cache 必须同时缓存完成值和同 key pending promise。
- Query cache 完成值容量必须按 `sessionId + query kind` 约束；pending query 不参与 LRU 淘汰。
- Query cache 失效事件必须携带 query kind、参数身份、sessionId、scope 和 ProjectInvalidation；整 session 清理事件的 ProjectInvalidation 可为空。
- Query cache 只能消费 Rust 返回的 queryScopes，不得按路径、manifest、本地表路径或 source option 业务依赖反推影响。
- Query cache 匹配 `csv-source-options` scope 时必须支持后端声明的 `source` 精确匹配和 `table` 派生匹配；只有二者都为空时才全量失效 source options。
- ResourceRef.source=core 的资源不得被 Mod 写入路径失效清理。
- ResourceRef 只能来自 Rust session query。
- Resource data URL 不得进入 query cache；resource cache 是 data URL 的唯一前端缓存入口。
- Resource cache 必须缓存 null 结果，并在命中 session 或 resource invalidation 后删除。
- Rust session CSV rows 必须经 registered table 校验后 lazy load。
- Rust session invalidation 必须先分类 changed path，再刷新对应索引。
- 写入链路必须返回 changes 和结构化 invalidation；路径失效只存在于 invalidation.paths。
- 写入后必须先刷新 Rust ProjectSession，再替换前端完整 manifest，再清理前端 cache。
- 关闭 session 才允许整 session 清理 query cache 和 resource cache。
- 前端 project store 登记或替换完整 manifest 不得切换 activeModRoot。
- 前端 ViewModel 不得 patch ProjectManifest、modInfo、entitySummaries、tableSummaries 或 tableEntitySummaries。
- 写入成功但 WriteResult.invalidation.paths 没有命中当前 ProjectSession 时必须作为保存完成链路错误处理。
- 独立窗口只能用传入 sessionId 查询和消费失效事件，不得重新打开 ProjectSession。
- 文件保存、history 回放和贴图上传后的 Rust session 刷新由 WriteResult.invalidation.paths 驱动；前端 cache 清理由 Rust session invalidation 返回的 queryScopes 和 resources 驱动，前端不得解释资源路径包含关系。

## 陷阱

- 把完整 CSV、spec map 或图片 data URL 放入 ProjectManifest，会破坏按需 query 边界。
- 把 query cache key 做成字符串前缀，会在参数顺序、sessionId 或 query kind 上产生误清理。
- 把外部绝对路径交给当前 session 失效，会刷新不属于该 Mod 的索引。
- 把 ResourceRef 在前端拼出来，会绕过 Rust 对 core/mod 来源和 owner 身份的权威判断。
- 写入后只清前端 cache 而不刷新 Rust session，会让下一次 query 继续读取旧索引。
- 写入后只刷新 Rust session 而不更新 project store manifest，会让侧栏计数和摘要停留在旧状态。
- 用 ViewModel query 结果反写 ProjectManifest summary，会让 manifest 权威分裂成 Rust refresh 和前端局部推导两套。
- 用任意同 session 路径变化清理所有 entity query，会让独立窗口和复杂页面频繁重查无关数据。
- 用 Mod 写入路径清理 core resource cache，会导致原版资源缓存和 Mod 变更边界混淆。
- 关闭 Mod 时不关闭 Rust session，会遗留可被旧窗口继续查询的 sessionId。
