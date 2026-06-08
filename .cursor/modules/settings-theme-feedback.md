# 设置、主题与反馈入口机制

## 定义

设置、主题与反馈入口机制负责应用设置运行态、主题应用、反馈入口、工具私有配置持久化和应用日志边界。

## 参考

- `src-tauri/src/commands/app_config.rs`：暴露设置读取保存、日志追加状态、配置目录打开、日志打开和清理 command。
- `src-tauri/src/models/app_config.rs`：定义 `AppSettings`、设置枚举、`AppLogEntry`、日志等级和日志状态的 wire 模型。
- `src-tauri/src/services/app_config.rs`：拥有配置目录打开和清空配置文件规则，清空配置时保留日志文件。
- `src-tauri/src/services/app_log.rs`：拥有 `starsector-devtool.log` 追加、清空、状态读取、打开和 CRLF 日志行渲染。
- `src-tauri/src/services/app_settings.rs`：拥有 `settings.json` 默认值、UTF-8 无 BOM 读取和 strict JSON 保存。
- `src/app/App.vue`：在主窗口提供 Naive UI config、message、dialog provider，并启动 settings persistence。
- `src/app/app-feedback.ts`：拥有 `AppFeedback` 的 message/dialog 适配、错误日志记录、错误文件引用解析和打开错误文件入口。
- `src/app/components/SettingsPage.vue`：渲染设置页控件，所有设置修改只写 settings store。
- `src/app/composables/use-settings-view-model.ts`：拥有设置页目录选择、配置目录打开、日志打开、清配置、清日志和反馈编排。
- `src/main.ts`：拥有主窗口从 app config 读取 settings、子窗口从 URL settings snapshot 初始化、settings store 初始化和启动失败显示。
- `src/orchestrators/settings-persistence.orchestrator.ts`：拥有主窗口 settings 保存、historyLimit 同步、子窗口设置广播和子窗口 settings 镜像监听。
- `src/services/app-config.service.ts`：向前端业务层暴露 app config、settings 和 log service 入口。
- `src/shared/api/app-config-api.ts`：封装 app config 相关 Tauri command payload。
- `src/stores/settings.store.ts`：拥有 settings 运行态、枚举校验、主题 token、Naive theme、编辑模式和 settings snapshot。
- `src/windows/window.events.ts`：定义跨窗口 settings snapshot 广播事件。

## 边界

- `AppFeedback` 是业务层 message、dialog、choose、危险确认、警告确认和错误反馈的唯一抽象入口。
- `AppLogEntry` 归工具私有日志系统拥有，业务层只能提交 level、message、path、line，不拥有日志文件路径。
- `AppSettings` 的持久化目标只归 app data 下 `settings.json`，不得写入 workspace、Mod 目录或浏览器 storage。
- `SettingsPage` 只拥有设置页展示和用户输入，不能直接调用 Tauri command 保存 settings。
- `app config API` 只封装 Tauri command 形状，不承载默认值、主题、反馈或清理决策。
- `app feedback` 可以为归属已加载 Mod 且有 sessionId 的错误路径打开文件编辑器；无法归属时只能显示错误消息。
- `app log service` 只写工具私有 log 文件，不能写 settings、workspace 或 Mod 文件。
- `settings mirror` 只归子窗口使用，子窗口不能读取 `settings.json`、保存 settings 或自行补默认值。
- `settings persistence` 只在主窗口启动，拥有 settings 保存、子窗口广播和 historyLimit 同步。
- `settings store` 是应用设置运行态权威，拥有枚举校验、范围归一、主题 token 应用和 snapshot 输出。
- `system open` 只打开后端确认的工具私有配置目录或日志文件，不接受前端任意路径。
- `theme overrides` 只消费 settings store 和 CSS token，不拥有 settings 持久化或业务反馈。
- `主窗口 provider` 拥有 Naive UI theme、message provider 和 dialog provider，业务组件不得直接创建离散 message/dialog API。
- `跨窗口 settings event` 只携带完整 settings snapshot，不携带增量 patch、来源窗口状态或持久化结果。

## 链路

### 主窗口 settings 启动

