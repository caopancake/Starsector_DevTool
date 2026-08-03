# 应用反馈与日志

## 定义

统一业务反馈、确认、错误文件入口、应用日志和工具私有配置维护。

## Owner 与链路

- 组件经 `useAppFeedback()`；非组件接收 `AppFeedback`。它拥有 message/dialog/choose、warning/error 的 best-effort 日志和错误文件引用解析。
- `app-feedback-log.service -> shared/api -> command -> app_log/app_config service`；后端拥有固定 `starsector-devtool.log`、打开、清空、状态与工具私有目录维护。
- 错误文件仅在 path 匹配已加载 `modRoot` 且有 `sessionId` 时打开文件编辑器；否则只提示。

## 不变量

- warning/error 记录日志，success/info 不记录；日志失败不改变主业务语义。确认必须走 AppFeedback。
- 每次日志操作从已保存 settings 解析目录：默认 app data 可创建，自定义目录只能已存在且可写；切换不迁移旧日志，失效报错而不回退。system open 只接收后端确认的目标。
- 清配置保留日志；清日志仅清空日志内容；两者绝不写 settings/workspace/Mod。
