# 文件编辑器系统

## 定义

文件编辑器系统负责在独立窗口内读取、编辑和保存当前 Mod 边界内的单个 UTF-8 文本文件。

## 参考

- `src/app/FileEditorApp.vue`：拥有文件编辑器窗口根组件，挂载窗口壳和文件编辑器内容。
- `src/app/FileEditorContent.vue`：拥有文件编辑器 UI、URL 参数读取、行号滚动同步、局部快捷键和窗口关闭入口。
- `src/app/app-feedback.ts`：拥有错误反馈中的文件引用解析和错误文件编辑器打开入口。
- `src/app/composables/use-file-editor-view-model.ts`：拥有文件读取、Edit Target Draft Session 文本草稿会话、窗口局部 undo/redo、保存、focus-line 事件和 text-applied 事件处理。
- `src/app/composables/use-text-history.ts`：拥有文件编辑器 textarea 的窗口局部 undo/redo。
- `src/app/composables/use-workspace-shell-actions.ts`：拥有显式文件编辑请求到文件编辑器窗口请求的主窗口入口。
- `src/domain/tables/table-detail-actions.ts`：拥有表格行详情动作的结构化模型、关联 spec 文本文件入口和专用编辑器窗口入口。
- `src/main.ts`：拥有按 URL `window=file-editor` 挂载文件编辑器窗口根组件的入口。
- `src/orchestrators/file-editor-window.orchestrator.ts`：拥有文件编辑器保存、定位行和文本应用窗口事件的 emit/listen 封装。
- `src/orchestrators/file-history-session.orchestrator.ts`：拥有主窗口接收文件编辑器保存事件后的 history 记录、ProjectSession refresh 和保存完成边界。
- `src/orchestrators/file-save.orchestrator.ts`：拥有主窗口保存事件到 File History Session 的转交入口。
- `src/orchestrators/window-save.orchestrator.ts`：拥有主窗口监听 file-editor-saved 事件的生命周期。
- `src/services/files.service.ts`：拥有文件编辑器读取和保存的业务 service 入口。
- `src/shared/api/files-api.ts`：拥有 `load_editable_file` 和 `save_text_file` Tauri command 的前端 API 封装。
- `src/styles/file-editor.css`：拥有文件编辑器独立窗口样式。
- `src/windows/file-editor.window.ts`：拥有文件编辑器窗口请求模型、单例 identity、URL 参数和 focus-line 事件数据。
- `src/windows/managed.window.ts`：拥有按 singletonKey 哈希生成窗口 label、复用已有窗口和创建新窗口的通用窗口机制。
- `src/windows/window.events.ts`：拥有 file editor 相关窗口事件 payload 类型。
- `src-tauri/src/commands/file_editor.rs`：拥有文件编辑器读取和保存 command，并在读写前校验 `sessionId + modRoot`。
- `src-tauri/src/services/file_editor.rs`：拥有 Mod 内文本文件读取、单文件 text changeset 构建、Mod 路径归属校验和写盘。

## 边界

