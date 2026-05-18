# 文件编辑器系统

## 定义

文件编辑器是独立窗口文本编辑器，用于打开任意可编辑文本文件、显示路径和错误上下文、定位行号、保存当前文件。

## 边界

- `src/features/workspace/file-editor-window.ts` 打开单例文件编辑器窗口。
- `src/app/FileEditorApp.vue` 加载、编辑、保存文本，并处理窗口内快捷键。
- `src/shared/api/files-api.ts` 封装 `load_editable_file` 和 `save_text_file_with_history`。
- `src-tauri/src/commands/files.rs` 暴露文本文件读取和保存 command。
- `src-tauri/src/services/file_changes.rs` 读取可编辑文本文件、构建单文件 changeset 并写盘。
- `src/styles/file-editor.css` 承载文件编辑器样式。

## 规范

- 文件编辑器按文件路径单例化。
- 文件编辑器保存只写当前文件。
- 文件编辑器窗口内 Ctrl+Z、Ctrl+Shift+Z 和 ESC 是窗口局部快捷键。
- 文件编辑器保存成功后发送 `file-editor-saved`。
- 主窗口收到保存事件后按文件路径判断是否属于已加载 Mod。
- 同一文件被文件级 history 回放影响时，通过 `file-editor-text-applied` 刷新已打开窗口。

## 链路：打开文件编辑器

1. 用户从错误提示、详情操作或配置页面打开文件编辑器。
2. 文件编辑器窗口 service 按规范化文件路径单例化。
3. 目标窗口已存在时，窗口 service 聚焦已有窗口。
4. 目标窗口不存在时，窗口 service 创建文件编辑器窗口。
5. `FileEditorApp.vue` 调用 `loadEditableFile()`。
6. Rust files command 调用 file changes service 读取 UTF-8 无 BOM 文本。
7. 请求带有错误行信息时，窗口高亮对应行并显示路径和错误消息。

## 链路：文件编辑器保存

1. 用户在文件编辑器窗口点击保存或按 Ctrl+S。
2. `FileEditorApp.vue` 调用 `saveTextFileWithHistory(path, text)`。
3. Rust file changes service 构建单文件 change。
4. Rust file changes service 以 redo 写盘。
5. Rust 返回 `FileChangeRecord[]`。
6. `FileEditorApp.vue` 更新本窗口 original text。
7. `FileEditorApp.vue` 发送 `file-editor-saved`。
8. 主窗口 `window-save-events.ts` 记录文件级 history。
