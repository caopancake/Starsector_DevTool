# 发射预览模块

## 定义

发射预览是独立窗口，只读取武器、弹体和 CSV 数据来模拟武器发射效果，不保存文件。

## 边界

- `src/features/editors/editor-window.ts` 打开 `kind=weapon-preview` 预览窗口。
- `src/app/EditorWindowApp.vue` 在 weapon-preview kind 下加载 AppData 并挂载 `WeaponFirePreview`。
- `src/features/editors/components/WeaponFirePreview.vue` 承载预览画布和模拟状态。

## 规范

- 发射预览不写磁盘。
- 发射预览不进入文件级 history。
- 发射预览按 `weapon-preview + modRoot + weaponId` 单例化。
- 发射预览使用独立加载的 AppData，不依赖主窗口当前表格草稿。

## 链路：打开发射预览

1. 用户从武器编辑器触发发射预览。
2. `WeaponEditor.vue` emit `preview`。
3. `EditorWindowApp` 调用 `openWeaponPreviewWindow()`。
4. 多窗口机制按 `weapon-preview + modRoot + weaponId` 单例化窗口。
5. 新窗口挂载 `EditorWindowApp`。
6. `EditorWindowApp` 加载 AppData。
7. `EditorWindowApp` 挂载 `WeaponFirePreview`。
