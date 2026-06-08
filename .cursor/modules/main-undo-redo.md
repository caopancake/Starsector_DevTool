# 主窗口撤销 / 重做快捷键机制

## 定义

主窗口撤销 / 重做快捷键机制负责把主窗口全局键盘输入分派到当前 CSV 草稿 history 或当前 Mod 文件级 history。

## 参考

- `src/app/AppContent.vue`：在主窗口应用内容挂载时接入主窗口快捷键 composable，并把表格工具栏按钮维持在当前 CSV 草稿动作边界。
- `src/app/composables/use-main-window-shortcuts.ts`：拥有主窗口 `keydown` 监听、输入控件过滤、快捷键识别和默认浏览器行为拦截。
- `src/domain/tables/csv-edit-history.ts`：拥有 CSV 草稿历史 entry 对表格草稿状态的 undo/redo 应用规则。
- `src/orchestrators/file-history-replay.orchestrator.ts`：拥有文件级 history peek、确认、changeset 回放、跨窗口文本同步和 session 失效刷新。
- `src/orchestrators/main-undo-redo.orchestrator.ts`：拥有主窗口 Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z 在 CSV 草稿 history 与文件级 history 之间的优先级分派。
- `src/stores/file-history.store.ts`：按 `modRoot` 拥有已写盘文件保存 history 的 undo/redo 栈和栈顶移动。
- `src/stores/project.store.ts`：提供当前 active Mod 根目录和对应 ProjectSession 身份。
- `src/stores/tables-edit-history.store.ts`：按 `modRoot + table` 拥有未保存 CSV 草稿 history 的 undo/redo 栈。
- `src/stores/tables.store.ts`：提供当前表、当前 active Mod 表格状态和表格草稿 undo/redo 状态入口。

## 边界

- CSV 草稿 history 归表格草稿 history store 拥有，主窗口分派只检查当前 `modRoot + currentTable` 是否可 undo/redo。
- Ctrl+Shift+Z 与 Ctrl+Y 都是主窗口重做输入，分派层不得把两者拆给不同 history 系统。
- Ctrl+Z 是主窗口撤销输入，只有未按 Shift 时进入撤销分派。
- 文件级 history 回放归文件 history replay orchestrator 拥有，主窗口分派不直接调用 write service 或 Tauri command。
- 文件级 history 栈归文件 history store 按 `modRoot` 隔离，主窗口分派不得跨 Mod 查找可回放 entry。
- 键盘监听归主窗口快捷键 composable 拥有，orchestrator 不绑定 DOM 事件。
- 输入控件、textarea、select 和 contenteditable 内的键盘事件归控件自身拥有，主窗口快捷键不得拦截。
- 表格工具栏按钮只调用当前 CSV 草稿 undo/redo，不进入文件级 history fallback。
- 主窗口分派只消费 project、tables、CSV 草稿 history 和文件级 history replay 的公开入口，不拥有它们的栈结构或应用算法。
- 主窗口快捷键只在主窗口应用内容挂载时注册，独立编辑器窗口和文件编辑器窗口使用自身窗口内快捷键。
- 失败反馈归被调用的分派或回放入口触发，CSV 草稿应用失败显示 CSV 编辑失败，文件级回放失败显示文件历史失败。
- 磁盘写入、changeset 应用、ProjectSession 失效和跨窗口文本同步归文件级回放链路拥有，快捷键模块不能重写这些副作用。

## 链路

### 主窗口快捷键挂载

1. 主窗口 Vue 根组件挂载全局 provider。
2. 主窗口内容组件创建 app feedback 入口。
3. 主窗口内容组件创建 workspace shell actions。
4. 主窗口内容组件调用 `useMainWindowShortcuts(feedback)`。
5. 快捷键 composable 在 mounted 时向 `window` 注册 `keydown` listener。
6. 快捷键 composable 在 unmounted 时移除同一个 listener。

### Ctrl+Z 撤销分派

1. `window` 收到 `keydown` 事件。
2. 快捷键 composable 检查事件目标是否位于 `input`、`textarea`、`select` 或 contenteditable。
3. 目标属于输入控件时流程结束。
4. 快捷键 composable 识别 `ctrlKey && key === 'z' && !shiftKey`。
5. 快捷键 composable 调用 `event.preventDefault()`。
6. 快捷键 composable 调用 `undoMainWindow(feedback)`。
7. 主窗口分派读取 tables store、CSV 草稿 history store、project store。
8. 主窗口分派读取 `project.activeModRoot` 和 `tables.currentTab`。
9. 当前 `modRoot + table` 存在 CSV 草稿 undo entry 时，分派调用 `undoCsvEdit(modRoot, table, tables.getActiveModTableState())`。
10. CSV 草稿 undo 成功时流程结束。
11. CSV 草稿 undo 失败时显示 `撤销 CSV 编辑失败` 并结束。
12. 当前表没有 CSV 草稿 undo entry 时，分派调用 `replayNextFileUndo(project, tables, feedback)`。
13. 文件级回放入口读取当前 active Mod、sessionId 和文件 history 栈顶。
14. 存在文件级 undo entry 时，文件级回放入口显示确认弹窗。
15. 用户确认后，文件级回放入口重新校验栈顶和 sessionId，再回放 changeset。