- CSS 边界属于 `file-editor.css`；文件编辑器布局、行号 gutter、错误上下文和文本区域样式不得散落到组件内联样式。
- 内容区文件身份展示归 FileEditorContent 拥有，主标题显示文件名，主路径显示 Mod 内相对路径，绝对路径只作为辅助信息。
- Error feedback 入口只能为能归属到已加载 Mod 的文件打开文件编辑器；无法归属 modRoot 或没有 sessionId 时只能显示错误消息。
- File editor 窗口身份按 `sessionId + modRoot + path` 单例化；同一 ProjectSession 内相同文件再次打开只能聚焦已有窗口并发送 focus-line 事件。
- File editor 保存边界是单个打开文件；保存 command 只写 URL 中携带的 file path，不写关联文件、CSV、配置 entity 或目录。
- File editor 状态 owner 是文件编辑器 ViewModel；文本 base、文本 draft、dirty、外部文本暂存、loading、saving、上下文信息和局部 undo/redo 不进入全局 store。
- File editor 文本草稿归 Edit Target Draft Session；ViewModel 只用目标草稿会话动作载入、保存、取消和应用外部文本。
- File editor 窗口局部 undo/redo 归 Text History；它只记录 textarea 文本快照，不拥有 base 或 pending external。
- File history 边界属于主窗口保存事件处理；文件编辑器窗口只发送保存事件，不直接记录 file history。
- ProjectSession 边界来自窗口打开时传入的 sessionId；读取和保存都必须使用该 sessionId，不得在子窗口重新读取主窗口 active session。
- Rust 文件编辑读写边界属于 file editor service；前端不得直接读取磁盘文本、写文件或绕过 path 归属校验。
- Settings 边界来自主窗口传入的 settings snapshot；文件编辑器子窗口启动时不能自行读取工具私有 settings。
- Text replay 边界来自文件级 history 回放事件；文件编辑器只在 `sessionId + modRoot + path` 同时匹配时消费回放文本，dirty 时必须暂存外部文本而不是覆盖 textarea。
- URL 参数边界属于窗口创建请求；缺失 file、modRoot 或 sessionId 时 ViewModel 只报错，不发起读写。
- Window event 边界属于 file-editor-window orchestrator；组件和 ViewModel 不直接使用裸事件名。
- 上下文定位边界是提示和行高亮；focus-line 事件只更新 message、label、severity 和 targetLine，不重新读取文件。
- 入口边界来自错误反馈、表格详情关联 spec action 或其它显式文件编辑请求；关联 spec 路径推导归表格详情 action domain，文件编辑器只消费传入 path。
- 窗口局部 undo/redo 只回放当前文本草稿；它不等同于文件级 history，也不写盘。

## 链路

### 应用挂载

1. 窗口启动后，前端入口读取 URL search params。
2. 前端入口读取 `window` 参数。
3. `window=file-editor` 时，前端入口选择文件编辑器窗口根组件。
4. 子窗口入口从 URL `settings` 参数解析主窗口传入的 settings snapshot。
5. 前端入口初始化 settings store。
6. 前端入口创建 Vue app 并挂载文件编辑器窗口根组件。
7. 前端入口显示当前窗口。

### 打开文件编辑器窗口

1. 主窗口从错误反馈、表格详情 action 或其它显式文件编辑请求获得 file editor request。
2. 主窗口调用 `openFileEditorWindow()`，请求携带 modRoot、path、sessionId、title、上下文信息和 settings snapshot。
3. 文件编辑器窗口 service 用 `[sessionId, modRoot, path]` 生成 singletonKey。
4. managed window service 规范化 singletonKey 并生成窗口 label。
5. 已存在相同 label 窗口时，managed window service 显示并聚焦已有窗口。
6. 已存在窗口且请求带 focus event 时，managed window service 向该窗口发送 file-editor-focus-line 事件。
7. 不存在相同 label 窗口时，managed window service 把非 null URL 参数写入新窗口 URL。
8. managed window service 创建文件编辑器 WebviewWindow。

### 读取文件

1. 文件编辑器内容组件从 URL 读取 file、modRoot、sessionId、title、context 和 line 参数。
2. 文件编辑器内容组件创建文件编辑器 ViewModel。
3. 组件 mounted 后调用 ViewModel initialize。
4. ViewModel 校验 filePath、modRoot 和 sessionId 均存在。
5. ViewModel 设置 loading。
6. ViewModel 调用 files service 读取可编辑文件。
7. files service 调用 shared API。
8. shared API 调用 Rust `load_editable_file` command。
9. Rust command 校验 `sessionId + modRoot`。
10. Rust file editor service 校验 path 是 modRoot 内绝对路径。
11. Rust file editor service 按 UTF-8 无 BOM 读取文本。
12. Rust 返回 path 和 text。
13. ViewModel 通过 Edit Target Draft Session 把返回文本写入当前文件目标的 base 和 draft。
14. ViewModel 清空窗口局部 undo/redo 栈。
15. ViewModel 清空外部文本暂存。
16. ViewModel 释放 loading。

### 编辑与窗口局部撤销