1. 前端入口读取 URL 参数并识别当前窗口类型。
2. 当前窗口是主窗口时，入口调用 app config service 的 `loadSettings()`。
3. app config service 调用 shared API 的 `load_app_settings` command。
4. Rust command 调用 app settings service。
5. app settings service 定位 app data 目录。
6. `settings.json` 不存在时返回 `AppSettings::default()`。
7. `settings.json` 存在时按 UTF-8 无 BOM 读取并用 strict JSON 解析为 `AppSettings`。
8. 前端入口调用 `initializeSettingsStore(settings)`。
9. settings store 校验 theme、accent、customAccent、historyLimit 和 editMode。
10. 前端创建 Vue app、Pinia 和 Naive UI plugin。
11. 主窗口根组件读取 settings store，提供 Naive UI theme 和 theme overrides。
12. 主窗口根组件启动 settings persistence watcher。

### 子窗口 settings 启动与镜像

1. 子窗口创建入口把主窗口 `settingsSnapshot()` 放入窗口 URL。
2. 前端入口读取 URL 中的 `settings` 参数。
3. 缺少 settings 参数时，入口显示启动失败并停止挂载业务根组件。
4. 存在 settings 参数时，入口解析 JSON 并初始化 settings store。
5. 子窗口根组件启动 settings mirror。
6. settings mirror 监听 `app-settings-changed` 窗口事件。
7. 主窗口 settings 变化后广播完整 settings snapshot。
8. 子窗口收到 snapshot 后调用 `settings.replaceSettings(snapshot)`。
9. settings store 重新校验枚举和范围并更新主题 token。
10. settings mirror 同步 historyLimit 到 CSV 草稿 history 和文件级 history store。

### settings 修改持久化

1. 设置页控件调用 settings store 的 setter。
2. settings store 更新内存设置并重新计算 settings snapshot。
3. settings persistence watcher 观察到 snapshot 变化。
4. settings persistence 同步 historyLimit 到 CSV 草稿 history 和文件级 history store。
5. settings persistence 并行调用 `saveSettings(snapshot)` 和广播 `app-settings-changed`。
6. save settings service 调用 shared API 的 `save_app_settings` command。
7. Rust command 拆出 payload 中的 `settings`。
8. app settings service 创建 app data 目录。
9. app settings service 将 settings 序列化为 pretty strict JSON。
10. app settings service 以 UTF-8 无 BOM 写入 `settings.json`。
11. 保存失败时 settings persistence 写入 error log。
12. 广播失败时 settings persistence 写入 error log。

### 主题应用

1. settings store 初始化 theme、accent 和 customAccent。
2. settings store 计算 active accent hex。
3. settings store watcher 写入 `document.documentElement.dataset.theme`。
4. settings store watcher 根据主题和 accent 计算 CSS token。
5. settings store watcher 写入 root CSS variables。
6. 主窗口根组件把 `settings.naiveTheme` 传给 Naive UI config provider。
7. 主窗口根组件用 `buildThemeOverrides(settings)` 生成 Naive UI overrides。
8. theme overrides 从 root CSS variables 读取 panel、surface、border、text、danger 和 shadow token。
9. Naive UI message、button 和 switch 消费同一主题 token。

### 反馈与错误文件入口

1. 组件通过 `useAppFeedback()` 获取 `AppFeedback`。
2. composable 从 Naive UI provider 获取 message 和 dialog 实例。
3. `createAppFeedback()` 返回 success、info、warning、error、confirmDanger、confirmWarning 和 choose。
4. success 和 info 只显示 message。
5. warning 先以 warning level 写入 app log，再显示 warning message。
6. error 格式化错误和上下文。
7. error 提取错误中的文件路径和行号引用。
8. error 以 error level 写入 app log，path 和 line 无值时显式为 null。
9. 无文件引用时显示普通 error message。
10. 有文件引用时，反馈入口按已加载 Mod 根目录匹配 path。
11. 未匹配 Mod 或缺少 sessionId 时显示普通 error message。
12. 匹配成功时显示带“打开错误文件”按钮的 error message。
13. 用户点击按钮后打开文件编辑器窗口，并携带当前 settings snapshot、modRoot、path、sessionId、line 和错误上下文。

### 设置页配置与日志动作

