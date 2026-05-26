# 舰船编辑器模块

## 定义

舰船编辑器是独立窗口 spec 编辑器，用于编辑单个 `.ship` 文件的舰体边界、碰撞、武器槽、引擎和内置数据。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=ship` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 只负责按窗口类型挂载编辑器根组件。
- 编辑器 ViewModel 使用主窗口传入的 session 查询舰船数据和 `resourceRefs.sprite` 资源。
- 编辑器 ViewModel 返回舰船窗口专用数据形状，不用其它编辑器字段的空对象或空字符串表达“不适用”。
- `src/app/components/editors/ShipEditor.vue` 承载舰船画布、检查器和局部历史 UI。
- `src/services/editor.service.ts` 封装 entity query、候选 source query、资源批量加载和 spec 保存能力。
- `src/app/composables/use-editor-shortcuts.ts` 承载编辑器通用快捷键辅助。
- `src/shared/api/files-api.ts` 封装 `save_editor_spec` wire command。
- `src-tauri/src/services/editor_specs.rs` 按编辑器 spec 类型定位并保存 `.ship` JSON-like spec。

## 规范

- 舰船编辑器保存只写对应 `.ship`。
- 舰船编辑器检查器覆盖所有原版 `.ship` 顶层字段：hullId、hullName、hullSize、style、width、height、spriteName、center、collisionRadius、shieldCenter、shieldRadius、weaponSlots、engineSlots、bounds、builtInMods、builtInWeapons、builtInWings、viewOffset、coversColor、moduleAnchor。
- hullSize 下拉包含 FRIGATE、DESTROYER、CRUISER、CAPITAL_SHIP、FIGHTER 五种尺寸。
- style 和引擎 style 使用 filterable tag 模式：提供常用选项 + 支持输入自定义值。
- 编辑器 spec 保存入口必须使用正式 spec 类型模型，不得用裸字符串在 service 层解析。
- 编辑器 spec 保存定位目标时，候选根不是目录、候选遍历失败、已存在候选 spec 的读取或解析失败都必须返回错误，不能跳过候选后写入默认新路径。
- 舰船编辑器不隐式保存 `ship_data.csv`。
- 舰船窗口局部 undo/redo 只处理窗口内编辑状态。
- 舰船编辑器运行态缺失的选中项、悬停项和拖拽目标必须使用 `null`，不能用空字符串或负数索引表示。
- 编辑器 service 从 entity query 读取舰船数据时，缺失 entity 或非对象 spec 必须作为加载错误暴露，不能压成空对象继续打开编辑器。
- 保存动作由编辑器 ViewModel 调用 service/orchestrator 完成；组件不得直接调用 shared API。
- 保存成功后必须发送 `editor-spec-saved`。
- 主窗口已加载该 Mod 时记录文件级 history 并按变更路径失效 session cache。

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
3. Rust `save_editor_spec` 按 `ship + hullId` 定位目标 `.ship`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回 `WriteResult`。
6. `ShipEditor.vue` 触发 `save-requested`。
7. 编辑器 ViewModel 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并失效对应 session cache。
