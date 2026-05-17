# 武器编辑器模块

## 定义

武器编辑器是独立窗口 spec 编辑器，用于编辑单个 `.wpn` 文件的武器 sprite、barrel、slot、render hints、弹体引用和发射预览入口。

## 边界

- `src/features/editors/editor-window.ts` 打开 `kind=weapon` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 在 weapon kind 下加载 AppData 并挂载 `WeaponEditor`。
- `src/features/editors/components/WeaponEditor.vue` 承载武器画布、检查器、局部历史和保存。
- `src/features/editors/editor-service.ts` 调用 spec 保存 API。
- `src-tauri/src/services/editor_specs.rs` 定位并保存 `.wpn` JSON-like spec。

## 规范

- 武器编辑器保存只写对应 `.wpn`。
- 武器编辑器不隐式保存 `weapon_data.csv`。
- 武器编辑器内“编辑弹体”必须打开弹体独立窗口。
- 武器编辑器内“发射预览”必须打开发射预览独立窗口。
- 武器窗口局部 undo/redo 只处理窗口内编辑状态。
- 保存成功后的主窗口同步和文件级 history 记录方式与舰船编辑器相同。

## 链路：打开武器编辑器

1. 用户在主窗口详情操作中触发武器编辑。
2. 前端调用 `openWeaponEditorWindow()`。
3. 多窗口机制按 `weapon + modRoot + weaponId` 单例化窗口。
4. 新窗口挂载 `EditorWindowApp`。
5. `EditorWindowApp` 调用 `loadProject(modRoot, starsectorRoot?)`。
6. `EditorWindowApp` 从 `appData.wpnFiles[weaponId]` 取 spec。
7. 缺少 spec 时 `EditorWindowApp` 使用 CSV 行生成默认 weapon 数据。
8. `EditorWindowApp` 挂载 `WeaponEditor`。

## 链路：保存武器 spec

1. 用户在 `WeaponEditor.vue` 保存。
2. 编辑器调用 spec 保存 service。
3. Rust `save_json_with_history` 定位目标 `.wpn`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回单文件 changeset。
6. `WeaponEditor.vue` 触发 saved 事件。
7. `EditorWindowApp` 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并同步 project cache。