1. 设置页 ViewModel 调用 `loadLogStatus()` 读取 log 状态。
2. app config service 调用 shared API 的 `get_app_log_status` command。
3. Rust app log service 返回 log 路径和 sizeBytes；文件不存在时 sizeBytes 为 0。
4. 用户选择 Starsector 安装目录时，Settings ViewModel 调用 Tauri dialog runtime。
5. dialog runtime 返回单个目录路径或 null。
6. 返回路径时 Settings ViewModel 调用 `settings.setStarsectorRoot(path)`。
7. 用户打开配置目录时，Settings ViewModel 调用 app config service。
8. Rust app config service 创建 app data 目录并调用 system open。
9. 用户打开 log 文件时，Rust app log service 确保 log 文件存在并调用 system open。
10. 用户清空配置文件时，Settings ViewModel 通过 `confirmDanger` 显示确认框。
11. 用户确认后，Rust app config service 删除 app data 下除 log 文件外的文件和目录。
12. 清空配置成功后 Settings ViewModel 刷新 log 状态、显示成功消息并重载当前 webview。
13. 用户清除 log 文件时，Settings ViewModel 通过 `confirmDanger` 显示确认框。
14. 用户确认后，Rust app log service 将 log 文件写为空文件并返回新的 log 状态。

## 规范

- `accent` 必须是正式 preset 或 custom，custom accent 必须是合法 `#RRGGBB`。
- `AppFeedback.error` 和 `AppFeedback.warning` 必须写入 app log；success 和 info 不写日志。
- `AppLogEntry.path` 和 `AppLogEntry.line` 必须显式可空，缺失上下文时使用 null。
- `AppLogLevel` 必须使用正式枚举，不能用业务字符串临时表达日志等级。
- `AppSettings.theme`、`accent` 和 `editMode` 必须使用正式枚举，不能用裸字符串扩展新语义。
- `editMode` 归 settings store 持有，plain 模式只使用文本编辑入口，smart 模式允许增强控件。
- `historyLimit` 由 settings persistence 同步到 CSV 草稿 history store 和文件级 history store，history store 不读取 settings store 或配置文件。
- `settings.json` 必须以 strict pretty JSON 写入 app data 目录，读取时使用 UTF-8 无 BOM 文本 IO。
- `starsectorRoot` 未设置时必须为 null；Rust 读取空字符串时归一为 None。
- `theme` 必须通过 settings store、root `data-theme` 和 CSS variables 驱动，不能由组件局部硬编码主题色。
- 业务组件需要反馈时必须通过 `useAppFeedback()`，非组件流程必须接收 `AppFeedback` 参数。
- 业务层不得直接 import Naive UI message、dialog、discrete api 或 Tauri dialog plugin，设置页目录选择例外只能通过 shared runtime。
- 清空配置文件必须保留 `starsector-devtool.log`，清除日志只能清空 log 文件内容。
- 危险确认、警告确认、文件历史回放确认、覆盖确认和关闭确认必须走 `AppFeedback` 的确认方法。
- 子窗口 settings 初始化失败必须显示启动失败，不得挂载业务窗口后再补默认设置。
- 主窗口 settings 保存和子窗口 settings 广播必须使用同一个 settings snapshot。

## 陷阱

- 把 settings 写入浏览器 storage，会绕过 Rust app data 边界并让主窗口、子窗口和重启恢复出现不同来源。
- 把子窗口 URL settings snapshot 反写配置文件，会让子窗口覆盖主窗口运行态权威。
- 在业务组件中直接使用 Naive UI message 或 dialog，会绕过日志、错误文件入口和统一确认语义。
- 在清空配置文件时删除 log 文件，会破坏日志手动清除边界和设置页 log 状态语义。
- 用空字符串表示未设置 Starsector root，会让 Rust、前端和 command payload 对缺失值的解释分叉。
- 用裸字符串新增主题、强调色、编辑模式或日志等级，会绕过前后端枚举校验和启动失败边界。
- 只保存 settings 不广播子窗口，或只广播不保存 settings，会让运行态和重启后的设置不一致。
- 在 settings store 初始化前读取 store，会触发启动顺序错误并导致窗口无法挂载。
- 让 history store 自行读取 historyLimit，会把 history 运行态反向依赖 settings 持久化。
- 让普通错误反馈直接打开文件编辑器而不匹配已加载 Mod 和 sessionId，会把错误文件入口指向无权读取的路径。
