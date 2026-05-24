# 目录识别、游戏概览与 ProjectSession 系统

## 定义

目录识别系统把用户选择的路径识别成游戏目录、游戏内 Mod、外部 Mod 或未知目录。游戏概览只做轻量扫描；进入编辑时打开 Rust `ProjectSession` 并返回轻量 manifest。

## 边界

- `src/orchestrators/open-directory.orchestrator.ts` 编排打开目录后的前端状态变化。
- `src/services/session.service.ts` 调用项目 session 打开能力。
- `src/shared/api/session-api.ts` 封装目录识别、游戏概览和 session lifecycle command。
- `src-tauri/src/commands/project.rs` 只暴露 command 桥接。
- `src-tauri/src/services/project/root.rs` 实现目录识别和游戏概览扫描。
- `src-tauri/src/services/project/session.rs` 实现 session 创建和关闭。
- `src-tauri/src/services/project/query/` 实现 session query。
- `src-tauri/src/services/project/mod.rs` 只做模块声明和 re-export。

## 规范

- 游戏目录以包含 `starsector-core/` 和 `mods/` 为判断依据。
- Mod 目录以 `mod_info.json` 或可推导的 Mod 根目录为判断依据。
- 游戏概览只扫描 Mod 基本元信息，不加载 CSV、spec、schema entity 或贴图 data URL。
- 打开 Mod 只返回 `ProjectManifest`，不得返回完整 CSV 行集、spec map、原版引用全集或图片 data URL。
- 原版引用和资源回退由 Rust session / core cache 在 query 时按需提供。
- 打开未知目录必须返回错误，由前端显示错误提示。

## 链路：打开目录

1. 用户在主窗口触发打开目录。
2. 前端 dialog 返回目录路径。
3. `openDetectedDirectory()` 调用 `detectDirectory(path, fallbackStarsectorRoot)`。
4. Rust project service 判断目录类型。
5. 返回 `game-root` 时前端写入 game overview。
6. 返回 Mod 时前端打开 ProjectSession。
7. 返回错误时前端显示错误提示。

## 链路：从游戏概览进入 Mod

1. 用户在游戏概览页点击某个 Mod 的进入编辑动作。
2. 前端调用 `openProject(modRoot, starsectorRoot)`。
3. Rust 创建 session 并返回 manifest。
4. project store 写入 manifest。
5. workspace store 标记该 Mod 已进入编辑。
6. 前端按当前页面继续查询所需数据。

## 链路：扫描游戏概览

1. 前端调用 `scanGameOverview(starsectorRoot)`。
2. Rust 检查 `starsector-core` 和 `mods` 目录。
3. Rust 遍历 `mods/*/mod_info.json`。
4. Rust 读取基础元信息并收集 warning。
5. Rust 返回 `GameOverviewData`。
6. 前端把结果写入 workspace store。
