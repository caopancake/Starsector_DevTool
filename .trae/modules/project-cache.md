# Project / AppData 缓存系统

## 定义

Project 系统是完整读取 Mod 后的前端缓存层。它保存每个 `modRoot` 对应的 `AppData`，供表格、详情、配置页和独立窗口同步使用。

## 边界

- `src/features/project/project-store.ts` 持有 `modsData`、活动 Mod 和加载状态。
- `src/features/project/project-service.ts` 调用 Rust 完整读取。
- `src/shared/types.ts` 定义前端 `AppData`。
- `src-tauri/src/models/project.rs` 定义 Rust `AppData`。
- `src/features/tables/table-save-orchestrator.ts` 在 CSV 保存后同步 AppData 中的表格缓存。
- `src/features/file-history/file-history-replay-service.ts` 在文件级回放后刷新 AppData 中受影响的文件或表格。

## 规范

- `project.store` 是内存缓存，不是磁盘权威。
- `modsData` 必须按 `modRoot` 分开存储。
- spec 保存、文件历史回放和配置保存后可以同步 project cache，但同步本身不等于写盘。
- 独立编辑器窗口自己加载 `AppData`，不直接共享主窗口 project store。
- AppData 对前端保持 camelCase，对 Rust 保持 snake_case 并通过 serde 转换。

## 链路：缓存完整 Mod

1. `project.store.openProject()` 调用 `loadProject()`。
2. `project-service.ts` 调用 shared API。
3. Rust 返回 `AppData`。
4. project store 写入 `modsData[modRoot]`。
5. project store 设置活动 Mod。
6. tables store 从 AppData hydrate 表格。

## 链路：同步已保存 spec

1. 主窗口收到 `editor-spec-saved`。
2. `window-save-events.ts` 调用 `recordEditorSpecSaved()`。
3. `recordEditorSpecSaved()` 更新 project store 对应 spec map。
4. `recordEditorSpecSaved()` 把 changeset 记录进 file history。