1. 用户在 textarea 输入文本。
2. 文件编辑器内容组件把 textarea value 传给 ViewModel updateText。
3. ViewModel 在文本变化时把旧 text 压入 undo 栈。
4. ViewModel 清空 redo 栈。
5. ViewModel 更新当前 text。
6. 用户按 Ctrl+Z 时，窗口局部快捷键调用 ViewModel undoEdit。
7. ViewModel 把当前 text 压入 redo 栈，并从 undo 栈恢复上一个文本快照。
8. 用户按 Ctrl+Shift+Z 时，窗口局部快捷键调用 ViewModel redoEdit。
9. ViewModel 把当前 text 压入 undo 栈，并从 redo 栈恢复下一个文本快照。

### 保存文件

1. 用户点击保存或按 Ctrl+S。
2. 文件编辑器内容组件调用 ViewModel saveFile。
3. ViewModel 校验 filePath、modRoot 和 sessionId 均存在。
4. ViewModel 拒绝 loading 或 saving 中的重复保存。
5. ViewModel 设置 saving。
6. ViewModel 调用 files service 保存当前 text。
7. files service 调用 write service。
8. write service 调用 shared API `save_text_file`。
9. Rust command 校验 `sessionId + modRoot`。
10. Rust file editor service 校验 path 归属 modRoot。
11. Rust file editor service 构建单文件 text change。
12. Rust file editor service 以 redo 方向写盘并返回 `WriteResult`。
13. ViewModel 通过 Edit Target Draft Session 保存当前文件目标，并在保存事件发送成功后把已保存 text 提升为 base。
14. ViewModel 清空外部文本暂存。
15. ViewModel 已发送 file-editor-saved 事件，事件携带 modRoot、path、sessionId 和 WriteResult。
16. ViewModel 显示保存成功反馈。
17. ViewModel 释放 saving。

### 主窗口接收保存事件

1. 主窗口 workspace actions mounted 后启动窗口保存事件监听。
2. window-save orchestrator 监听 file-editor-saved 事件。
3. 主窗口收到事件后调用 file save orchestrator。
4. file save orchestrator 把 event.modRoot、event.sessionId、WriteResult 和文件名 label 交给 File History Session。
5. File History Session 读取 event.modRoot 当前 manifest。
6. manifest 不存在或 sessionId 不匹配时，File History Session 以保存完成链路错误返回。
7. `writeResult.changes` 为空时，主窗口不记录 history。
8. 写入结果有效时，File History Session 按文件名记录一条文件级 history。
9. File History Session 按 `writeResult.invalidation.paths` 刷新 ProjectSession 和前端缓存。

### 文件历史回放同步

1. 文件级 history 回放写盘和 ProjectSession refresh 成功后，File History Session 根据回放 direction 从 FileChangeRecord 取 beforeText 或 afterText。
2. File History Session 跳过目录 changeset。
3. File History Session 跳过只有二进制内容的文件 change。
4. File History Session 发送 file-editor-text-applied 事件，携带 sessionId、modRoot、path 和 text。
5. 文件编辑器 ViewModel 收到 text-applied 事件。
6. ViewModel 校验事件 sessionId 与当前窗口 sessionId 相等。
7. ViewModel 校验事件 modRoot 与当前窗口 modRoot 规范化后相等，且 path 与当前窗口 filePath 规范化后相等。
8. 匹配成功且当前不 dirty 时，ViewModel 用事件 text 重置当前 text snapshot。
9. ViewModel 通过 Edit Target Draft Session 把事件 text 提升为当前文件目标的 base。
10. ViewModel 清空窗口局部 undo/redo 栈和外部文本暂存。
11. 匹配成功且当前 dirty 时，ViewModel 只暂存事件 text 并显示外部文本更新提示，不覆盖 textarea。
12. 用户点击载入外部文本时，ViewModel 通过 Draft Session 载入暂存文本，清空 dirty、暂存和窗口局部 undo/redo，并保留错误上下文与目标行。

### 定位上下文更新

