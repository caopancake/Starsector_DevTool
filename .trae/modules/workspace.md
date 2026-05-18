# 工作区与启动恢复系统

## 定义

工作区系统记录当前打开的游戏目录概览、已完整读取的 Mod、活动 Mod、当前视图和展开状态。启动恢复系统从工具私有 workspace 文件恢复这些状态，并用当前 parser 重新加载 Mod。

## 边界

- `src/features/workspace/workspace-store.ts` 是主窗口 workspace 状态源。
- `src/features/workspace/workspace-shell-actions.ts` 是主窗口 workspace 级编排入口，承接打开目录、保存表格、移除 Mod、窗口事件和详情动作。
- `src/features/workspace/workspace-persistence.ts` 负责 workspace 自动保存和启动恢复。
- `src/features/workspace/open-directory-service.ts` 负责打开目录后的前端编排。
- `src/shared/api/workspace-api.ts` 调用 Rust workspace command。
- `src-tauri/src/commands/workspace.rs` 暴露 `load_workspace` 和 `save_workspace`。
- `src-tauri/src/services/app_paths.rs` 解析 Tauri app data 目录。
- `src-tauri/src/services/workspace.rs` 读写工具私有 workspace 文件。
- `src-tauri/src/models/workspace.rs` 定义持久化数据结构。

## 规范

- workspace 持久化保存的是打开状态，不保存完整 `AppData`。
- `App.vue` 不直接横向编排多个 feature；主窗口用户动作通过 `workspace-shell-actions.ts` 调用对应业务模块。
- 启动恢复必须重新调用当前项目加载流程，不能信任旧缓存。
- 恢复完成后主窗口进入总览视图。
- 移除 Mod 时必须同时移除 workspace、project cache、tables、编辑器引用、CSV 草稿历史和文件级 history。
- 游戏目录概览和完整读取 Mod 是不同状态；概览中的 Mod 不等于已加载 Mod。
- workspace 私有状态只能写入工具私有目录，不能写入游戏目录或 Mod 目录。

## 链路：启动恢复

1. `App.vue` 挂载 workspace shell actions。
2. `workspace-shell-actions.ts` 初始化主窗口生命周期。
3. `workspace-persistence.ts` 调用 `loadWorkspace()`。
4. Rust workspace command 调用 workspace service。
5. workspace service 通过 app paths service 取得工具私有目录。
6. Rust workspace service 读取工具私有 workspace 文件。
7. 前端按持久化的 `starsectorRoot` 重新扫描游戏概览。
8. 前端逐个调用 `restoreWorkspaceMod()`。
9. `restoreWorkspaceMod()` 调用项目完整加载。
10. 加载成功的 Mod 写入 project store、tables store 和 workspace store。
11. workspace store 恢复活动 Mod。
12. workspace store 导航到 `overview`。
13. core fields 加载器刷新全局 core 字段。

## 链路：workspace 自动保存

1. workspace store 状态变化。
2. `workspace-persistence.ts` debounce 监听触发。
3. 前端生成 persisted state。
4. 前端调用 `saveWorkspace()`。
5. Rust workspace command 调用 workspace service。
6. workspace service 通过 app paths service 取得工具私有目录。
7. Rust workspace service 写入工具私有 workspace 文件。
