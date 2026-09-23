# 应用反馈与日志

## 定义

应用反馈与日志系统统一业务反馈、确认框、错误文件入口、应用日志和工具私有配置维护。

## 参考

`src/app/app-feedback.ts`：反馈工厂 owner，拥有 message/dialog/choose、错误呈现、错误文件引用解析与打开错误文件动作。
`src/app/composables/use-app-feedback.ts`：反馈 hook，唯一允许消费工厂的入口。
`src/services/app-feedback-log.service.ts`：应用日志 service，拥有日志追加、状态查询、日志与配置文件动作，并注册性能日志 sink。
`src/shared/api/app-feedback-log-api.ts`：应用日志 wire API，映射后端日志与配置命令。
`src/shared/lib/feedback-session.ts`：文件引用会话解析纯函数，manifest 会话优先、子窗口自身身份回退。
`src/shared/runtime/performance.ts`：性能日志 sink 注入口，由应用日志 service 注册。
`src/app/composables/use-performance-logger.ts`：业务性能打点 hook。
`src/windows/window-identity.window.ts`：子窗口 URL 会话身份读取，主窗口返回空。
`src-tauri/src/services/app_log.rs`：后端日志 owner，固定日志文件名与目录解析、级别阈值过滤、本地时间渲染与 5MB 单份轮转。
`src-tauri/src/diagnostics.rs`：后端诊断 sink owner，无法触达日志服务的内部层经 `record` 记录，应用启动时安装为 Warning 级应用日志。
`src-tauri/src/services/app_config.rs`：工具私有配置维护 owner，拥有清空配置与清空日志。
`src-tauri/src/commands/app_feedback_log.rs`：应用日志与配置维护 command。

## 边界

- 组件只允许经反馈 hook 获取 `AppFeedback`；非组件代码只允许接收注入的 `AppFeedback` 或使用日志 service。
- 反馈工厂只允许被反馈 hook 消费，由架构规则锚定；工厂内错误文件的 store 读取与窗口打开维持现状。
- warning 与 error 记录应用日志，success 与 info 反馈不记录；info/debug 级日志条目按设置的级别阈值落盘（默认 INFO 阈值丢弃 debug，详细档 DEBUG 全量保留）；日志失败不改变主业务语义。
- 日志条目采用稳定码+参数制：warning/error 必须携带稳定码（如 `mod.scan_warning`、后端 AppError 稳定码），message 仅允许英文短语与数据参数，严禁落中文文案；弹窗文案与日志文本分离。
- 级别阈值来自已保存 settings 的 `logLevel`（默认 INFO）；每次写入单点过滤，前端不做预过滤。
- 降级类内部错误（持久化缓存不可写、锁中毒等）必须经诊断 sink 记录后才能按降级语义继续，严禁静默吞掉。
- 错误文件入口只在路径命中已加载 `modRoot` 且有 `sessionId`（或路径属于当前子窗口自身的会话身份）时启用；否则只提示不显示按钮。
- 每次日志操作从已保存 settings 解析目录：默认 app data 可创建，自定义目录必须已存在且可写。
- 清空配置保留日志；清空日志仅清空内容；两者严禁写 settings、workspace 或 Mod 目标。
- 确认类交互必须走 `AppFeedback` 确认能力；业务代码严禁直接创建 message 或 dialog。

## 链路

### 浮出提示与错误文件入口

1. 业务调用 `feedback.success/info/warning/error`；error 文本由 `formatError` 组装，后端 `{ code, message }` wire 错误经 `shared/lib/error-messages.ts` 的码表映射为用户文案（未映射码回退诊断消息）。
2. 工厂对全部级别文本提取文件引用并解析会话：已加载 manifest 优先，未命中时子窗口自身 `modRoot + sessionId` 身份回退。
3. 工厂渲染主文案；命中文件引用时追加文件位置行（路径与行列后缀）。
4. 会话可解析时附加"打开文件"按钮，点击后按会话与路径打开文件编辑器窗口，contextSeverity 按提示级别映射。
5. 打开失败记录错误日志。

### 应用日志

1. 业务或反馈边界调用日志 service 的 best-effort 记录。
2. 日志 service 组装分级条目并经 wire API 追加到后端日志。
3. 后端写入固定日志文件；失败只吞掉并记录辅助信息。

### 设置页日志与配置维护

1. 设置页 ViewModel 发起日志状态查询、日志清空或配置清空。
2. service 经 wire API 调用后端对应命令。
3. 后端按 settings 解析目录执行；目录缺失时报错且不重建。
4. ViewModel 以确认能力先行确认危险动作，完成后刷新状态与提示。

## 规范

- 反馈工厂必须保持纯组装：message 与 dialog 实例由 hook 注入。
- 浮出提示基线由 WindowShell 的 message provider 承载：全部级别可手动关闭、悬浮暂停倒计时，非 error 级 10 秒自动关闭；error 级由工厂显式传 `duration: 0`，永不自动关闭，只能手动关闭。
- 全部级别提示经工厂统一富渲染：命中文件引用时展示文件位置行，会话可解析时展示"打开文件"按钮；调用方严禁自建时长、关闭或渲染选项。
- 输入校验拒绝（`configEntityIdInvalidMessage`）为 warning 级，携带稳定码 `config.id_invalid` 与出错的 ID 值，严禁以 error 级呈现。
- 错误呈现必须保留原始错误链，格式化时父子消息不得重复拼接。
- warning/error 日志条目必须携带稳定码与可选的文件位置；success/info 反馈严禁产生日志条目。
- 时间戳由后端写入时按本地时区渲染（`YYYY-MM-DD HH:MM:SS.mmm`）；文件达到 5MB 上限时轮转为 `.log.1`（单份历史）。
- 日志写入失败严禁抛出到业务链路，也不得产生递归日志。
- 日志与配置目录解析必须来自已保存 settings，禁止现场推断。
- 日志名固定，严禁按时间或会话改名。
- 敏感信息进入日志前必须脱敏；错误文件入口严禁在未授权路径上启用。

## 陷阱

- 在业务组件直接创建 message 或 dialog 会绕过统一日志与确认边界。
- 在 message 调用上单独传时长、关闭或渲染选项会让呈现基线随调用点漂移。
- 把校验拒绝以 error 级呈现会让永驻浮条随重试累积。
- 把工厂引入多个入口会让反馈行为随消费点漂移。
- 把日志失败向上抛会把可观测性问题变成业务失败。
- 对未加载 Mod 的错误路径显示文件按钮会让恢复窗口写越权目标。
- 清空配置时连日志一起清空会销毁排障证据。
