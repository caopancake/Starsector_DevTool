# 目录识别、游戏概览与 ProjectSession 系统

## 定义

目录识别、游戏概览与 ProjectSession 系统把用户选择的目录转换为游戏概览或可查询的 Mod 会话。

## 参考

- `src/app/components/GameOverviewPanel.vue`：消费游戏概览、已加载状态和进入编辑事件，拥有概览页用户入口。
- `src/app/composables/use-workspace-shell-actions.ts`：拥有打开目录、刷新概览、从概览加载 Mod 后的反馈、日志和设置同步。
- `src/orchestrators/open-directory.orchestrator.ts`：拥有目录识别结果到 workspace、project、tables、editors 和 file history 的前端编排。
- `src/services/session.service.ts`：拥有前端 session service 入口、目录选择、性能记录和 shared API 调用。
- `src/shared/api/session-api.ts`：拥有目录识别、游戏概览、ProjectSession 生命周期和失效 command 的调用形状。
- `src/shared/types/query.types.ts`：拥有前端 OpenDirectoryResult、GameOverviewData、GameScanWarning 和 ProjectManifest 类型。
- `src/stores/project.store.ts`：拥有 ProjectManifest map、活动 session 和打开加载态。
- `src/stores/workspace.store.ts`：拥有游戏概览、已加载 Mod 条目、活动 Mod 和概览导航状态。
- `src-tauri/src/commands/project.rs`：拥有目录识别、游戏概览和 ProjectSession command 边界。
- `src-tauri/src/models/command_payloads.rs`：拥有目录识别与 session 打开的 payload 显式 nullable wire 语义。
- `src-tauri/src/models/project.rs`：拥有 Rust 侧目录识别结果、游戏概览、warning 和 ProjectManifest wire 模型。
- `src-tauri/src/services/project/entry.rs`：拥有 ProjectSession 打开入口和成功打开后的性能日志写入。
- `src-tauri/src/services/project/root.rs`：拥有游戏目录判定、Mod 目录判定、Starsector root 推导和游戏概览扫描。
- `src-tauri/src/services/project/session.rs`：拥有 ProjectSession 创建、关闭、manifest 构建、session map 写入和 session 失效。

## 边界

- CSV 行集归后续 query 拥有，ProjectSession 打开链路只返回 manifest 和摘要。
- GameOverviewData 归目录扫描 service 拥有，只包含游戏根、core 可用性、mods 目录、Mod 摘要和 warning。
- OpenDirectoryResult 归目录识别 service 拥有，前端只能按 kind 编排 outcome。
- ProjectManifest 归 session service 构建，前端 project store 只保存返回的 manifest。
- ProjectSession 运行态归 Rust session cache 拥有，前端不得保存 session 内部索引或数据包。
- ProjectSession 打开错误归 Rust open session Result 拥有，前端只负责显示错误和回滚本次加载状态。
- Starsector root 推导归 Rust 目录识别和 session 构建拥有，前端只提交显式 nullable 输入。
- 游戏概览中的 Mod 归 workspace overview 拥有，不代表已经打开 ProjectSession。
- 加载失败回滚归 open-directory 编排拥有，必须清除本次加载产生的跨 store 状态。
- 目录选择归前端 session service 拥有，Rust 目录识别只处理传入路径。
- 目录识别 command 返回目录分类结果，未知目录不是 ProjectSession 打开错误。
- 已加载 Mod 判断归 workspace store 拥有，重复打开时不得重复创建 ProjectSession。
- 表格和实体计数归 Rust manifest 摘要拥有，导航计数不得从 CSV 总行数推导。
- 资源 data URL 和原版资源引用归后续 query 拥有，不得放入游戏概览或 manifest。

## 链路

### 从游戏概览加载 Mod

1. 用户在游戏概览页点击 Mod 打开按钮。
2. 概览组件发出 load-mod 事件。
3. workspace shell 调用从概览加载 Mod 编排。
4. open-directory 编排读取 workspace 中的 starsectorRoot。
5. open-directory 编排检查 modRoot 是否已加载。
6. 未加载时 open-directory 编排注册 loading Mod 条目。
7. open-directory 编排把该 Mod 设置为活动 Mod。
8. open-directory 编排调用 ProjectSession 打开 service。
9. 前端 service 调用 open project session shared API。
10. shared API 调用 Rust open project session command。
11. Rust command 调用 ProjectSession 打开入口。
12. Rust session service 构建 session 和 manifest。
13. Rust session service 把 session 写入 session map。
14. Rust command 返回 ProjectManifest。
15. open-directory 编排把 manifest 写入 project store。
16. open-directory 编排更新 workspace Mod 名称、版本和 ready 状态。
17. open-directory 编排 hydrate tables、editors 和 file history。
18. open-directory 编排导航回 overview。
19. workspace shell 展示加载结果和 manifest warning。

### 刷新游戏概览

1. 用户在游戏概览页点击刷新工作区。
2. workspace shell 读取当前 gameOverview.starsectorRoot。
3. workspace shell 调用 scan workspace overview service。
4. 前端 service 调用 scan game overview shared API。
5. shared API 调用 Rust scan game overview command。
6. Rust command 调用游戏概览扫描 service。
7. Rust service 检查 starsector-core 和 mods 目录。
8. Rust service 遍历 mods 目录项。
9. Rust service 读取每个 Mod 的 mod_info.json 基础元信息。
10. Rust service 收集缺失 core、缺失 mods、目录项读取失败、mod_info 读取失败和重复 id warning。
11. Rust service 按名称排序 Mod 摘要。
12. Rust command 返回 GameOverviewData。
13. workspace shell 把 overview 写入 workspace store。
14. workspace shell 同步 settings 中的 Starsector root。
15. workspace shell 写入日志和反馈。

