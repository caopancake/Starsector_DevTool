# 工作区与启动恢复系统

## 定义

工作区与启动恢复系统管理主窗口工作区状态、工具私有 workspace 持久化和启动时的运行态重建。

## 参考

- `src/app/components/NavSidebar.vue`：消费工作区状态和导航 action，拥有主侧栏入口事件转交。
- `src/app/composables/use-workspace-navigation-actions.ts`：拥有主侧栏导航 composable 对工作区导航编排的唯一暴露。
- `src/app/composables/use-workspace-shell-actions.ts`：拥有主窗口工作区级生命周期、打开目录、恢复、关闭、移除、保存入口和窗口事件监听装配。
- `src/domain/workspace/mod-tree.ts`：拥有已加载 Mod 的模块导航模型、模块计数来源和激活判定。
- `src/orchestrators/open-directory.orchestrator.ts`：拥有目录识别结果进入工作区、ProjectSession 打开、加载态注册、hydrate 和失败回滚。
- `src/orchestrators/workspace-navigation.orchestrator.ts`：拥有 Mod 导航时 workspace、project、table、editor 和 file history 的活动状态同步。
- `src/orchestrators/workspace-persistence.orchestrator.ts`：拥有 workspace 自动保存、启动恢复、恢复期保存暂停和恢复完成写回。
- `src/services/workspace-state.service.ts`：拥有前端 workspace 持久化 service 入口。
- `src/shared/api/workspace-api.ts`：拥有 workspace load/save command 调用形状。
- `src/shared/types/workspace.types.ts`：拥有前端 workspace 运行态和持久化 wire 类型。
- `src/stores/workspace.store.ts`：拥有主窗口 workspace 内存状态、派生状态、持久化投影和列宽状态。
- `src-tauri/src/commands/workspace.rs`：拥有 workspace Tauri command 边界和 payload 拆解。
- `src-tauri/src/models/workspace.rs`：拥有 Rust 侧 workspace 持久化数据结构和序列化语义。
- `src-tauri/src/services/workspace.rs`：拥有工具私有 workspace 文件读取、写入、默认状态和损坏文件错误语义。

## 边界

- ProjectManifest 运行态归 project store 拥有，workspace store 只保存已加载 Mod 条目和活动 Mod root。
- ProjectSession 打开和关闭归 session service 链路拥有，workspace 模块只编排何时调用。
- Rust workspace command 归 command 层拥有，只负责接收 payload、调用 service 和转换错误。
- Rust workspace service 归后端持久化层拥有，只读写工具私有 workspace 文件。
- Workspace column widths 归 workspace store 拥有，只按 modRoot、table、column 的结构化层级持久化。
- Workspace currentView 归 workspace store 拥有，启动恢复完成后由恢复编排明确导航到 overview。
- Workspace 持久化模型归 Rust model 和前端 shared type 共同约束，前端不得把 Rust 明确返回的字段当作缺省字段。
- Workspace 自动保存归 workspace persistence 编排拥有，组件不得直接监听 workspace store 并写盘。
- 打开目录结果归 open-directory 编排拥有，组件只处理 outcome 和反馈。
- 活动 Mod 跨 store 同步归 workspace shell watch 和 workspace navigation 编排拥有，组件不得分别写多个 store。
- 游戏目录概览归 workspace store 拥有，概览中的 Mod 不等于已加载 ProjectSession。
- 加载失败回滚归 open-directory 编排拥有，必须同步清理本次失败 Mod 的跨 store 运行态。
- 关闭工作区目标归 workspace shell 捕获，确认回调只能消费捕获快照。
- 主侧栏模块结构归 workspace domain 拥有，侧栏组件只能渲染模块模型。
- 移除 Mod 归 workspace shell 编排拥有，必须同步清理 workspace、project、tables、editors、CSV draft history、file history 和 session cache。

## 链路

### Mod 导航

