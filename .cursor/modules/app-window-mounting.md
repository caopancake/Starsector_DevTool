# 应用启动与窗口挂载系统

## 定义

应用启动与窗口挂载系统按当前 WebView 的启动参数初始化全局设置并挂载对应窗口根组件。

## 参考

- `src/main.ts`：拥有前端唯一启动入口、窗口类型判定、设置初始化、Vue 根组件选择、Pinia/Naive UI 安装和窗口显示时机。
- `src/app/App.vue`：拥有主窗口根组件装配，负责设置持久化、全局 provider 和主窗口内容入口。
- `src/app/EditorWindowApp.vue`：拥有编辑器类子窗口根组件装配，只通过共用窗口外壳承载编辑器窗口内容。
- `src/app/FileEditorApp.vue`：拥有文件编辑器子窗口根组件装配，只通过共用窗口外壳承载文件编辑内容。
- `src/app/WindowShell.vue`：拥有子窗口共用 provider、主题覆盖和设置镜像监听入口。
- `src/orchestrators/settings-persistence.orchestrator.ts`：拥有主窗口设置持久化与跨窗口设置广播，以及子窗口设置镜像消费。
- `src/stores/settings.store.ts`：拥有设置 snapshot 校验、内存状态初始化、主题 token 应用和 settings snapshot 输出。
- `src/windows/current.window.ts`：拥有当前 Tauri 窗口的显示、关闭、最小化、拖拽和最大化操作封装。
- `src/windows/editor.window.ts`：拥有编辑器类子窗口创建请求的 URL 参数、窗口尺寸、标题和单例 key。
- `src/windows/file-editor.window.ts`：拥有文件编辑器子窗口创建请求的 URL 参数、窗口尺寸、标题、单例 key 和聚焦事件。
- `src/windows/managed.window.ts`：拥有 WebviewWindow 创建、单例窗口复用、URL query 序列化和初始隐藏策略。
- `src-tauri/src/lib.rs`：拥有 Tauri command、plugin 和 single-instance 注册。

## 边界

- App 设置持久化归主窗口根组件拥有，子窗口只能镜像广播后的设置状态。
- Naive UI 安装归启动入口拥有，任何根组件不得重复创建 Vue app 或重复挂载 Pinia。
- Settings store 初始化归启动入口拥有，任何组件、store、service 不得在初始化前读取 settings store。
- Tauri command 与 plugin 注册归 Rust 应用启动拥有，前端窗口挂载不得决定后端 command 是否存在。
- WebView 可见性归启动入口和当前窗口封装拥有，新窗口创建时保持隐藏，挂载完成或启动失败后再显示。
- Vue 根组件选择归启动入口拥有，子窗口内容组件不得自行改判当前窗口类型。
- 编辑器类子窗口 URL 参数归编辑器窗口创建入口拥有，挂载系统只消费 `window=editor` 并交给编辑器根组件。
- 文件编辑器子窗口 URL 参数归文件编辑器窗口创建入口拥有，挂载系统只消费 `window=file-editor` 并交给文件编辑器根组件。
- 主窗口根组件拥有设置持久化入口，不能消费子窗口 URL settings snapshot 作为持久化来源。
- 子窗口共用外壳拥有 settings mirror 入口，不能写入工具私有设置文件。
- 子窗口缺少 settings snapshot 时启动入口拥有失败语义，不能挂载业务根组件继续运行。
- 子窗口业务状态归对应窗口内容和 ViewModel 拥有，挂载系统不得写入 workspace、project、table、editor 或 history 状态。

## 链路

### 编辑器类子窗口挂载

1. 编辑器窗口创建入口构造 `window=editor`、目标 kind、sessionId、modRoot、id、settings snapshot 和可选 starsectorRoot。
2. 托管窗口入口按单例 key 查找既有 WebView。
3. 既有 WebView 存在时显示、聚焦并结束创建链路。
4. 既有 WebView 不存在时创建隐藏 WebView，并把 URL query 写入 `/?...`。
5. 前端启动入口读取 `window` 参数。
6. 前端启动入口读取并校验 settings snapshot。
7. 前端启动入口选择编辑器窗口根组件。
8. 前端启动入口创建 Vue app、安装 Pinia 和 Naive UI。
9. 前端启动入口挂载到 `#app`。
10. 前端启动入口调用当前窗口显示封装。