### 打开目录

1. 用户在主窗口触发打开目录。
2. workspace shell 调用目录选择 service。
3. 前端 dialog 返回目录路径。
4. workspace shell 把目录路径和 settings 中的 Starsector root 交给 open-directory 编排。
5. open-directory 编排调用目录识别 service。
6. 前端 service 调用 detect directory shared API。
7. shared API 调用 Rust detect directory command。
8. Rust command 调用目录识别 service。
9. Rust service 先判断选择目录是否为游戏目录。
10. 游戏目录成立时 Rust service 扫描游戏概览并返回 game-root 结果。
11. 非游戏目录时 Rust service 判断选择目录是否为 Mod 根目录。
12. Mod 根目录成立时 Rust service 推导游戏根并按结果返回 mod-in-game 或 external-mod。
13. 目录无法识别时 Rust service 返回 unknown 结果和 warning。
14. open-directory 编排收到 game-root 时把 overview 写入 workspace store。
15. open-directory 编排收到 mod-in-game 时先更新 overview，再执行 Mod 加载链路。
16. open-directory 编排收到 external-mod 时执行 Mod 加载链路。
17. open-directory 编排收到 unknown 时返回 unknown outcome。
18. workspace shell 根据 outcome 展示反馈、同步 settings 或写入日志。

### 打开外部 Mod

1. open-directory 编排收到 external-mod 结果。
2. open-directory 编排读取 result.modRoot 和 result.starsectorRoot。
3. open-directory 编排检查 modRoot 是否已加载。
4. 未加载时 open-directory 编排注册 loading Mod 条目。
5. open-directory 编排把该 Mod 设置为活动 Mod。
6. open-directory 编排调用 ProjectSession 打开 service。
7. Rust session service 使用传入 Starsector root 或从 Mod 目录推导 root。
8. Rust session service 校验 Starsector root 路径。
9. Rust session service 读取 mod_info、faction、mission、CSV 索引和 spec bundle。
10. Rust session service 生成 manifest 摘要。
11. Rust session service 写入 session map。
12. open-directory 编排写入 project store。
13. open-directory 编排更新 workspace Mod 条目。
14. open-directory 编排 hydrate 当前 Mod 运行态。
15. workspace shell 展示加载结果和 warning。

### 扫描游戏概览

1. Rust scan game overview service 接收 Starsector root。
2. Rust service 构造 mods 目录路径。
3. Rust service 检查 starsector-core 目录是否存在。
4. starsector-core 存在时 Rust service 加入 core 摘要。
5. starsector-core 缺失时 Rust service 记录 core 不可用 warning。
6. Rust service 读取 mods 目录。
7. mods 目录缺失、不可读或目录项读取失败时 Rust service 记录 warning。
8. Rust service 跳过非目录项。
9. Rust service 对缺少 mod_info.json 的 Mod 目录记录 warning。
10. Rust service 读取 mod_info.json 并转换为 GameModSummary。
11. mod_info.json 读取或解析失败时 Rust service 记录 warning。
12. Rust service 按 Mod 名称排序摘要。
13. Rust service 为重复 Mod id 追加 warning。
14. Rust service 返回 GameOverviewData。

## 规范

- knownStarsectorRoot 必须通过 payload 显式传入 null 或字符串。
- mod-in-game 结果必须携带 modRoot，并在可推导游戏根时携带 overview。
- OpenDirectoryResult.kind 必须只表达 game-root、mod-in-game、external-mod 或 unknown。
- ProjectManifest 必须包含 sessionId、modRoot、starsectorRoot、coreAvailable、modInfo、tableSummaries、tableEntitySummaries、entitySummaries 和 warnings。
- ProjectSession 打开必须写入 Rust session map 后再返回 manifest。
- ProjectSession 打开失败必须由前端回滚本次 loading Mod 的跨 store 状态。
- scanGameOverview 只能扫描基础 Mod 元信息和 warning。
- tableEntitySummaries 必须按有效实体数量建模，不能使用 CSV 总行数。
- unknown 目录必须返回 warning，前端必须把 unknown outcome 显示为错误反馈。
- 打开 Mod 只允许返回 ProjectManifest，不得返回完整 CSV 行集、spec map、原版引用全集或图片 data URL。
- 打开已加载 Mod 不得重复创建 ProjectSession。
- 目录识别 command 不得直接写入前端状态或后端 session map。
- 目录识别、游戏概览和 session lifecycle command 必须使用 payload 对象作为 wire 边界。
- 游戏概览扫描必须保留读取失败的路径和底层错误原因。
- 游戏目录判定必须同时要求 starsector-core 和 mods 为目录。
- 外部 Mod 可以携带已知 Starsector root，但不得生成游戏概览。

## 陷阱

- 把 unknown 目录当成 Rust command 错误，会丢失 warning 中的路径和识别语义。
- 把 game overview 的 Mod 摘要当成已加载 manifest，会在没有 sessionId 时触发业务查询。
- 在前端自行推导 Starsector root，会绕过 Rust 路径语义并造成 external-mod 与 mod-in-game 分类不一致。
- 在游戏概览扫描中加载 CSV、spec 或图片，会破坏轻量概览边界。
- 在 manifest 中返回完整数据全集，会让打开 Mod 变成全量加载并污染 query 模块边界。
- 目录识别阶段写入 session map，会让仅浏览游戏目录的用户产生无用 ProjectSession。
- 重复打开已加载 Mod 时重建 session，会让旧窗口、history 和 cache 继续指向旧 session。
- 用 CSV 总行数作为导航实体计数，会把注释行、空行和非实体行计入模块数量。
- 打开失败时只删除 workspace 条目，会遗留 project、tables、editors、history 或 CSV draft 状态。