### Ctrl+Y / Ctrl+Shift+Z 重做分派

1. `window` 收到 `keydown` 事件。
2. 快捷键 composable 检查事件目标是否位于 `input`、`textarea`、`select` 或 contenteditable。
3. 目标属于输入控件时流程结束。
4. 快捷键 composable 识别 `ctrlKey && (key === 'y' || (key === 'Z' && shiftKey))`。
5. 快捷键 composable 调用 `event.preventDefault()`。
6. 快捷键 composable 调用 `redoMainWindow(feedback)`。
7. 主窗口分派读取 tables store、CSV 草稿 history store、project store。
8. 主窗口分派读取 `project.activeModRoot` 和 `tables.currentTab`。
9. 当前 `modRoot + table` 存在 CSV 草稿 redo entry 时，分派调用 `redoCsvEdit(modRoot, table, tables.getActiveModTableState())`。
10. CSV 草稿 redo 成功时流程结束。
11. CSV 草稿 redo 失败时显示 `重做 CSV 编辑失败` 并结束。
12. 当前表没有 CSV 草稿 redo entry 时，分派调用 `replayNextFileRedo(project, tables, feedback)`。
13. 文件级回放入口读取当前 active Mod、sessionId 和文件 history 栈顶。
14. 存在文件级 redo entry 时，文件级回放入口显示确认弹窗。
15. 用户确认后，文件级回放入口重新校验栈顶和 sessionId，再回放 changeset。

### 表格工具栏撤销重做

1. 主窗口内容组件渲染表格工作区。
2. 表格工作区发出 `undo` 或 `redo` 事件。
3. workspace shell actions 调用 `tables.undoCurrentTableEdit()` 或 `tables.redoCurrentTableEdit()`。
4. tables store 将当前 active Mod、current table 和 active table state 传给 CSV 草稿 history store。
5. CSV 草稿 history store 应用 CSV 草稿 entry 并移动 CSV 草稿栈。
6. CSV 草稿应用失败时 workspace shell actions 显示 CSV 编辑失败。

## 规范

- `event.preventDefault()` 只能在识别到主窗口撤销或重做快捷键后执行，不能阻断其它键盘事件。
- `feedback` 是主窗口快捷键链路唯一 UI 反馈入口，分派层不得直接 import 组件或 Naive UI provider。
- `modRoot` 为空时 CSV 草稿分派不可执行，必须直接进入文件级回放入口，由文件级入口按无 active Mod 返回。
- `tables.currentTab` 是 CSV 草稿优先级判断的表身份，不能用 dirty 表、最近编辑表或文件 history entry 推断当前表。
- CSV 草稿 history 的 undo/redo 不弹文件级确认框，不触发磁盘写入，不调用 ProjectSession invalidation。
- CSV 草稿 history 只在对应方向存在 entry 时优先；不存在 entry 时才进入文件级 history fallback。
- CSV 草稿应用失败表示栈 entry 与当前表格草稿状态不匹配，分派层必须显示错误并停止 fallback。
- 文件级 history fallback 必须通过 `replayNextFileUndo` 或 `replayNextFileRedo`，不能直接移动 file history store 栈。
- 文件级 history 回放必须弹确认框，确认后由文件级回放入口重新校验当前栈顶和 ProjectSession。
- 快捷键 composable 只识别主窗口全局 `Ctrl+Z`、`Ctrl+Y` 和 `Ctrl+Shift+Z`，不承载保存、删除、新建、导航或设置快捷键。
- 快捷键 listener 的注册和注销必须成对发生，不能在每次渲染或每次 active Mod 变化时重复注册。
- 表格工具栏按钮不得进入文件级 history fallback，避免用户点击表格局部撤销时触发磁盘 changeset 回放。
- 主窗口快捷键不得读取或修改独立编辑器窗口、本地文本编辑器窗口或发射预览窗口的局部 undo/redo 栈。

## 陷阱

- 把 Ctrl+Z 直接接到文件级 history，会让未保存 CSV 草稿还在当前表时先回放磁盘 changeset。
- 把输入框内 Ctrl+Z 拦截为主窗口撤销，会破坏字段编辑器、搜索框和表格单元格编辑器的原生编辑行为。
- 在 CSV 草稿应用失败后继续 fallback 到文件级 history，会把一个状态不匹配错误扩大成磁盘写入。
- 在表格工具栏按钮里复用主窗口分派，会让局部 CSV 按钮在无草稿时弹出文件级回放确认。
- 在快捷键分派层直接调用 write service，会绕过文件级回放的确认、栈顶复核、session 校验和窗口同步。
- 用 active table dirty 状态判断是否优先 CSV 草稿，会漏掉可 undo/redo 但当前 dirty 已被抵消的草稿 history。
- 用文件 history store 的 computed active 栈代替 `project.activeModRoot`，会在 active root 同步滞后时回放错误 Mod。
- 让独立窗口共享主窗口快捷键 composable，会把编辑器局部 history 和主窗口 history 混在同一个键盘入口。
