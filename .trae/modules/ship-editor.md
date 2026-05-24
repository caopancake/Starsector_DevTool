# 舰船编辑器模块

## 定义

舰船编辑器是独立窗口 spec 编辑器，用于编辑单个 `.ship` 文件的舰体边界、碰撞、武器槽、引擎和内置数据。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=ship` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 只负责按窗口类型挂载编辑器根组件。
- 编辑器 ViewModel 使用主窗口传入的 session 查询舰船数据、候选项和资源。
- `src/app/components/editors/ShipEditor.vue` 承载舰船画布、检查器和局部历史 UI。
- `src/services/editor.service.ts` 封装 entity query、候选 source query、资源批量加载和 spec 保存能力。
- `src/app/composables/use-editor-shortcuts.ts` 承载编辑器通用快捷键辅助。
- `src/shared/api/write-api.ts` 只封装 `save_json_with_history` wire command。
- `src-tauri/src/services/editor_specs.rs` 定位并保存 `.ship` JSON-like spec。

## 规范

- 舰船编辑器保存只写对应 `.ship`。
- 舰船编辑器不隐式保存 `ship_data.csv`。
- 舰船窗口局部 undo/redo 只处理窗口内编辑状态。
- 保存动作由编辑器 ViewModel 调用 service/orchestrator 完成；组件不得直接调用 shared API。
- 保存成功后必须发送 `editor-spec-saved`。
- 主窗口已加载该 Mod 时记录文件级 history 并按变更路径失效 session cache。
- 文件级 history 回放影响同一 `.ship` 时，通过 `editor-spec-applied` 刷新已打开窗口。

## 链路：打开舰船编辑器

1. 用户在主窗口详情操作中触发舰船编辑。
2. 前端调用 `openShipEditorWindow()`。
3. 多窗口机制按 `ship + modRoot + hullId` 单例化窗口。
4. 新窗口挂载 `EditorWindowApp`。
5. 编辑器 ViewModel 使用 `sessionId + hullId` 查询 ship entity。
6. 编辑器 ViewModel 批量查询舰船贴图资源。
7. `EditorWindowApp` 挂载 `ShipEditor`。

## 链路：保存舰船 spec

1. 用户在 `ShipEditor.vue` 保存。
2. 编辑器 ViewModel 调用 spec 保存 service。
3. Rust `save_json_with_history` 定位目标 `.ship`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回单文件 changeset。
6. `ShipEditor.vue` 触发 saved 事件。
7. `EditorWindowApp` 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并失效对应 session cache。
