# ProjectSession / Manifest 缓存系统

## 定义

ProjectSession 系统是打开 Mod 后的运行态项目边界。Rust 持有项目数据和索引，前端只缓存轻量 `ProjectManifest`，并按当前界面需要发起 query。

## 边界

- `src/stores/project.store.ts` 只保存 `ProjectManifest`、活动 Mod 和加载状态。
- `src/services/session.service.ts` 负责打开 session 并返回 manifest。
- `src/services/write.service.ts` 负责把所有写入入口统一成 `WriteResult`。
- `src/services/resource-cache.service.ts` 负责前端资源 data URL 批量缓存。
- `src/services/query.service.ts` 负责通用 session query。
- `src/services/query-cache.service.ts` 负责统一前端 query cache，key 为 `sessionId + query kind + normalized parameters`。
- `src/shared/api/session-api.ts` 封装 session lifecycle command。
- `src/shared/api/query-api.ts` 封装 session query command。
- `src/shared/api/tables-api.ts` 封装表格写入 command。
- `src/shared/api/files-api.ts` 封装文件读取、文件保存、编辑器保存和 changeset 回放 command。
- `src/shared/api/assets-api.ts` 封装贴图上传和 core 扫描 command。
- `src/shared/api/config-entity-api.ts` 封装配置 entity 写入 command。
- `src-tauri/src/services/project/session.rs` 承载 session 生命周期入口。
- `src-tauri/src/services/project/entry.rs` 承载 command-facing session 打开入口和同级服务效果编排。
- `src-tauri/src/services/project/query/` 承载 session query 入口；`query/mod.rs` 只做子模块声明和 re-export。
- `src-tauri/src/services/project/write/` 承载 session write 入口；`write/mod.rs` 只做子模块声明和 re-export。
- `src-tauri/src/services/project/cache/` 承载 session cache 和 core cache；`cache/mod.rs` 只做 registry、子模块声明和 re-export。
- `src-tauri/src/services/project/model.rs` 承载 ProjectSession 内部模型和通用读写模型。
- `src-tauri/src/services/project/root.rs` 承载目录识别、游戏概览和非 session 根服务。
- `src-tauri/src/services/project/mod.rs` 只做模块声明和 command-facing service re-export。
- session 是内存运行态，不写入配置目录。
- session 生命周期层不依赖同级 app service；打开 session 后的 app log 等同级服务效果只能在 command-facing project entry 编排。

## 规范

