# 工作区与启动恢复系统

## 定义

工作区系统记录当前打开的游戏目录概览、已打开的 ProjectSession、活动 Mod、当前视图和展开状态。启动恢复系统从工具私有 workspace 文件恢复这些状态，并用当前 session 打开链路重新建立运行态。

## 边界

- `src/stores/workspace.store.ts` 是主窗口 workspace 状态源。
- `src/domain/workspace/mod-tree.ts` 定义已加载 Mod 在主侧栏中的模块导航结构、计数来源和激活判定。
- `src/app/composables/use-workspace-shell-actions.ts` 是主窗口 workspace 级组合入口，承接打开目录、保存表格、移除 Mod、窗口事件和详情动作。
- `src/orchestrators/workspace-persistence.orchestrator.ts` 负责 workspace 自动保存和启动恢复。
- `src/orchestrators/open-directory.orchestrator.ts` 负责打开目录后的前端编排。
- `src/orchestrators/workspace-navigation.orchestrator.ts` 负责主侧栏 Mod 导航动作的跨 store 同步。
- `src/shared/api/workspace-api.ts` 调用 Rust workspace command。
- `src-tauri/src/commands/workspace.rs` 暴露 `load_workspace` 和 `save_workspace`。
- `src-tauri/src/services/app_paths.rs` 解析 Tauri app data 目录。
- `src-tauri/src/services/workspace.rs` 读写工具私有 workspace 文件。
- `src-tauri/src/models/workspace.rs` 定义持久化数据结构。

## 规范

- workspace 持久化保存的是打开状态，不保存项目数据包。
- workspace 保存 command 必须使用 payload 对象作为 wire 边界，command 层只拆出 service 所需业务参数。
- `App.vue` 不直接横向编排多个 feature；主窗口用户动作通过 `use-workspace-shell-actions.ts` 调用对应业务模块。
- 启动恢复必须重新调用当前 session 打开流程，不能信任旧缓存。
- 恢复完成后主窗口进入总览视图。
- 启动恢复期间自动保存必须暂停；恢复结束后必须等待当前 workspace 状态写回工具私有 workspace 文件。
- 移除 Mod 时必须同时移除 workspace、project cache、tables、编辑器引用、CSV 草稿历史和文件级 history。
- 移除 Mod 时必须清理该 Mod 的持久化列宽数据。
- 移除 Mod 时必须显式关闭对应 ProjectSession，并清理该 session 的前端资源缓存；移除动作必须等待 ProjectSession 关闭完成。
- 关闭工作区时必须清空游戏目录概览、所有已加载 Mod、project cache、tables、编辑器引用、CSV 草稿历史和文件级 history，并等待 Starsector root 的 core cache 失效完成。
- 游戏目录概览和已打开 ProjectSession 是不同状态；概览中的 Mod 不等于已加载 Mod。
- 主侧栏 Mod 树只能渲染 workspace domain 生成的模块导航模型，不能在组件模板中直接维护表格 key 分组、配置 view 分组、计数来源或激活判定。
- 主侧栏 Mod 导航组件必须通过 workspace navigation composable 调用 workspace navigation orchestrator；orchestrator 同步 workspace、project、tables、编辑器引用和文件级 history 的活动 Mod，再切换目标视图或目标表。
- workspace store 生成游戏目录派生路径时必须使用共享路径工具，不得在 store 内自行拼接路径分隔符。
- workspace 持久化的 currentView 必须使用正式 WorkspaceView 枚举，不得用裸字符串承载主视图语义。
- workspace 持久化模型由 Rust 返回完整结构；前端共享类型不得把已由 Rust 默认化或显式返回的字段建模成可缺省字段。
- workspace 文件缺失时使用默认空工作区；workspace 文件存在但读取或解析失败时必须返回错误，前端不得把损坏状态静默当成空工作区。
- 启动恢复失败时不得立刻把当前空运行态写回 workspace 文件，避免覆盖仍需用户处理的损坏持久化文件。
- workspace 私有状态只能写入工具私有目录，不能写入游戏目录或 Mod 目录。
- 活动 Mod 为空必须使用 `null` 语义，workspace 级编排和按 Mod 隔离的 store 不能用空字符串表示未选中 Mod。

## 链路：启动恢复

1. `App.vue` 挂载 workspace shell actions。
2. `use-workspace-shell-actions.ts` 初始化主窗口生命周期。
3. `workspace-persistence.orchestrator.ts` 调用 `loadWorkspace()`。
4. Rust workspace command 调用 workspace service。
5. workspace service 通过 app paths service 取得工具私有目录。
6. Rust workspace service 读取工具私有 workspace 文件。
7. 前端按持久化的 `starsectorRoot` 重新扫描游戏概览。
8. 前端逐个调用 `restoreWorkspaceMod()`。
9. `restoreWorkspaceMod()` 调用项目 session 打开链路。
10. 加载成功的 Mod 写入 project store、tables store 和 workspace store。
11. workspace store 恢复活动 Mod。
12. workspace store 导航到 `overview`。
13. core fields 加载器刷新全局 core 字段，启动恢复等待刷新完成。
14. workspace 自动保存恢复，并等待当前 workspace 状态写回工具私有 workspace 文件。

## 链路：workspace 自动保存

1. workspace store 状态变化。
2. `workspace-persistence.orchestrator.ts` debounce 监听触发。
3. 前端生成 persisted state。
4. 前端调用 `saveWorkspace()`。
5. Rust workspace command 调用 workspace service。
6. workspace service 通过 app paths service 取得工具私有目录。
7. Rust workspace service 写入工具私有 workspace 文件。

## 链路：主侧栏 Mod 导航

1. 用户在主侧栏点击已加载 Mod 或其模块入口。
2. `NavSidebar.vue` 调用 workspace navigation composable。
3. workspace navigation composable 调用 workspace navigation orchestrator。
4. workspace navigation orchestrator 同步 workspace active mod、project active mod、tables active state、编辑器引用和文件级 history。
5. 点击表格模块时，workspace navigation orchestrator 切换主视图到 CSV 表格并调用 tables store 切换当前表。
6. 点击配置模块时，workspace navigation orchestrator 切换主视图到配置页并设置配置子视图。

## 链路：关闭工作区

1. 用户在工作区总览点击关闭工作区。
2. 前端确认关闭；如果存在未保存 CSV 修改，确认文案必须明确修改会丢失。
3. `use-workspace-shell-actions.ts` 逐个移除已加载 Mod 的所有前端状态并关闭对应 ProjectSession。
4. 前端按 Starsector root 调用 core cache 失效入口。
5. workspace store 清空 `gameOverview` 并回到 `overview`。
6. project、tables、editor、CSV 草稿历史和文件级 history 不再保留该工作区的 Mod 状态。
