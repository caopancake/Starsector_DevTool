# 战术系统编辑器模块

## 定义

战术系统编辑器是独立窗口 spec 编辑器，用于编辑单个 `.system` 文件。采用纯表单折叠区段布局（无画布），支持按系统类型动态显隐条件区段。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=system` 编辑器窗口。
- `src/app/EditorWindowApp.vue` 只负责按窗口类型挂载编辑器根组件。
- 编辑器 ViewModel 使用主窗口传入的 session 查询系统数据。
- 编辑器 ViewModel 返回系统窗口专用数据形状（`SystemEditorEntityBundle`）。
- `src/app/components/editors/SystemEditor.vue` 承载系统编辑 UI。
- `src/services/editor.service.ts` 调用 spec 保存 API。
- `src-tauri/src/services/project/session.rs` 在 session 建立时通过 `load_json_dir_by_id` 加载 `data/shipsystems/*.system`。
- `src-tauri/src/services/editor_specs.rs` 按编辑器 spec 类型定位并保存 `.system` JSON-like spec。
- `src-tauri/src/services/project/cache/invalidation.rs` 在 `.system` 文件变更时刷新 `session.system_files`。

## 规范

- 战术系统编辑器保存只写对应 `.system`。
- 编辑器 spec 保存入口必须使用正式 spec 类型模型（`EditorSpecKind::System`），不得用裸字符串在 service 层解析。
- 编辑器 spec 保存定位目标时，候选根不是目录、候选遍历失败、已存在候选 spec 的读取或解析失败都必须返回错误，不能跳过候选后写入默认新路径。
- 系统数据来自 Mod 目录 `data/shipsystems/*.system`，不含原版资源回退。
- 当 entity query 返回空（`.system` 文件不存在）时，编辑器 ViewModel 弹出选择对话框（新建 / 导入 / 取消）；此行为由所有 spec 编辑器（ship / weapon / projectile / system）共用。
- 保存动作由编辑器 ViewModel 调用 service/orchestrator 完成；组件不得直接调用 shared API。
- 系统窗口保存成功后通过 `editor-spec-saved` 同步主窗口和其它编辑器窗口。
- 系统窗口加载失败只影响当前窗口。
- `type` 字段切换时，组件主动删除不属于新类型的专属字段值；通用字段不被清除。
- 编辑器体区域使用内联 `max-height: calc(100vh - 108px)` 约束高度以确保滚动生效，因为 CSS Grid 嵌套链路在当前 WebView2 下无法正确传递 `1fr` 高度约束。

## 链路：打开战术系统编辑器

1. 用户从 `ship_systems.csv` 表格行详情触发打开编辑器。
2. 主窗口调用 `openSystemEditorWindow()`。
3. 多窗口机制按 `system + modRoot + systemId` 单例化窗口。
4. 新窗口挂载 `EditorWindowApp` → `EditorWindowContent`。
5. 编辑器 ViewModel 使用 `sessionId + systemId` 查询 system entity。
6. 若 entity 存在（`isNew: false`），直接加载 spec 到编辑器。
7. 若 entity 不存在（`isNew: true`），弹出选择对话框：
   - 新建文件：以默认模板 `{ id, type: 'STAT_MOD' }` 打开。
   - 导入已有文件：打开文件选择器（限 `.system`），通过 Rust `load_json_spec_file` 以宽松 JSON 解析，加载内容到编辑器。
   - 取消：关闭编辑器窗口。
8. `EditorWindowContent` 挂载 `SystemEditor`。

## 链路：保存战术系统 spec

1. 用户在 `SystemEditor.vue` 点击保存。
2. 编辑器 ViewModel 调用 `saveEditorSpecByKind(modRoot, 'system', id, data)`。
3. Rust `save_editor_spec` 按 `System + systemId` 定位目标 `.system`。
4. Rust 写入 pretty JSON 文本（`find_json_target` 在 `data/shipsystems/` 目录下按 `id` 字段匹配，未找到时创建 `{id}.system`）。
5. Rust 返回 `WriteResult`。
6. 编辑器 ViewModel 发送 `editor-spec-saved`。
7. 主窗口记录文件级 history 并失效对应 session cache。

## 类型专属字段分组

切换 `type` 时，以下字段随旧类型清除：

| type           | 专属字段                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENGINE_MOD     | engineGlowColor, engineGlowContrailColor, engineGlowLengthMult, engineGlowWidthMult, engineGlowGlowMult, flameoutOnImpactChance, alwaysAccelerate |
| SHIELD_MOD     | shieldRingColor, shieldInnerColor, shieldThicknessMult, shieldFluctuationMult                                                                     |
| PHASE_CLOAK    | effectColor1, effectColor2, phaseHighlight, phaseDiffuse, shipAlpha                                                                               |
| DISPLACER      | range, randomRange, renderCopyDuringTeleport                                                                                                      |
| WEAPON         | weaponDataId                                                                                                                                      |
| DRONE_LAUNCHER | droneVariant, allowFreeRoam, launchSpeed, launchDelay, maxDrones, droneBehavior                                                                   |

通用字段（音效、行为标志、AI 提示、jitter、weaponGlow、damage）不受 type 切换影响。