1. 用户在主侧栏点击已加载 Mod。
2. 主侧栏组件调用 workspace navigation composable。
3. workspace navigation composable 调用 workspace navigation 编排。
4. workspace navigation 编排校验 workspace store 中存在目标 modRoot。
5. workspace navigation 编排写入 workspace activeModRoot。
6. workspace navigation 编排同步 project activeModRoot。
7. workspace navigation 编排按目标 manifest 激活 tables store。
8. workspace navigation 编排激活 editors store。
9. workspace navigation 编排激活 file history store。
10. 点击表格入口时切换 workspace currentView 到 table 并切换当前表。
11. 点击配置入口时切换 workspace currentView 到 config 并设置 configView。

### Mod 移除

1. 用户请求移除已加载 Mod。
2. workspace shell 检查该 Mod 是否存在未保存 CSV 修改。
3. 需要确认时 workspace shell 打开确认对话。
4. 确认后 workspace shell 读取该 Mod 当前 ProjectSession id。
5. workspace shell 按 session id 清理 query cache 和 resource cache。
6. workspace shell 从 workspace store 移除 Mod 条目、展开状态和列宽。
7. workspace shell 清理 tables store 中该 Mod 状态。
8. workspace shell 清理 editors store 中该 Mod 状态。
9. workspace shell 清理 file history store 中该 Mod 状态。
10. workspace shell 清理 CSV draft history 中该 Mod 状态。
11. workspace shell 清理 project store 中该 Mod manifest。
12. workspace shell 调用 session service 关闭 ProjectSession。

### 打开目录

1. 用户在主窗口触发打开目录。
2. workspace shell 调用目录选择 service。
3. workspace shell 把选中路径和已知 Starsector root 交给 open-directory 编排。
4. open-directory 编排调用目录识别 service。
5. 识别为游戏目录时 open-directory 编排把游戏概览写入 workspace store。
6. 识别为已在游戏目录内的 Mod 时 open-directory 编排先更新游戏概览。
7. 识别为 Mod 时 open-directory 编排检查该 modRoot 是否已加载。
8. 未加载时 open-directory 编排注册 loading Mod 条目并设为活动 Mod。
9. open-directory 编排调用 ProjectSession 打开 service。
10. open-directory 编排把 manifest 写入 project store。
11. open-directory 编排更新 workspace Mod 名称、版本和 ready 状态。
12. open-directory 编排 hydrate tables、editors 和 file history。
13. 打开失败时 open-directory 编排回滚本次 Mod 的跨 store 状态并回到 overview。
14. workspace shell 根据 outcome 写入反馈和 app log。

### 关闭工作区

1. 用户请求关闭工作区。
2. workspace shell 捕获当前 gameOverviewRoot、所有已加载 modRoots 和所有 Starsector roots。
3. workspace shell 根据捕获 modRoots 检查是否存在未保存 CSV 修改。
4. 用户确认关闭工作区。
5. workspace shell 逐个按捕获 modRoots 执行 Mod 移除链路。
6. workspace shell 按捕获 Starsector roots 调用 core cache 失效 service。
7. 捕获的 gameOverviewRoot 仍匹配当前 gameOverview 时 workspace shell 清空游戏概览。
8. workspace shell 在没有活动 Mod 时导航到 overview。
9. workspace shell 写入 app log 和反馈。

### 启动恢复

