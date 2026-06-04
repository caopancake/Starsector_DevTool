# 弹体编辑器模块

## 定义

弹体编辑器是独立窗口 spec 编辑器，用于编辑单个 `.proj` 文件。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=projectile` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 只负责按窗口类型挂载编辑器根组件。
- 编辑器 ViewModel 使用主窗口传入的 session 查询弹体数据和资源。
- 编辑器 ViewModel 返回弹体窗口专用数据形状，不用其它编辑器字段的空对象表达“不适用”。
- `src/app/components/editors/ProjectileEditor.vue` 承载弹体编辑 UI。
- `src/services/editor.service.ts` 调用 spec 保存 API。
- `src-tauri/src/services/project/projectiles.rs` 在 session/entity 查询链路中读取 projectile spec。
- `src-tauri/src/services/editor_specs.rs` 按编辑器 spec 类型定位并保存 `.proj` JSON-like spec。

## 规范

- 弹体编辑器保存只写对应 `.proj`。
- 编辑器 spec 保存入口必须使用正式 spec 类型模型，不得用裸字符串在 service 层解析。
- 编辑器 spec 保存入口必须在候选目录扫描、目标路径构造和 changeset 构建前校验目标 ID 是可移植文件名 ID。
- 编辑器 spec 保存定位目标时，候选根不是目录、候选遍历失败、已存在候选 spec 的读取或解析失败都必须返回错误，不能跳过候选后写入默认新路径。
- 导入已有编辑器 spec 文件必须提交正式 spec 类型和文件路径，Rust 按类型校验扩展名并拒绝包含 `..` 的路径后再读取。
- 弹体数据可来自 Mod 或原版资源回退。
- 编辑器 service 从 entity query 读取弹体数据时，缺失 entity 或非对象 spec 必须作为加载错误暴露，不能压成空对象继续打开编辑器。
- 保存动作由编辑器 ViewModel 调用 service/orchestrator 完成；组件不得直接调用 shared API。
- 弹体窗口保存成功后通过携带 `sessionId + modRoot + kind + id + WriteResult` 的 `editor-spec-saved` 同步主窗口和其它编辑器窗口。
- 弹体窗口收到主窗口广播的 session 路径失效后，必须清理本窗口 query/resource cache，并重新查询当前弹体 bundle。
- 弹体窗口加载失败只影响当前窗口。

## 链路：打开弹体编辑器

1. 用户从武器编辑器触发编辑弹体。
2. `WeaponEditor.vue` emit `edit-projectile`。
3. `EditorWindowApp` 调用 `openProjectileEditorWindow()`。
4. 多窗口机制按 `projectile + modRoot + projectileId` 单例化窗口。
5. 新窗口挂载 `EditorWindowApp`。
6. 编辑器 ViewModel 使用 `sessionId + projectileId` 查询 projectile entity。
7. 编辑器 ViewModel 取得 spec 后挂载编辑器。
8. `EditorWindowApp` 挂载 `ProjectileEditor`。

## 链路：保存弹体 spec

1. 用户在 `ProjectileEditor.vue` 保存。
2. 编辑器 ViewModel 调用 spec 保存 service。
3. Rust `save_editor_spec` 按 `projectile + projectileId` 定位目标 `.proj`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回 `WriteResult`。
6. `ProjectileEditor.vue` 触发 saved 事件。
7. `EditorWindowApp` 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并失效对应 session cache。