### 文件编辑器子窗口挂载

1. 文件编辑器窗口创建入口构造 `window=file-editor`、file、modRoot、sessionId、title、context、line 和 settings snapshot。
2. 托管窗口入口按单例 key 查找既有 WebView。
3. 既有 WebView 存在时显示、聚焦并发送聚焦行事件。
4. 既有 WebView 不存在时创建隐藏 WebView，并把 URL query 写入 `/?...`。
5. 前端启动入口读取 `window` 参数。
6. 前端启动入口读取并校验 settings snapshot。
7. 前端启动入口选择文件编辑器根组件。
8. 前端启动入口创建 Vue app、安装 Pinia 和 Naive UI。
9. 前端启动入口挂载到 `#app`。
10. 前端启动入口调用当前窗口显示封装。

### 主窗口挂载

1. Tauri 创建主 WebView 并加载前端入口。
2. 前端启动入口读取 URL query。
3. 前端启动入口确认缺少 `window` 参数。
4. 前端启动入口通过设置服务读取持久化设置。
5. 前端启动入口校验并初始化 settings store。
6. 前端启动入口选择主窗口根组件。
7. 前端启动入口创建 Vue app、安装 Pinia 和 Naive UI。
8. 前端启动入口挂载到 `#app`。
9. 主窗口根组件启动设置持久化监听。
10. 前端启动入口调用当前窗口显示封装。

### 启动失败显示

1. 前端启动入口执行 bootstrap。
2. 设置读取、settings snapshot 解析、settings store 校验、Vue app 创建或挂载任一环节抛错。
3. 启动入口把错误文本转义成 HTML。
4. 启动入口把启动失败内容写入 `#app`。
5. 启动入口调用当前窗口显示封装。

## 规范

- `window` 参数只允许决定根组件类别，不能携带业务分支、保存策略或状态归属。
- `window=editor` 的合法输出是编辑器窗口根组件。
- `window=file-editor` 的合法输出是文件编辑器根组件。
- 缺少 `window` 参数的合法输出是主窗口根组件。
- 未识别的 `window` 参数必须按主窗口处理。
- 主窗口初始化输入必须来自持久化设置读取结果。
- 子窗口初始化输入必须来自 URL 中的 settings snapshot。
- 子窗口缺少 settings snapshot 必须进入启动失败显示。
- settings snapshot 必须先经过 settings store 校验，再允许任何根组件读取 settings store。
- 启动失败显示必须转义错误文本，不能把原始错误字符串直接拼入 HTML。
- 根组件挂载必须在同一个 Vue app 上安装 Pinia 和 Naive UI。
- 全局基础样式必须由启动入口导入。
- 文件编辑器样式可以由启动入口导入，但不能改变根组件选择规则。
- 当前窗口显示必须发生在挂载完成后；启动失败时也必须显示失败内容所在窗口。
- 子窗口设置变化必须通过跨窗口设置事件镜像，不能保存 settings.json。
- 主窗口设置变化必须同时写入持久化设置并广播给子窗口。

## 陷阱

- 把子窗口 URL settings snapshot 当成持久化设置来源，会导致子窗口反写工具私有配置。
- 在组件内重新判断 `window` 参数，会导致根组件选择规则分裂。
- 在 settings store 初始化前使用 store，会触发启动顺序错误并使窗口无法挂载。
- 在启动失败时不显示当前窗口，会让隐藏 WebView 静默失败。
- 在子窗口缺少 settings snapshot 时继续挂载业务内容，会产生未校验主题、编辑模式和历史上限。
- 在挂载系统里写入 workspace、project、table、editor 或 history 状态，会污染业务模块 ownership。
- 把 `kind`、`file`、`sessionId` 或 `modRoot` 的业务校验放入启动入口，会把窗口挂载系统扩张成业务解析层。
- 绕过托管窗口入口直接创建 WebviewWindow，会丢失单例复用、初始隐藏和 URL 参数序列化边界。