1. 相同文件编辑器窗口再次被打开。
2. managed window service 聚焦已有窗口。
3. managed window service 发送 file-editor-focus-line 事件。
4. 文件编辑器 ViewModel 收到 focus-line 事件。
5. ViewModel 更新 contextMessage、contextLabel、contextSeverity 和 targetLine。
6. 文件编辑器内容组件根据 targetLine 滚动并高亮对应行。

## 规范

- `FileEditorFocusLineEvent` 的 line、message、contextLabel 和 contextSeverity 必须允许 null，用 null 清空旧上下文。
- `FileEditorSavedEvent` 必须携带 modRoot、path、sessionId 和完整 WriteResult。
- `FileEditorTextAppliedEvent` 必须携带 sessionId、modRoot、path 和 text。
- 子窗口 settings 必须来自 URL 中的主窗口 settings snapshot；缺失 snapshot 时子窗口启动失败。
- 打开文件编辑器窗口时，file 参数必须是明确文件路径；缺失路径不能压成空字符串。
- 普通文件编辑器入口不得用文件名伪造上下文卡；上下文卡只用于错误定位或带行号定位的信息。
- 打开已有文件编辑器窗口时，新的上下文必须通过 focus-line 事件覆盖旧上下文。
- 文件编辑器 dirty 判断只能来自 Edit Target Draft Session。
- 文件编辑器读取失败不得改写当前文件目标 base。
- 文件编辑器保存失败不得改写当前文件目标 base，不得发送 file-editor-saved 事件。
- 文件编辑器保存成功必须在写盘和 file-editor-saved 事件发送成功后提升 base 并清空外部文本暂存。
- 文件编辑器窗口局部 undo/redo 必须在 load、cancel、载入外部文本和非 dirty text-applied snapshot 后清空。
- 文件编辑器窗口局部快捷键只作用于当前窗口；Esc 关闭当前 webview window，Ctrl+S 保存当前文件。
- 文件编辑器读取和保存 payload 必须携带 `sessionId + modRoot + path`。
- 表格详情打开关联 spec 文本文件时，路径只是 UI 导航目标，读取和保存安全仍由 Rust 文件 IO 边界校验。
- 文件编辑器只能读取 Rust 认定为 UTF-8 无 BOM 的文本文件。
- 主窗口处理 file-editor-saved 时必须通过 File History Session 校验 event.sessionId 仍等于当前 manifest sessionId。
- 主窗口只在 writeResult.changes 非空时请求 File History Session 记录文件级 history 和刷新 ProjectSession。
- Rust 读取和保存前必须校验 path 是 modRoot 内绝对路径，且 path 和 modRoot 不包含父级跳出。
- 同一文件被文件级 history 回放影响时，只有 `sessionId + modRoot + path` 同时匹配的文件编辑器窗口才能消费新文本；dirty 窗口只能暂存新文本并提示。
- 二进制文件回放不得通过 file-editor-text-applied 写入文件编辑器文本状态。
- 文件编辑器不得直接调用 shared API；读取保存必须通过 files service。

## 陷阱

- 把文件编辑器窗口身份只设为 path，会让不同 Mod 中同名路径复用同一个窗口。
- 子窗口重新读取当前 active Mod 或 active session，会在主窗口切换 Mod 后读写错误目标。
- 保存成功前提交 Draft Session base，会把失败写盘误标记为已保存。
- 保存事件缺少 sessionId，会让主窗口无法阻止旧窗口保存污染新 ProjectSession 的 history。
- 文件历史回放时不校验 modRoot 和 path，会把其它文件的磁盘回放文本覆盖当前编辑草稿。
- 文件历史回放命中 dirty 文件编辑器时直接覆盖 textarea，会丢失未保存文本草稿。
- 把二进制回放内容发给文件编辑器，会把不可编辑资源污染成文本。
- 复用已有窗口时不发送 null 上下文字段，会保留上一次错误行和错误消息。
- 绕过 Rust 路径归属校验直接读取或保存文件，会允许编辑 Mod 外文件。
- 把窗口局部 undo/redo 接入文件级 history，会把未写盘文本草稿误当作磁盘 changeset。
- 在缺失 file、modRoot 或 sessionId 时继续发起读写，会把错误延后成不可定位的 command 失败。
