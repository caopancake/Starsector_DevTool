# 多窗口机制

## 定义

多窗口机制负责创建、单例化和聚焦 Tauri WebviewWindow。它用于文件编辑器、舰船编辑器、武器编辑器、弹体编辑器和发射预览。

## 边界

- `src/windows/managed.window.ts` 是窗口创建和单例化的基础入口。
- `src/windows/window.events.ts` 定义跨窗口事件名和事件数据。
- `src/orchestrators/window-save.orchestrator.ts` 在主窗口监听保存事件并转交文件级 history。
- `src/orchestrators/sprite-upload.orchestrator.ts` 发起贴图上传并广播贴图写入结果。
- `src/orchestrators/project-session-invalidation.orchestrator.ts` 广播已完成的 ProjectSession 路径失效给独立窗口。
- `src/windows/file-editor.window.ts` 封装文件编辑器窗口打开请求。
- `src/windows/editor.window.ts` 封装 spec 编辑器和发射预览窗口打开请求。
- `src/domain/editors/editor-kind-metadata.ts` 定义编辑器 kind 的标题、spec 扩展名和解析规则。
- `src/app/composables/use-editor-window-view-model.ts` 统一编排编辑器窗口的 entity query、候选项和资源加载。
- `src-tauri/capabilities/default.json` 控制窗口创建、聚焦、关闭和事件权限。

## 规范

- 窗口单例 key 必须使用能唯一表达目标资源的业务身份。
- 文件编辑器的单例 key 是 `modRoot + path` 的结构化身份。
- 编辑器窗口的单例 key 是 `kind + modRoot + id` 的结构化身份，不能用分隔符拼接。
- 编辑器窗口只能使用主窗口传入的 `modRoot + sessionId + kind + id` 查询数据，不能自行打开项目。
- 主窗口打开编辑器窗口时必须使用发起动作携带的完整窗口目标，不能用当前 active Mod 补齐 `modRoot` 或 `sessionId`。
- 编辑器窗口 URL 目标上下文缺失必须以 null 表达，不能把缺失的 session、Mod 路径或目标 id 压成空字符串。
- `managed.window.ts` 只按 `null` / `undefined` 省略 URL 参数，空字符串是调用方显式传入的参数值。
- 编辑器窗口组件只能消费 ViewModel 输出，不得直接拼 entity query、source query 或资源批量请求。
- 编辑器 spec 保存只广播 `editor-spec-saved`，事件必须携带 `sessionId + modRoot + kind + id + WriteResult`；窗口间 spec 同步和主窗口 history 记录都消费同一个保存事件。
- 文件编辑器保存只广播 `file-editor-saved`，事件必须携带 `sessionId + modRoot + path + WriteResult`；主窗口 history 记录和 session 失效必须消费同一个保存事件身份。
- 独立编辑器窗口贴图上传只广播 `sprite-upload-saved`，事件必须携带 `sessionId + modRoot + filename + overwritten + WriteResult`；主窗口 history 记录和 session 失效必须消费同一个保存事件身份。
- 主窗口完成写入后的 Rust session 刷新和本窗口 cache 失效后，必须广播 `project-session-invalidated`；独立编辑器窗口收到后只清理本窗口 query/resource cache，并由本地 ViewModel 按失效 query 身份刷新受影响数据。
- 编辑器窗口因本窗口 query cache 失效重查 bundle 时，资源失效必须按当前 bundle 实际持有的 `ResourceRef` 身份匹配，不能因同 session 内无关资源 query 失效重查当前编辑器。
- 编辑器窗口收到当前 bundle 资源 data URL 失效时，只能刷新贴图 data URL 字段；不得重查 spec/entity bundle 或重置子编辑器本地草稿。
- 编辑器窗口的派生依赖失效必须按字段刷新：资源失效刷新资源字段，武器窗口 projectile 列表失效刷新候选项，已加载 projectile 详情失效刷新 projectileSpecs；只有主编辑实体失效才能重查完整 bundle。
- 编辑器窗口缺失 spec 的导入结果只能在原 query 请求和窗口目标仍匹配时写入当前 bundle；文件选择、导入读取或确认期间发生的新 query 必须让旧导入结果失效。
- 窗口事件监听器必须支持异步 handler；保存事件处理器声明的 history 记录、缓存失效和后续回调必须在同一 handler 链路中 await。
- 主窗口处理编辑器保存事件前必须确认事件 `sessionId + modRoot` 仍匹配当前 ProjectManifest，不能把旧 session 的保存事件记录到新 session 的 history 或失效链路。
- 主窗口处理文件编辑器保存事件前必须确认事件 `sessionId + modRoot` 仍匹配当前 ProjectManifest，不能把旧 session 的保存事件记录到新 session 的 history 或失效链路。
- 主窗口处理贴图上传事件前必须确认事件 `sessionId + modRoot` 仍匹配当前 ProjectManifest，不能把旧 session 的二进制 changeset 记录到新 session 的 history 或失效链路。
- 窗口事件异步 handler 失败必须由监听注册方写入 app log，`windows` 适配层只负责事件转发和错误回调，不读取 app 配置。
- `file-editor-focus-line` 按完整上下文覆盖当前文件编辑器状态，缺失的上下文用 `null` 清空。
- `managed.window.ts` 负责 normalize key、hash label、聚焦已有窗口和创建新窗口。
- 业务模块不能直接 new `WebviewWindow`，必须经由对应窗口 service。
- 已存在窗口再次打开时，必须聚焦已有窗口，并按需要发送 focus event。

## 链路：打开文件编辑器窗口

1. 业务组件调用 `openFileEditorWindow(request)`。
2. `file-editor.window.ts` 生成 `modRoot + path` 结构化 singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 需要定位错误行时发送 `file-editor-focus-line`。
6. 不存在窗口时创建 `WebviewWindow`。
7. 新窗口通过 `window=file-editor` 挂载 `FileEditorApp`。

## 链路：打开编辑器窗口

1. 主窗口或编辑器窗口调用 `openEditorWindow(request)`。
2. `editor.window.ts` 生成 `kind + modRoot + id` 结构化 singleton key。
3. `openManagedWindow()` 规范化 key 并计算窗口 label。
4. 已存在同 label 窗口时调用 `setFocus()`。
5. 不存在窗口时创建 `WebviewWindow`。
6. 新窗口通过 `window=editor` 挂载 `EditorWindowApp`。

## 链路：跨窗口 session 失效

1. 任一窗口写盘后产生 `WriteResult.invalidatedPaths`。
2. 主窗口保存监听链路调用 Rust session invalidation，更新 manifest，并清理主窗口资源缓存和 query cache。
3. 主窗口广播 `project-session-invalidated`，事件携带更新后的 manifest 和 changed paths。
4. 独立编辑器窗口按事件中的 manifest 和 changed paths 清理本窗口资源缓存和 query cache。
5. 编辑器 ViewModel 收到本窗口 query cache 失效事件后，主实体/spec query 失效才重新查询当前 `sessionId + kind + id` 的 editor bundle；资源 data URL、projectile 列表和已加载 projectile detail 失效只刷新当前 bundle 的对应派生字段。
