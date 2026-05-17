# 主窗口撤销 / 重做快捷键机制

## 定义

主窗口撤销 / 重做机制统一处理 Ctrl+Z 和 Ctrl+Shift+Z，先回放当前表格 CSV 草稿历史，再回放文件级 history。

## 边界

- `src/features/undo-redo/composables/use-main-window-shortcuts.ts` 监听主窗口键盘事件。
- `src/features/undo-redo/main-undo-redo-service.ts` 决定 CSV 草稿 history 与文件级 history 的优先级。
- `src/features/tables/tables-edit-history-store.ts` 提供 CSV 草稿 undo/redo。
- `src/features/file-history/file-history-replay-service.ts` 提供文件级 undo/redo。
- `src/app/App.vue` 在主窗口挂载快捷键 composable。

## 规范

- 主窗口快捷键只在主窗口工作。
- 独立编辑器窗口和文件编辑器窗口使用各自局部快捷键。
- Ctrl+Z 优先撤销当前表的 CSV 草稿。
- Ctrl+Shift+Z 优先重做当前表的 CSV 草稿。
- 当前表没有可回放草稿时，才进入文件级 history。
- 文件级 history 回放必须弹窗确认。

## 链路：主窗口 Ctrl+Z

1. `use-main-window-shortcuts.ts` 捕获 Ctrl+Z。
2. composable 调用 `undoMainWindowAction()`。
3. undo service 获取当前 Mod 和当前表。
4. undo service 尝试回放 CSV 草稿撤销。
5. CSV 草稿撤销成功时流程结束。
6. CSV 草稿撤销不可用时调用文件级撤销。
7. 文件级撤销 service 弹窗确认。
8. 用户确认后文件级撤销 service 回放 changeset。

## 链路：主窗口 Ctrl+Shift+Z

1. `use-main-window-shortcuts.ts` 捕获 Ctrl+Shift+Z。
2. composable 调用 `redoMainWindowAction()`。
3. redo service 获取当前 Mod 和当前表。
4. redo service 尝试回放 CSV 草稿重做。
5. CSV 草稿重做成功时流程结束。
6. CSV 草稿重做不可用时调用文件级重做。
7. 文件级重做 service 弹窗确认。
8. 用户确认后文件级重做 service 回放 changeset。
