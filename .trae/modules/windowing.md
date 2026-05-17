# 多窗口机制

## 定义

多窗口机制负责创建、单例化和聚焦 Tauri WebviewWindow。它用于文件编辑器、舰船编辑器、武器编辑器、弹体编辑器和发射预览。

## 边界

- `src/features/windowing/managed-window.ts` 是窗口创建和单例化的基础入口。
- `src/features/windowing/window-events.ts` 定义跨窗口事件名和 payload。
- `src/features/windowing/window-save-events.ts` 在主窗口监听保存事件并转交文件级 history。
- `src/features/workspace/file-editor-window.ts` 封装文件编辑器窗口打开请求。
- `src/features/editors/editor-window.ts` 封装 spec 编辑器和发射预览窗口打开请求。
- `src-tauri/capabilities/default.json` 控制窗口创建、聚焦、关闭和事件权限。

## 规范

- 窗口单例 key 必须使用能唯一表达目标资源的业务身份。
- 文件编辑器的单例 key 是文件路径。
- 编辑器窗口的单例 key 是 `kind + modRoot + id`。
- `managed-window.ts` 负责 normalize key、hash label、聚焦已有窗口和创建新窗口。
- 业务模块不能直接 new `WebviewWindow`，必须经由对应窗口 service。
- 已存在窗口再次打开时，必须聚焦已有窗口，并按需要发送 focus event。

## 链路：打开文件编辑器窗口

1. 业务组件调用 `openFileEditorWindow(request)`。
2. `file-editor-window.ts` 把文件路径作为 singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 需要定位错误行时发送 `file-editor-focus-line`。
6. 不存在窗口时创建 `WebviewWindow`。
7. 新窗口通过 `window=file-editor` 挂载 `FileEditorApp`。

## 链路：打开编辑器窗口

1. 主窗口或编辑器窗口调用 `openEditorWindow(request)`。
2. `editor-window.ts` 生成 `kind + modRoot + id` singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 不存在窗口时创建 `WebviewWindow`。
6. 新窗口通过 `window=editor` 挂载 `EditorWindowApp`。
