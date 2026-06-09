# 应用设置与主题机制

## 定义

应用设置与主题机制负责应用设置运行态、设置持久化、主题 token 应用、编辑模式和子窗口 settings 镜像。

## 参考

- `src-tauri/src/commands/app_settings.rs`：暴露 settings 读取和保存 command。
- `src-tauri/src/models/app_settings.rs`：定义 `AppSettings`、主题、强调色、编辑模式和 history limit 的 wire 模型。
- `src-tauri/src/services/app_settings.rs`：拥有 `settings.json` 默认值、UTF-8 无 BOM 读取和 strict JSON 保存。
- `src/app/App.vue`：在主窗口提供 Naive UI config provider，并启动 settings persistence 或 settings mirror。
- `src/app/components/SettingsPage.vue`：渲染设置控件，设置修改只写 settings store。
- `src/main.ts`：拥有主窗口 settings 读取、子窗口 URL settings snapshot 解析、settings store 初始化和启动失败显示。
- `src/orchestrators/settings-persistence.orchestrator.ts`：拥有主窗口 settings 保存、historyLimit 同步、子窗口广播和子窗口 settings 镜像监听。
- `src/services/app-settings.service.ts`：向前端业务层暴露 settings 读取和保存入口。
- `src/shared/api/app-settings-api.ts`：封装 settings 相关 Tauri command payload。
- `src/stores/settings.store.ts`：拥有 settings 运行态、枚举校验、主题 token、Naive theme、编辑模式和 settings snapshot。
- `src/windows/window.events.ts`：定义跨窗口 settings snapshot 广播事件。

## 边界

- `AppSettings` 的持久化目标只归 app data 下 `settings.json`，不得写入 workspace、Mod 目录或浏览器 storage。
- `app settings service` 只暴露 settings 读取和保存，不承载应用日志、错误反馈或配置维护动作。
- `historyLimit` 由 settings persistence 同步到 CSV 草稿 history store 和文件级 history store，history store 不读取 settings store 或配置文件。
- `settings mirror` 只归子窗口使用，子窗口不能读取 `settings.json`、保存 settings 或自行补默认值。
- `settings persistence` 只在主窗口启动，拥有 settings 保存、子窗口广播和 historyLimit 同步。
- `settings store` 是应用设置运行态权威，拥有枚举校验、范围归一、主题 token 应用和 snapshot 输出。
- `SettingsPage` 只拥有设置页展示和用户输入，不能直接调用 Tauri command 保存 settings。
- `starsectorRoot` 是用户设置中的默认游戏目录提示，不打开 ProjectSession、不扫描目录、不写 workspace。
- `theme overrides` 只消费 settings store 和 CSS token，不拥有 settings 持久化或业务反馈。
- `主窗口 provider` 拥有 Naive UI theme 和主题 overrides，业务组件不得局部创建不受 settings 驱动的主题系统。
- `跨窗口 settings event` 只携带完整 settings snapshot，不携带增量 patch、来源窗口状态或持久化结果。
- `编辑模式` 归 settings store 持有，字段入口只能消费该模式，不得自行持久化局部编辑模式。

## 链路

### 主窗口 settings 启动

1. 前端入口读取 URL 参数并识别当前窗口类型。
2. 当前窗口是主窗口时，入口调用 app settings service 的 `loadSettings()`。
3. app settings service 调用 shared API 的 `load_app_settings` command。
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
11. 保存失败时 settings persistence 写入应用日志。
12. 广播失败时 settings persistence 写入应用日志。

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

## 规范

- `accent` 必须是正式 preset 或 custom，custom accent 必须是合法 `#RRGGBB`。
- `AppSettings.theme`、`accent` 和 `editMode` 必须使用正式枚举，不能用裸字符串扩展新语义。
- `editMode` 归 settings store 持有，plain 模式只使用文本编辑入口，smart 模式允许增强控件。
- `historyLimit` 必须通过 settings persistence 同步到历史 store，不能由历史 store 反向读取 settings。
- `settings.json` 必须以 strict pretty JSON 写入 app data 目录，读取时使用 UTF-8 无 BOM 文本 IO。
- `settingsSnapshot()` 必须输出完整 settings，不输出增量 patch。
- `starsectorRoot` 未设置时必须为 null；Rust 读取空字符串时归一为 None。
- `theme` 必须通过 settings store、root `data-theme` 和 CSS variables 驱动，不能由组件局部硬编码主题色。
- `主窗口 settings 保存` 和 `子窗口 settings 广播` 必须使用同一个 settings snapshot。
- `子窗口 settings 初始化失败` 必须显示启动失败，不得挂载业务窗口后再补默认设置。
- `子窗口 settings mirror` 只能消费主窗口广播，不得保存 settings。
- `设置页控件` 只能调用 settings store setter，不得直接调用 settings 保存 command。

## 陷阱

- 把 settings 写入浏览器 storage，会绕过 Rust app data 边界并让主窗口、子窗口和重启恢复出现不同来源。
- 把子窗口 URL settings snapshot 反写配置文件，会让子窗口覆盖主窗口运行态权威。
- 用空字符串表示未设置 Starsector root，会让 Rust、前端和 command payload 对缺失值的解释分叉。
- 用裸字符串新增主题、强调色或编辑模式，会绕过前后端枚举校验和启动失败边界。
- 只保存 settings 不广播子窗口，或只广播不保存 settings，会让运行态和重启后的设置不一致。
- 在 settings store 初始化前读取 store，会触发启动顺序错误并导致窗口无法挂载。
- 让 history store 自行读取 historyLimit，会把 history 运行态反向依赖 settings 持久化。
