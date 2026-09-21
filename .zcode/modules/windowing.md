# 多窗口机制（模块）

## 定义

集中创建/复用窗口、定义跨窗口事件并协调主窗口保存、refresh 与子窗口同步。

## Owner 与链路

- managed window 拥有 label hash、hidden 创建、显示聚焦与 URL 序列化；业务 window 提供结构化 singleton key、尺寸和参数。创建过程监听 `tauri://created`/`tauri://error` 并以 Promise 结果上抛；URL query 设总长度守卫，draftSnapshot 另设独立上限、超限去掉该参数优雅降级；创建失败由 app 层调用点给出反馈。当前窗口关窗/重载 API 由 `current.window.ts` 单一提供（`closeCurrentWindow`/`reloadCurrentWindow`）。
- 主窗口与子窗口共用唯一 WindowShell：Provider 栈单份，`mode='main'` 跑设置持久化，子窗口跑设置镜像；主题 DOM effect 由 shell 统一挂载。
- event definitions 拥有事件名/payload；主窗口监听保存事件，交 save/history/refresh 编排；子窗口只发已完成写盘事件并消费同步。

## 不变量

- identity 包含完整 session/mod/目标，不能字符串拼接或以 active Mod 补齐；URL 仅省略 null/undefined，保留空字符串。
- handler 错误交注册方；主窗口卸载释放监听。dirty 编辑器/文件窗口只暂存命中外部更新，不能直接覆盖。
- dirty 编辑器/文件窗口必须在标题栏、窗口关闭按钮和 Escape 共用的关闭请求上确认放弃；保护器遇到 dirty 必须立即 `preventDefault`，避免 native close-requested 阻塞 GUI 线程；确认放弃后以允许的 `destroy` 完成同一关闭意图，取消或失败时保持窗口。禁止在确认后重新发起 `close`，也不能绕过 Draft Session 的未保存状态。
