# 弹体编辑器模块

## 定义

弹体编辑器是独立窗口 spec 编辑器，用于编辑单个 `.proj` 文件。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=projectile` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 在 projectile kind 下使用主窗口传入的 session 查询弹体数据并挂载 `ProjectileEditor`。
- `src/app/components/editors/ProjectileEditor.vue` 承载弹体编辑 UI。
- `src/services/editor.service.ts` 调用 spec 保存 API。
- `src-tauri/src/services/project/projectiles.rs` 在 session/entity 查询链路中读取 projectile spec。
- `src-tauri/src/services/editor_specs.rs` 定位并保存 `.proj` JSON-like spec。

## 规范

- 弹体编辑器保存只写对应 `.proj`。
- 弹体数据可来自 Mod 或原版资源回退。
- 弹体窗口保存成功后通过 `editor-spec-saved` 同步主窗口和其它编辑器窗口。
- 弹体窗口加载失败只影响当前窗口。

## 链路：打开弹体编辑器

1. 用户从武器编辑器触发编辑弹体。
2. `WeaponEditor.vue` emit `edit-projectile`。
3. `EditorWindowApp` 调用 `openProjectileEditorWindow()`。
4. 多窗口机制按 `projectile + modRoot + projectileId` 单例化窗口。
5. 新窗口挂载 `EditorWindowApp`。
6. `EditorWindowApp` 使用 `sessionId + projectileId` 查询 projectile entity。
7. `EditorWindowApp` 取得 spec 后挂载编辑器。
8. `EditorWindowApp` 挂载 `ProjectileEditor`。

## 链路：保存弹体 spec

1. 用户在 `ProjectileEditor.vue` 保存。
2. 编辑器调用 spec 保存 service。
3. Rust `save_json_with_history` 定位目标 `.proj`。
4. Rust 写入 pretty JSON 文本。
5. Rust 返回单文件 changeset。
6. `ProjectileEditor.vue` 触发 saved 事件。
7. `EditorWindowApp` 发送 `editor-spec-saved`。
8. 主窗口记录文件级 history 并失效对应 session cache。
