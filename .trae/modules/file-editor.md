# 文件编辑器系统

## 定义

文件编辑器是独立窗口文本编辑器，用于在明确 `modRoot` 边界内打开可编辑文本文件、显示路径和错误上下文、定位行号，并保存当前文件。

## 边界

- `src/windows/file-editor.window.ts` 打开单例文件编辑器窗口。
- `src/app/FileEditorApp.vue` 加载、编辑、保存文本，并处理窗口内快捷键。
- `src/services/files.service.ts` 是文件编辑器读取和保存 shared API 的业务入口。
- `src/shared/api/files-api.ts` 封装 `load_editable_file` 和 `save_text_file`。
- `src-tauri/src/commands/files.rs` 暴露文本文件读取和保存 command。
- `src-tauri/src/services/file_changes.rs` 读取可编辑文本文件、构建单文件 changeset 并写盘。
- `src/styles/file-editor.css` 承载文件编辑器样式。

## 规范

- 文件编辑器按 `modRoot + path` 结构化身份单例化。
- 文件编辑器窗口 URL 文件路径缺失必须以 null 表达，不能把缺失路径压成空字符串。
- 文件编辑器窗口保存目标必须携带打开时的 `sessionId`；缺失 session 时不得保存并广播保存事件。
- 文件编辑器读取和保存 command 必须使用 payload 对象作为 wire 边界，payload 必须携带 `sessionId + modRoot`，command 层只拆出 service 所需业务参数。
- 文件编辑器读取必须携带打开窗口时声明的 `sessionId + modRoot`，Rust 读取前必须校验 `sessionId + modRoot` 仍匹配同一 ProjectSession，并校验当前文件路径归属该 `modRoot`。
- 文件编辑器保存只写当前文件。
- 文件编辑器保存必须携带打开窗口时声明的 `sessionId + modRoot`，Rust 保存前必须校验 `sessionId + modRoot` 仍匹配同一 ProjectSession，并校验当前文件路径归属该 `modRoot`。
- 文件编辑器窗口内 Ctrl+Z、Ctrl+Shift+Z 和 ESC 是窗口局部快捷键。
- 文件编辑器保存成功后发送 `file-editor-saved`，事件必须携带 `sessionId + modRoot + path + WriteResult`。
- 已存在文件编辑器再次被打开时，`file-editor-focus-line` 必须以显式 `null` 清空缺失的上下文字段，不能保留上一次错误行或错误消息。
- 主窗口收到保存事件后按 `sessionId + modRoot` 判断是否属于当前 ProjectManifest。
- 错误反馈只能为归属已加载 Mod 的文件提供文件编辑器入口；不能用缺失 `modRoot` 的请求打开必然无法读取的文件编辑器窗口。
- 同一文件被文件级 history 回放影响时，通过带 `modRoot` 和 path 的 `file-editor-text-applied` 刷新已打开窗口。

## 链路：打开文件编辑器

1. 用户从错误提示、详情操作或配置页面打开文件编辑器。
2. 文件编辑器窗口 service 按 `modRoot + path` 结构化身份单例化。
3. 目标窗口已存在时，窗口 service 聚焦已有窗口。
4. 目标窗口不存在时，窗口 service 创建文件编辑器窗口。
5. `FileEditorApp.vue` 通过 `files.service.ts` 调用 `loadEditableFile(sessionId, modRoot, path)`。
6. Rust files command 校验 `sessionId + modRoot` 和 path 归属后读取 UTF-8 无 BOM 文本。
7. 请求带有错误行信息时，窗口高亮对应行并显示路径和错误消息。

## 链路：文件编辑器保存

1. 用户在文件编辑器窗口点击保存或按 Ctrl+S。
2. `FileEditorApp.vue` 通过 `files.service.ts` 调用 `writeEditableFileText(sessionId, modRoot, path, text)`。
3. Rust files command 校验 `sessionId + modRoot` 后，file changes service 校验 path 归属 `modRoot` 并构建单文件 change。
4. Rust file changes service 以 redo 写盘。
5. Rust 返回 `WriteResult`。
6. `FileEditorApp.vue` 更新本窗口 original text。
7. `FileEditorApp.vue` 发送携带 `sessionId` 的 `file-editor-saved`。
8. 主窗口 `window-save.orchestrator.ts` 记录文件级 history 并等待缓存失效完成。
