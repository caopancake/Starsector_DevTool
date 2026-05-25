# 多窗口机制

## 定义

多窗口机制负责创建、单例化和聚焦 Tauri WebviewWindow。它用于文件编辑器、舰船编辑器、武器编辑器、弹体编辑器和发射预览。

## 边界

- `src/windows/managed.window.ts` 是窗口创建和单例化的基础入口。
- `src/windows/window.events.ts` 定义跨窗口事件名和事件数据。
- `src/orchestrators/window-save.orchestrator.ts` 在主窗口监听保存事件并转交文件级 history。
- `src/windows/file-editor.window.ts` 封装文件编辑器窗口打开请求。
- `src/windows/editor.window.ts` 封装 spec 编辑器和发射预览窗口打开请求。
- `src/domain/editors/editor-kind-metadata.ts` 定义编辑器 kind 的标题、spec 扩展名和解析规则。
- `src/app/composables/use-editor-window-view-model.ts` 统一编排编辑器窗口的 entity query、候选项和资源加载。
- `src-tauri/capabilities/default.json` 控制窗口创建、聚焦、关闭和事件权限。

## 规范

- 窗口单例 key 必须使用能唯一表达目标资源的业务身份。
- 文件编辑器的单例 key 是文件路径。
- 编辑器窗口的单例 key 是 `kind + modRoot + id`。
- 编辑器窗口只能使用主窗口传入的 `sessionId + kind + id` 查询数据，不能自行打开项目。
- 编辑器窗口 URL 目标上下文缺失必须以 null 表达，不能把缺失的 session、Mod 路径或目标 id 压成空字符串。
- `managed.window.ts` 只按 `null` / `undefined` 省略 URL 参数，空字符串是调用方显式传入的参数值。
- 编辑器窗口组件只能消费 ViewModel 输出，不得直接拼 entity query、source query 或资源批量请求。
- 编辑器 spec 保存只广播 `editor-spec-saved`，事件必须携带 `WriteResult`；窗口间 spec 同步和主窗口 history 记录都消费同一个保存事件。
- 窗口事件监听器必须支持异步 handler；保存事件处理器声明的 history 记录、缓存失效和后续回调必须在同一 handler 链路中 await。
- 窗口事件异步 handler 失败必须由监听注册方写入 app log，`windows` 适配层只负责事件转发和错误回调，不读取 app 配置。
- `file-editor-focus-line` 按完整上下文覆盖当前文件编辑器状态，缺失的上下文用 `null` 清空。
- `managed.window.ts` 负责 normalize key、hash label、聚焦已有窗口和创建新窗口。
- 业务模块不能直接 new `WebviewWindow`，必须经由对应窗口 service。
- 已存在窗口再次打开时，必须聚焦已有窗口，并按需要发送 focus event。

## 链路：打开文件编辑器窗口

1. 业务组件调用 `openFileEditorWindow(request)`。
2. `file-editor.window.ts` 把文件路径作为 singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 需要定位错误行时发送 `file-editor-focus-line`。
6. 不存在窗口时创建 `WebviewWindow`。
7. 新窗口通过 `window=file-editor` 挂载 `FileEditorApp`。

## 链路：打开编辑器窗口

1. 主窗口或编辑器窗口调用 `openEditorWindow(request)`。
2. `editor.window.ts` 生成 `kind + modRoot + id` singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 不存在窗口时创建 `WebviewWindow`。
6. 新窗口通过 `window=editor` 挂载 `EditorWindowApp`。
