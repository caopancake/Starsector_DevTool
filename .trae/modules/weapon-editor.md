# 武器编辑器模块

## 定义

武器编辑器是独立窗口 spec 编辑器，用于编辑单个 `.wpn` 文件的武器 sprite、barrel、slot、render hints、弹体引用和发射预览入口。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=weapon` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 只负责按窗口类型挂载编辑器根组件。
- 编辑器 ViewModel 使用主窗口传入的 session 查询武器 spec、weapon CSV row、候选项和武器 sprite 字段资源。
- 编辑器 ViewModel 返回武器窗口专用数据形状，武器贴图、弹体缓存和候选项只出现在武器编辑器数据中。
- `src/app/components/editors/WeaponEditor.vue` 承载武器画布、检查器和局部历史 UI。
- `src/services/editor.service.ts` 封装 entity query、候选 source query、资源批量加载和 spec 保存能力。
- `src-tauri/src/services/editor_specs.rs` 按编辑器 spec 类型定位并保存 `.wpn` JSON-like spec。

## 规范

- 武器编辑器保存只写对应 `.wpn`。
- 编辑器 spec 保存入口必须使用正式 spec 类型模型，不得用裸字符串在 service 层解析。
- 编辑器 spec 保存定位目标时，候选根不是目录、候选遍历失败、已存在候选 spec 的读取或解析失败都必须返回错误，不能跳过候选后写入默认新路径。
- 武器编辑器不隐式保存 `weapon_data.csv`。
- 武器 entity 列表和详情查询以 `weapon_data.csv` 注册行为准；未注册 ID 必须返回 null，`.wpn` 缺失只表示由注册 CSV 行生成默认武器 spec。
- 武器 entity 查询中 `weapon_data.csv` 的空行和注释行不产生实体；非注释注册行缺少正式 weapon id 必须返回错误，不能静默跳过。
- 保存动作由编辑器 ViewModel 调用 service/orchestrator 完成；组件不得直接调用 shared API。
- 武器编辑器内“编辑弹体”必须打开弹体独立窗口。
- 武器编辑器内“发射预览”必须打开发射预览独立窗口。
- 发射预览是只读窗口，输入来自 weapon entity 返回的 `.wpn` spec、weapon CSV row 和关联 `.proj` spec，不保存 `.wpn`、`.proj` 或 `weapon_data.csv`；光束预览在 CSV 同时存在 `burst size` 和 `burst delay` 时按爆发光束循环显示。
- 编辑器 service 从 entity query 读取武器 spec、CSV row 和关联弹体数据时，非对象数据必须作为加载错误暴露；缺失关联弹体只表示没有可用弹体 spec，不能构造空弹体对象。
- 武器贴图字段和绘制顺序归属 domain 纯模型；编辑器 ViewModel、`WeaponEditor` 和发射预览必须复用同一字段定义。
- 武器窗口局部 undo/redo 只处理窗口内编辑状态。
- 武器窗口接收已加载弹体的 `editor-spec-saved` 同步事件，不能依赖空弹体字段或重新查询整个窗口数据。
- 保存成功后的主窗口同步和文件级 history 记录方式与舰船编辑器相同。

## 链路：打开武器编辑器

1. 用户在主窗口详情操作中触发武器编辑。
2. 前端调用 `openWeaponEditorWindow()`。
3. 多窗口机制按 `weapon + modRoot + weaponId` 单例化窗口。
4. 新窗口挂载 `EditorWindowApp`。
5. 编辑器 ViewModel 使用 `sessionId + weaponId` 查询 weapon entity。
6. Rust weapon entity 返回 `.wpn` spec、weapon CSV row 和按 sprite 字段命名的资源引用。
7. 编辑器 ViewModel 批量查询武器贴图资源。
8. 缺少 `.wpn` spec 时编辑器 ViewModel 使用 weapon CSV row 生成默认 weapon 数据。
9. `EditorWindowApp` 挂载 `WeaponEditor`。

## 链路：保存武器 spec

1. 用户在 `WeaponEditor.vue` 保存。
2. 编辑器 ViewModel 调用 spec 保存 service。
3. Rust `save_editor_spec` 按 `weapon + weaponId` 定位目标 `.wpn`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回 `WriteResult`。
6. `WeaponEditor.vue` 触发 `save-requested`。
7. 编辑器 ViewModel 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并失效对应 session cache。
