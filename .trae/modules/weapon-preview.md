# 发射预览模块

## 定义

发射预览是独立窗口，只读取武器、弹体和 CSV 数据来模拟武器发射效果，不保存文件。

## 边界

- `src/windows/editor.window.ts` 打开 `kind=weapon-preview` 预览窗口。
- `src/app/EditorWindowApp.vue` 在 weapon-preview kind 下使用主窗口传入的 session 查询武器和弹体数据并挂载 `WeaponFirePreview`。
- 编辑器 ViewModel 返回发射预览专用数据形状，只包含预览需要的武器、CSV、弹体缓存和贴图数据。
- `src/app/components/editors/WeaponFirePreview.vue` 承载预览画布和模拟状态。

## 规范

- 发射预览不写磁盘。
- 发射预览不进入文件级 history。
- 发射预览按 `weapon-preview + modRoot + weaponId` 单例化。
- 发射预览使用 session query，不依赖主窗口当前表格草稿。
- 发射预览查找 barrel 必须按有效索引返回对应 barrel；无效索引不能静默夹取到其它 barrel。

## 链路：打开发射预览

1. 用户从武器编辑器触发发射预览。
2. `WeaponEditor.vue` emit `preview`。
3. `EditorWindowApp` 调用 `openWeaponPreviewWindow()`。
4. 多窗口机制按 `weapon-preview + modRoot + weaponId` 单例化窗口。
5. 新窗口挂载 `EditorWindowApp`。
6. `EditorWindowApp` 使用 `sessionId + weaponId` 查询武器、弹体和贴图资源。
7. `EditorWindowApp` 挂载 `WeaponFirePreview`。
