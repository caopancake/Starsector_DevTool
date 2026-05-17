# 设置、主题与反馈入口机制

## 定义

设置、主题与反馈入口机制负责全局主题、持久设置、消息提示和确认框入口。

## 边界

- `src/app/settings-store.ts` 持有主题、历史限制、Starsector root 等设置。
- `src/app/app-feedback.ts` 提供 message 和 dialog adapter。
- `src/app/App.vue` 提供 Naive UI provider 和 theme overrides。
- `src/app/SettingsView.vue` 渲染设置页面。
- `src/features/config/components/FileHistoryView.vue` 和 undo-redo service 使用统一 dialog/message 入口。

## 规范

- 组件内反馈优先使用 app provider 注入入口。
- 非组件 service 使用统一 adapter 传入的 message 和 dialog。
- 主题状态必须通过 settings store 和 app 根节点 data theme 驱动。
- 业务 service 不应自行创建不受主题控制的弹窗。
- history limit 由 settings store 提供，CSV 草稿历史和文件级 history 裁剪都读取该设置。

## 链路：显示文件级 history 确认框

1. 主窗口或 FileHistoryView 触发文件级撤销或重做。
2. 调用方把 message 和 dialog 传入 `replayNextFileHistoryEntry()`。
3. replay service 读取目标 history entry。
4. replay service 使用传入 dialog 创建确认框。
5. 用户确认后 replay service 执行回放。
6. replay service 使用传入 message 显示结果。