1. 主窗口 workspace shell 挂载。
2. workspace shell 启动 workspace persistence watcher。
3. workspace shell 启动窗口保存事件监听。
4. workspace shell 通知 persistence watcher 进入恢复期。
5. workspace persistence 编排调用 workspace state service 读取持久化 workspace。
6. workspace state service 调用 shared API。
7. shared API 调用 Rust load workspace command。
8. Rust command 调用 workspace service。
9. workspace service 读取工具私有 workspace 文件；文件缺失时返回默认空工作区。
10. 前端收到持久化 workspace 后写入 workspace store 初始状态。
11. 存在 Starsector root 时重新扫描游戏概览并覆盖旧概览快照。
12. workspace persistence 编排逐个调用 restore workspace Mod 链路重开 ProjectSession。
13. 每个恢复成功的 Mod 更新名称、版本和 ready 状态。
14. 每个恢复失败的 Mod 交给 workspace shell 移除并反馈错误。
15. 持久化 activeModRoot 存在且恢复为 ready 时写回 workspace activeModRoot。
16. workspace persistence 编排导航到 overview。
17. workspace persistence 编排刷新 core fields。
18. workspace shell 结束恢复期。
19. 恢复成功时 persistence watcher 立即写回当前 workspace 状态。

### 自动保存

1. workspace shell 挂载时启动 workspace persistence watcher。
2. watcher 监听 workspace store 的 persisted state 投影。
3. workspace store 状态变化时生成 persisted state。
4. watcher 在非恢复期设置 debounce 保存计时器。
5. 计时器触发后 workspace state service 调用 shared API。
6. shared API 调用 Rust save workspace command。
7. Rust command 从 payload 中取出 state。
8. Rust command 调用 workspace service。
9. workspace service 创建工具私有目录。
10. workspace service 把 workspace state 写入工具私有 workspace 文件。
11. workspace shell 卸载时 watcher 清理计时器并停止监听。

## 规范

- activeModRoot 为空必须使用 null，不得用空字符串表达未选中 Mod。
- ProjectManifest 写入不得隐式切换活动 Mod。
- workspace 文件存在但读取或解析失败时必须返回错误。
- workspace 文件缺失时必须返回默认空工作区。
- workspace 私有状态只能写入工具私有目录。
- workspace 持久化保存打开状态、概览快照、展开状态、活动 Mod、当前视图和列宽，不保存 ProjectSession 数据包。
- workspace 自动保存必须在启动恢复期间暂停。
- workspace 自动保存必须通过 workspace store 的 persisted state 投影生成。
- 打开已加载 Mod 时不得重复打开 ProjectSession。
- 恢复 Mod 必须重新调用当前 ProjectSession 打开链路。
- 恢复完成后主窗口必须进入 overview。
- 恢复失败时不得立即把空运行态覆盖写入 workspace 文件。
- 关闭工作区确认必须使用确认打开时捕获的目标快照。
- 移除 Mod 必须关闭对应 ProjectSession。
- 移除 Mod 必须清理该 Mod 的列宽、cache、project、tables、editors、CSV draft history 和 file history 状态。
- 主侧栏 Mod 树必须由 workspace domain 模型生成模块、计数和激活判定。
- 游戏目录概览和已打开 ProjectSession 必须作为不同状态处理。
- 前端 workspace save command 必须使用 payload 对象作为 wire 边界。
- 列宽持久化必须使用 modRoot、table、column 的结构化层级。

## 陷阱

- 把概览中的 Mod 当作已加载 Mod，会在没有 ProjectSession 时驱动表格、配置或编辑器查询。
- 把恢复期空状态立即写回，会覆盖损坏或暂时无法恢复的 workspace 文件。
- 打开已加载 Mod 时重新打开 ProjectSession，会破坏按 modRoot 隔离的运行态和 history。
- 关闭工作区确认回调重新读取当前 workspace，会关闭与用户确认时不同的 Mod 集合。
- 组件直接同步 project、tables、editors 和 history，会绕过统一活动 Mod 边界。
- 列宽 key 用字符串拼接 modRoot 和 table，会被 Windows 路径分隔符和表 key 边界污染。
- 启动恢复信任旧 ProjectSession 缓存，会绕过当前 parser、manifest 和资源索引。
- 移除 Mod 只删 workspace 条目，会遗留 cache、dirty、history、editor 或 ProjectSession 状态。
- workspace 持久化写入游戏目录或 Mod 目录，会污染用户项目文件。
