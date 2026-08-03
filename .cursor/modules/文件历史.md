# 文件历史与变更集

## 定义

记录已写盘 changeset，并以确认后的后端回放实现文件级 undo/redo。

## Owner 与链路

- File History Session 接收成功 `WriteResult`，记录按 `modRoot` 隔离的 changes，并将原始 changeset 交给 ProjectSession 刷新，随后提交 undo/redo 栈。
- 主窗口命令在 CSV 草稿 history 无 entry 时进入 replay；确认 -> Rust changeset replay -> refresh -> 文件编辑器文本同步 -> 移动栈。

## 不变量

- 仅记录实际 changes，不记录前端草稿；回放前/写入前后端重校验所有路径归属与链接父链。
- refresh 或回放失败不移动栈；dirty 文件编辑器只暂存外部文本。history limit 由 settings 输入，不自行读配置。
- 回放与首次保存共用 `FileChangeRecord` 的 before/after 快照；目录事件逐文件展开，因此旧 ID、新 ID 与删除前实体均能精确失效。
