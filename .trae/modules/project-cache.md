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
- `src-tauri/src/services/project/session.rs` 承载 session 生命周期入口。
- `src-tauri/src/services/project/query/` 承载 session query 入口；`query/mod.rs` 只做子模块声明和 re-export。
- `src-tauri/src/services/project/write/` 承载 session write 入口；`write/mod.rs` 只做子模块声明和 re-export。
- `src-tauri/src/services/project/cache/` 承载 session cache 和 core cache；`cache/mod.rs` 只做 registry、子模块声明和 re-export。
- `src-tauri/src/services/project/model.rs` 承载 ProjectSession 内部模型和通用读写模型。
- `src-tauri/src/services/project/root.rs` 承载目录识别、游戏概览和非 session 根服务。
- `src-tauri/src/services/project/mod.rs` 只做模块声明和 command-facing service re-export。
- session 是内存运行态，不写入配置目录。

## 规范

- 前端业务代码禁止依赖完整项目数据包。
- 图片 data URL、原版引用和完整 CSV 行集不得进入 `ProjectManifest`。
- CSV、entity、source option 和资源都必须通过 session query 获取。
- `ResourceRef` 只能由 Rust session query 生成；前端只能消费 query 返回的 `ResourceRef`，不得拼接 source、relPath、ownerKind、ownerId 或 key。
- CSV source options、hull references、resource data URLs、entity list 和 entity detail 必须接入统一 query cache。
- Mission 读取属于 entity query，返回 index row、descriptor、mission_text、路径信息和 `resourceRefs.icon`。
- CSV 行右侧预览必须通过 CSV row preview query 获取 `ResourceRef`。
- ship hull 与 skin hull 引用必须通过 hull reference query 获取，前端不得逐 hull 查询 entity 组装候选项。
- 独立编辑器窗口必须使用主窗口传入的 `sessionId`，不得自行重新打开项目。
- 文件保存、history 回放和贴图上传后，只能通过 session invalidation 通知缓存失效。
- 写入链路必须返回 `changes` 和 `invalidatedPaths`；前端缓存清理只能由 `invalidatedPaths` 驱动。
- session cache 按 `sessionId` 和 changed path 精确失效；core cache 按 `starsectorRoot` 显式失效。
- 前端 query cache 和 resource cache 必须随 session invalidation、changed paths、关闭 session 和切换 root 一起清理。
- 多 Mod 状态必须按 `sessionId` 和 `modRoot` 隔离。
- 前端复杂页面必须通过 ViewModel 组合 query、cache 和动作；组件不得直接拼接跨层 payload。

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
4. 写盘完成后通过 `invalidate_project_session` 让受影响数据失效。

## 链路：关闭与失效

1. 移除已加载 Mod 时，前端清理该 session 的资源缓存并调用 `close_project_session`。
2. 保存、history 回放和贴图上传后，前端按 changed paths 清理资源缓存并调用 `invalidate_project_session`。
3. 关闭工作区或切换 Starsector root 时，前端按 root 调用 core cache 失效入口。
4. core cache 失效不替代 session 关闭；session 关闭不替代 core cache 失效。
