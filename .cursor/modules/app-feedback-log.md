# 应用反馈与日志入口机制

## 定义

应用反馈与日志入口机制负责业务反馈抽象、确认对话、错误文件入口、应用日志和工具私有配置维护动作。

## 参考

- `src-tauri/src/commands/app_config.rs`：暴露日志追加、日志状态、日志打开、配置目录打开、清配置和清日志 command。
- `src-tauri/src/models/app_config.rs`：定义 `AppLogEntry`、日志等级和日志状态的 wire 模型。
- `src-tauri/src/services/app_config.rs`：拥有配置目录打开和清空配置文件规则，清空配置时保留日志文件。
- `src-tauri/src/services/app_log.rs`：拥有 `starsector-devtool.log` 追加、清空、状态读取、打开和 CRLF 日志行渲染。
- `src/app/app-feedback.ts`：拥有 `AppFeedback` 的 message/dialog 适配、错误日志记录、错误文件引用解析和打开错误文件入口。
- `src/app/composables/use-app-feedback.ts`：从 Naive UI provider 创建业务反馈入口。
- `src/app/composables/use-settings-view-model.ts`：在设置页编排配置目录、日志状态、日志打开、清配置和清日志动作。
- `src/services/app-feedback-log.service.ts`：向前端业务层暴露应用日志和配置维护入口。
- `src/shared/api/app-feedback-log-api.ts`：封装日志和配置维护相关 Tauri command payload。
- `src/shared/types/app-log.types.ts`：定义前端应用日志等级、日志条目和日志状态 wire 类型。

## 边界

- `AppFeedback` 是业务层 message、dialog、choose、危险确认、警告确认和错误反馈的唯一抽象入口。
- `AppLogEntry` 归工具私有日志系统拥有，业务层只能提交 level、message、path、line，不拥有日志文件路径。
- `app feedback log service` 只暴露日志和配置维护动作，不读取或保存 settings。
- `app config API` 只封装 Tauri command 形状，不承载日志文案、错误文件入口或清理决策。
- `app feedback` 可以为归属已加载 Mod 且有 sessionId 的错误路径打开文件编辑器；无法归属时只能显示错误消息。
- `app log service` 只写工具私有 log 文件，不能写 settings、workspace 或 Mod 文件。
- `业务组件` 需要反馈时必须通过 `useAppFeedback()`，非组件流程必须接收 `AppFeedback` 参数。
- `清空配置文件` 只删除工具私有配置目录中除日志文件外的内容，不能删除日志文件。
- `清除日志` 只能清空工具私有 log 文件内容，不能删除 settings、workspace 或缓存文件。
- `设置页维护按钮` 只是配置和日志维护入口的 UI 宿主，不拥有日志路径、配置目录路径或清理语义。
- `system open` 只打开后端确认的工具私有配置目录或日志文件，不接受前端任意路径。
- `主窗口 provider` 拥有 Naive UI message provider 和 dialog provider，业务组件不得直接创建离散 message/dialog API。

## 链路

### 反馈与确认入口

1. 组件通过 `useAppFeedback()` 获取 `AppFeedback`。
2. composable 从 Naive UI provider 获取 message 和 dialog 实例。
3. `createAppFeedback()` 返回 success、info、warning、error、confirmDanger、confirmWarning 和 choose。
4. success 和 info 只显示 message。
5. warning 先以 warning level 写入 app log，再显示 warning message。
6. confirmDanger 和 confirmWarning 调用 Naive UI dialog 并只在用户确认后执行回调。
7. choose 根据调用方提供的选项创建对话框并返回用户选择。

### 错误日志与错误文件入口

1. 调用方把 error 和 context 传给 `AppFeedback.error`。
2. error 格式化错误和上下文。
3. error 提取错误中的文件路径和行号引用。
4. error 以 error level 写入 app log，path 和 line 无值时显式为 null。
5. 无文件引用时显示普通 error message。
6. 有文件引用时，反馈入口按已加载 Mod 根目录匹配 path。
7. 未匹配 Mod 或缺少 sessionId 时显示普通 error message。
8. 匹配成功时显示带“打开错误文件”按钮的 error message。
9. 用户点击按钮后打开文件编辑器窗口，并携带当前 settings snapshot、modRoot、path、sessionId、line 和错误上下文。

### 应用日志状态与日志文件动作

1. 设置页 ViewModel 调用 `loadLogStatus()` 读取 log 状态。
2. app feedback log service 调用 shared API 的 `get_app_log_status` command。
3. Rust app log service 返回 log 路径和 sizeBytes；文件不存在时 sizeBytes 为 0。
4. 用户打开 log 文件时，Settings ViewModel 调用 `openLogFile()`。
5. Rust app log service 确保 log 文件存在并调用 system open。
6. 用户清除 log 文件时，Settings ViewModel 通过 `confirmDanger` 显示确认框。
7. 用户确认后，Rust app log service 将 log 文件写为空文件并返回新的 log 状态。
8. Settings ViewModel 用返回状态刷新 log path 和 size。

### 配置维护动作

1. 用户打开配置目录时，Settings ViewModel 调用 `openConfigFolder()`。
2. Rust app config service 创建 app data 目录并调用 system open。
3. 用户清空配置文件时，Settings ViewModel 通过 `confirmDanger` 显示确认框。
4. 用户确认后，Rust app config service 删除 app data 下除 log 文件外的文件和目录。
5. 清空配置成功后 Settings ViewModel 刷新 log 状态。
6. Settings ViewModel 显示成功消息。
7. Settings ViewModel 重载当前 webview，让 settings 重新从 app data 默认值启动。

## 规范

- `AppFeedback.error` 和 `AppFeedback.warning` 必须写入 app log；success 和 info 不写日志。
- `AppLogEntry.path` 和 `AppLogEntry.line` 必须显式可空，缺失上下文时使用 null。
- `AppLogLevel` 必须使用正式枚举，不能用业务字符串临时表达日志等级。
- `choose` 必须通过 `AppFeedback` 暴露，不能让业务组件直接创建 dialog promise。
- `recordLogBestEffort` 只能用于诊断日志，不得影响主业务保存链路成功或失败语义。
- `warning/error` 日志写入失败不得阻塞 message 显示。
- `危险确认`、`警告确认`、文件历史回放确认、覆盖确认和关闭确认必须走 `AppFeedback` 的确认方法。
- `清空配置文件` 必须保留 `starsector-devtool.log`，清除日志只能清空 log 文件内容。
- `打开错误文件` 必须同时匹配 loaded modRoot 和 sessionId。
- `打开日志文件` 必须由后端确保日志文件存在后再调用 system open。
- `打开配置目录` 必须由后端创建并确认 app data 目录后再调用 system open。
- `普通错误反馈` 不能直接打开文件编辑器而不经过 Mod 归属和 sessionId 判断。

## 陷阱

- 在业务组件中直接使用 Naive UI message 或 dialog，会绕过日志、错误文件入口和统一确认语义。
- 在清空配置文件时删除 log 文件，会破坏日志手动清除边界和设置页 log 状态语义。
- 让前端传任意路径给 system open，会把工具私有维护入口变成未校验文件打开入口。
- 让普通错误反馈直接打开文件编辑器而不匹配已加载 Mod 和 sessionId，会把错误文件入口指向无权读取的路径。
- 让日志写入失败抛回主业务，会把诊断链路错误误判为保存、打开或刷新失败。
- 把配置维护动作写进 settings 持久化链路，会让清配置、清日志和保存 settings 的失败语义混在一起。
