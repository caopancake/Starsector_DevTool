# 目录识别、游戏概览与完整读取系统

## 定义

目录识别系统把用户选择的路径识别成游戏目录、游戏内 Mod、外部 Mod 或未知目录。游戏概览只轻量扫描 Mod 列表；完整读取只针对单个 Mod 加载 CSV、spec、schema 配置 entity、配置和资源。

## 边界

- `src/orchestrators/open-directory.orchestrator.ts` 编排打开目录后的前端状态变化。
- `src/services/project.service.ts` 调用完整项目加载。
- `src/shared/api/project-api.ts` 封装 `detect_directory`、`scan_game_overview`、`load_mod_data` 和 `load_mod_data_with_root`。
- `src-tauri/src/commands/project.rs` 暴露项目相关 command。
- `src-tauri/src/services/project/mod.rs` 实现目录识别、概览扫描和完整加载。
- `src-tauri/src/models/project.rs` 定义 `OpenDirectoryResult`、`GameOverviewData`、`GameModSummary` 和 `AppData`。

## 规范

- 游戏目录以包含 `starsector-core/` 和 `mods/` 为判断依据。
- Mod 目录以 `mod_info.json` 或可推导的 Mod 根目录为判断依据。
- 目录识别先判断用户选择路径是否为 Mod 目录；是 Mod 时再尝试用 `modRoot/../..` 推断游戏目录。
- 游戏概览只扫描 `mods/*/mod_info.json` 和基本元信息，不加载 CSV、spec、schema 配置 entity 和贴图 data URL。
- 完整读取 Mod 时可以使用显式 `starsectorRoot`、路径推断 root 或设置中的回退 root。
- 完整读取 Mod 时返回 `coreReferences` 只读原版引用，供 schema source 和缩略图使用，不混入可编辑表格。
- `coreReferences` 必须包含原版 skin 只读引用，使原版 `skinHullId` 能作为合法 hull 引用参与下拉和缩略图。
- Rust 返回的 `coreAvailable` 只表达原版资源回退是否可用。
- 打开未知目录必须返回错误，由前端显示错误提示。

## 链路：打开目录

1. 用户在主窗口触发打开目录。
2. 前端 dialog 返回目录路径。
3. `openDetectedDirectory()` 调用 `detectDirectory(path, fallbackStarsectorRoot)`。
4. Rust project service 判断目录类型。
5. 返回 `game-root` 时前端写入 game overview。
6. 返回 `mod-in-game` 时前端写入 game overview 并完整读取选中 Mod。
7. 返回 `external-mod` 时前端完整读取选中 Mod。
8. 返回错误时前端显示错误提示。

## 链路：从游戏概览完整读取 Mod

1. 用户在游戏概览页点击某个 Mod 的完整读取动作。
2. 前端调用 `loadProject(modRoot, starsectorRoot)`。
3. Rust 读取该 Mod 的 CSV、spec、配置和资源索引。
4. Rust 返回 `AppData`。
5. project store 写入该 Mod 的 `AppData`。
6. workspace store 在概览中标记该 Mod 已完整读取。
7. 前端允许进入该 Mod 的编辑视图。

## 链路：扫描游戏概览

1. 前端调用 `scanGameOverview(starsectorRoot)`。
2. Rust 检查 `starsector-core` 和 `mods` 目录。
3. Rust 遍历 `mods/*/mod_info.json`。
4. Rust 读取 id、name、version 和 description。
5. Rust 收集缺失、损坏和重复 id warning。
6. Rust 返回 `GameOverviewData`。
7. 前端把结果写入 workspace store。

## 链路：刷新工作区

1. 用户在工作区总览点击刷新工作区。
2. 前端使用当前 `gameOverview.starsectorRoot` 调用 `scanGameOverview()`。
3. Rust 重新扫描游戏目录概览。
4. 前端用新的 `GameOverviewData` 覆盖 workspace store 中的游戏概览。
5. 已完整读取的 Mod 缓存不因刷新概览而自动重新加载。

## 链路：完整读取 Mod

1. 前端调用 `loadProject(modRoot, starsectorRoot?)`。
2. shared API 根据是否有 root 调用 `load_mod_data_with_root` 或 `load_mod_data`。
3. Rust project service 确定有效 `starsectorRoot`。
4. Rust 读取 `mod_info.json`。
5. Rust 读取配置入口、CSV tables、spec bundle、schema 配置 entity、sprite bundle 和只读原版引用。
6. Rust 返回 `AppData`。
7. project store 缓存 `AppData`。
8. tables store hydrate CSV 表格状态。
9. workspace store 注册已加载 Mod。
10. file history store 激活当前 Mod。