- 前端业务代码禁止依赖完整项目数据包。
- 图片 data URL、原版引用和完整 CSV 行集不得进入 `ProjectManifest`。
- `ProjectManifest.tableSummaries` 只暴露已注册 CSV 表格摘要；mission list 属于 Mission entity query 的内部索引，不作为公开表格摘要下发。
- `ProjectManifest.tableSummaries` 对每个已注册公开 CSV 表都必须返回摘要；缺失文件用 `available=false` 表达，不用缺省表 key 表达。
- `ProjectManifest.tableEntitySummaries` 表达已注册 CSV 模块的有效实体数量；侧栏和 Mod 概览必须使用该字段，不能使用 CSV 行数。
- ProjectSession 打开时允许缺失的轻量索引采用空默认值；文件存在但读取或解析失败必须返回错误，不能用默认 manifest、空计数或空集合覆盖损坏状态。
- CSV、entity、source option 和资源都必须通过 session query 获取。
- Query command 中的可空过滤、搜索和限制参数必须显式提交 null，不能依赖缺省字段表达无过滤。
- Query command 中的集合参数必须显式提交数组；没有当前值或限定目标时提交空数组，不能由 service 默认补齐。
- Entity query 的 kind 必须使用正式实体类型模型，不得用裸字符串在前后端各自解释。
- Entity query 返回值必须显式携带 `resourceRefs`；没有资源引用时返回空对象，不得通过缺字段表达。
- `ResourceRef` 只能由 Rust session query 生成；前端只能消费 query 返回的 `ResourceRef`，不得拼接 source、relPath、ownerKind、ownerId 或 key。
- `ResourceRef.source` 必须使用共享的资源来源模型，前后端不得各自维护宽松字符串形状。
- CSV source options、hull references、resource data URLs、entity list 和 entity detail 必须接入统一 query cache。
- 前端 query cache 必须同时覆盖完成值和进行中的同 key query；并发请求同一 `sessionId + query kind + normalized parameters` 时复用同一个 in-flight promise。
- 前端 query cache 的 query kind 是固定缓存语义模型，新增缓存能力必须先进入该模型，再定义对应失效规则。
- Mission 读取属于 entity query，返回 index row、descriptor、mission_text、路径信息和 `resourceRefs.icon`。
- CSV 行右侧预览必须通过 CSV row preview query 获取 `ResourceRef`。
- ship hull 与 skin hull 引用必须通过 hull reference query 获取，前端不得逐 hull 查询 entity 组装候选项。
- 独立编辑器窗口必须使用主窗口传入的 `sessionId`，不得自行重新打开项目。
- 文件保存、history 回放和贴图上传后，只能通过 session invalidation 通知缓存失效。
- 写入链路必须返回 `changes` 和 `invalidatedPaths`；前端缓存清理只能由 `invalidatedPaths` 驱动。
- Rust session invalidation 必须先把 changed path 归类为明确的 session 失效目标，再由失效目标刷新 ProjectSession 内部状态；刷新逻辑不得在操作步骤中分散解析路径语义。
- session cache 按 `sessionId` 和 changed path 精确失效；core cache 按 `starsectorRoot` 显式失效。
- Rust session invalidation 必须按 changed path 的路径段归属刷新对应运行态索引：CSV 路径只清对应表 rows；faction 路径刷新 `faction_files` / `tag_map` 并清已加载 CSV rows；ship / weapon / projectile / system / skill / variant / skin 路径刷新对应 entity/spec 索引和 manifest summary，不能用子串包含把非目标目录误判为目标目录。
- Rust query 读取 CSV rows 必须通过 loaded rows 边界；查询入口在确保加载后如果仍没有 rows，必须返回内部状态错误，不能把未加载状态当成空表。
- Rust session CSV rows 加载入口必须先校验 table 已注册；未知 table 必须返回错误，不能当成“不需要加载”。
- 前端 query cache 写入失效必须按 `ProjectManifest.tableSummaries` 和 changed paths 判定受影响 query；关闭 session 时才允许整 session 清理。
- 前端 query cache 失效读取 query 参数时，缺失参数必须以 null 表达并按保守失效处理，不能用空字符串参与 table、source 或其它业务语义判断。
- 前端 resource cache 写入失效必须按 `ResourceRef.relPath` 和 changed paths 判定受影响资源；关闭 session 时才允许整 session 清理。
- 前端 query cache、resource cache 和文件历史刷新链路必须使用共享路径工具处理路径规范化、根归属和绝对路径判断，不得各自维护路径前缀规则。
- 多 Mod 状态必须按 `sessionId` 和 `modRoot` 隔离。
- 前端复杂页面必须通过 ViewModel 组合 query、cache 和动作；组件不得直接拼接跨层请求数据。
- `shared/api` 只做 Tauri wire adapter，不定义业务可见类型；adapter 文件按 Rust command 模块边界分组，跨层模型统一归属 `src/shared/types` 或 domain。
- service 公开函数只表达业务能力，不暴露 command 名、history 细节或迁移语义。
- orchestrator 函数以用户动作命名，不用 `WithHistory`、`WithFileHistory` 或 `WithUserAction` 表达内部效果。

## 链路：打开 session

1. 前端调用 `openProject(modRoot, starsectorRoot?)`。
2. shared API 调用 `open_project_session`。
3. Rust 创建 `ProjectSession` 并返回 `ProjectManifest`。
4. project store 保存 manifest 并设置活动 Mod。
5. tables store 只接收 manifest summary，不接收完整表格数据。

## 链路：按需查询

1. 界面根据当前 session、表格、实体或资源发起 query。
2. Rust 在 session 中读取对应索引或文件数据。
3. 前端只缓存当前界面需要的结果。
4. 写盘完成后通过 `invalidatedPaths` 清理受影响 query / resource cache，并通过 `invalidate_project_session` 让 Rust session 中受影响数据失效。

## 链路：关闭与失效

1. 移除已加载 Mod 时，前端清理该 session 的资源缓存并调用 `close_project_session`。
2. 保存、窗口保存事件、history 回放和贴图上传后，前端按 changed paths 清理 query cache 和资源缓存，并调用 `invalidate_project_session`。
3. 关闭工作区或切换 Starsector root 时，前端按 root 调用 core cache 失效入口。
4. core cache 失效不替代 session 关闭；session 关闭不替代 core cache 失效。
