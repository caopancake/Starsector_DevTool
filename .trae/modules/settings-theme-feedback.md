# 设置、主题与反馈入口机制

## 定义

设置、主题与反馈入口机制负责全局主题、持久设置、消息提示、错误反馈和确认框入口。

## 边界

- `src/stores/settings.store.ts` 持有主题、历史限制、Starsector root 等设置。
- `src/app/app-feedback.ts` 提供唯一的 `AppFeedback` 入口。
- `src/app/App.vue` 提供 Naive UI provider 和 theme overrides。
- `src/app/components/SettingsPage.vue` 渲染设置页面。
- 业务组件、composable 和 orchestrator 通过 `AppFeedback` 发出消息和确认请求。

## 规范

- 业务代码不得直接使用 Naive UI 的 message、dialog 或 discrete api。
- 组件内反馈必须通过 `useAppFeedback()` 获取。
- 非组件流程必须接收 `AppFeedback` 参数，不得分别传递 message 和 dialog。
- 危险确认、覆盖确认、关闭确认和文件历史回放确认必须走 `AppFeedback` 的 confirm 方法。
- 需要输入字段的新建弹窗可以保留组件内 modal，但提交结果和错误反馈仍必须走 `AppFeedback`。
- 成功 toast 只用于写盘或关键动作；纯内存草稿动作不得弹成功 toast。
- `error` 用于失败、不可继续、写盘、解析和路径边界问题；`warning` 用于可修正输入、重复项、危险确认和非阻断风险。
- 带文件路径或行号的错误必须通过统一错误反馈提供打开文件动作。
- 主题状态必须通过 settings store 和 app 根节点 data theme 驱动。
- 业务 service 不应自行创建消息、弹窗或不受主题控制的反馈 UI。
- history limit 由 settings store 提供，CSV 草稿历史和文件级 history 裁剪都读取该设置。

## 链路：显示文件级 history 确认框

1. 主窗口或 ConfigFileHistoryView 触发文件级撤销或重做。
2. 调用方把 `AppFeedback` 传入 `replayNextFileHistoryEntry()`。
3. file history replay orchestrator 读取目标 history entry。
4. file history replay orchestrator 使用传入 feedback 创建确认框。
5. 用户确认后 file history replay orchestrator 执行回放。
6. file history replay orchestrator 使用传入 feedback 显示结果。
