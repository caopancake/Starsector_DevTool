# 多窗口机制

## 定义

多窗口机制统一管理 Tauri WebviewWindow 的创建、单例复用、聚焦和跨窗口事件传递。

## 参考

- `src/app/composables/use-editor-window-view-model.ts`：消费编辑器保存事件和 session 失效事件，拥有编辑器窗口内 bundle 同步与派生数据刷新。
- `src/app/composables/use-draft-session.ts`：拥有编辑器窗口和文件编辑器窗口的 base、draft、dirty、外部更新暂存和 revision 状态机。
- `src/app/composables/use-file-editor-view-model.ts`：消费文件编辑器聚焦事件和文本回放事件，拥有文件编辑器窗口内文本状态更新。
- `src/app/composables/use-workspace-shell-actions.ts`：在主窗口生命周期内注册窗口保存事件监听，拥有监听器释放时机。
- `src/orchestrators/file-history-replay.orchestrator.ts`：拥有文件级 history 回放确认 UI 和反馈。
- `src/orchestrators/file-history-session.orchestrator.ts`：拥有文件级 history 回放后的 session refresh、文件编辑器文本同步和栈提交。
- `src/orchestrators/file-save.orchestrator.ts`：拥有保存事件进入主窗口后的 File History Session 转交入口。
- `src/orchestrators/project-session-refresh.orchestrator.ts`：拥有 ProjectSession 写入后刷新、manifest 更新、本地 cache 失效和跨窗口失效广播。
- `src/orchestrators/window-save.orchestrator.ts`：拥有主窗口保存事件监听注册和保存事件 handler 串联。
- `src/windows/editor.window.ts`：拥有编辑器类窗口请求、窗口尺寸、标题、URL 参数和单例业务身份。
- `src/windows/file-editor.window.ts`：拥有文件编辑器窗口请求、窗口尺寸、URL 参数、单例业务身份和聚焦行事件。
- `src/windows/managed.window.ts`：拥有窗口 label 生成、单例查询、既有窗口显示聚焦、URL query 序列化和新窗口创建。
- `src/windows/tauri.events.ts`：拥有 Tauri 事件 emit/listen 适配和异步 handler 错误回调转交。
- `src/windows/window.events.ts`：拥有跨窗口事件名和事件 payload 类型。
- `src-tauri/capabilities/default.json`：拥有窗口创建、聚焦、显示、关闭和事件收发权限。

## 边界

- Tauri 权限归 capabilities 配置拥有，前端窗口模块只能消费已授权的窗口和事件能力。
- WebviewWindow 原始创建归托管窗口入口拥有，业务模块不得直接创建窗口。
- 保存事件处理归主窗口保存监听拥有，子窗口只发出已完成写盘事件。
- 单例 label 归托管窗口入口拥有，业务窗口入口只提供 label prefix 和结构化 singleton key。
- 事件名和 payload 结构归窗口事件定义拥有，发起方和监听方只能按定义收发。
- 事件转发归 Tauri 事件适配层拥有，适配层不记录业务日志、不读取 app 配置、不解释 payload。
- 文件编辑器窗口身份归文件编辑器窗口入口拥有，由 sessionId、modRoot 和 path 的结构化组合表达。
- 文件编辑器聚焦上下文归文件编辑器窗口入口拥有，既有窗口复用时只能通过聚焦事件覆盖上下文。
- 文件历史文本同步归文件历史回放编排拥有，文件编辑器窗口只消费命中自身 sessionId、modRoot 和 path 的文本。
- 窗口尺寸归对应业务窗口入口拥有，托管窗口入口只接收并转交尺寸。
- 编辑器类窗口身份归编辑器窗口入口拥有，由 kind、modRoot 和 id 的结构化组合表达。
- 跨窗口 ProjectSession refresh 归 ProjectSession refresh 编排拥有，窗口机制只负责广播和监听，不直接刷新业务数据。
- 主窗口保存监听归 workspace shell 生命周期拥有，主窗口卸载时必须释放保存事件监听器。
- 子窗口设置 snapshot 归窗口创建请求提供，窗口机制只作为 URL 参数传递，不持久化设置。

## 链路

### 编辑器保存事件

1. 编辑器窗口 ViewModel 调用编辑器保存服务完成写盘。
2. 编辑器窗口 ViewModel 用保存结果、本窗口 sessionId、modRoot、kind 和 id 发送编辑器保存事件。
3. 主窗口保存监听收到编辑器保存事件。
4. 主窗口保存编排把事件 sessionId、modRoot 和 WriteResult 交给 File History Session。
5. File History Session 校验事件 sessionId 和 modRoot 是否匹配当前 ProjectManifest。
6. File History Session 把 WriteResult.changes 写入文件级 history。
7. File History Session 按 WriteResult.invalidation.paths 刷新 ProjectSession。
8. ProjectSession refresh 编排更新主窗口 ProjectManifest。
9. ProjectSession refresh 编排清理主窗口本地 query cache 和 resource cache。
10. ProjectSession refresh 编排广播 ProjectSession 失效事件。
11. 编辑器窗口收到编辑器保存事件后，按自身目标、当前 bundle 和 draft dirty 状态决定应用或暂存保存后的 spec。

### 打开编辑器类窗口

1. 主窗口或编辑器窗口调用编辑器窗口入口。
2. 编辑器窗口入口生成结构化 singleton key。
3. 编辑器窗口入口构造窗口 URL 参数、标题和尺寸。
4. 编辑器窗口入口调用托管窗口入口。
5. 托管窗口入口规范化 singleton key。
6. 托管窗口入口计算窗口 label。
7. 托管窗口入口按 label 查询既有 WebView。
8. 既有 WebView 存在时显示并聚焦该窗口。
9. 既有 WebView 不存在时序列化 URL query。
10. 托管窗口入口创建隐藏 WebviewWindow。
11. 前端启动入口按 `window=editor` 挂载编辑器窗口根组件。

### 打开文件编辑器窗口

1. 主窗口调用文件编辑器窗口入口。
2. 文件编辑器窗口入口生成结构化 singleton key。
3. 文件编辑器窗口入口构造窗口 URL 参数、标题、尺寸和聚焦行事件。
4. 文件编辑器窗口入口调用托管窗口入口。
5. 托管窗口入口规范化 singleton key。
6. 托管窗口入口计算窗口 label。
7. 托管窗口入口按 label 查询既有 WebView。
8. 既有 WebView 存在时显示并聚焦该窗口。
9. 既有 WebView 存在且请求包含聚焦上下文时发送文件编辑器聚焦事件。
10. 既有 WebView 不存在时序列化 URL query。
11. 托管窗口入口创建隐藏 WebviewWindow。
12. 前端启动入口按 `window=file-editor` 挂载文件编辑器根组件。

### 文件编辑器保存事件

1. 文件编辑器 ViewModel 调用文件写入服务完成写盘。
2. 文件编辑器 ViewModel 用保存结果、本窗口 sessionId、modRoot 和 path 发送文件编辑器保存事件。
3. 主窗口保存监听收到文件编辑器保存事件。
4. 主窗口保存编排把事件 sessionId、modRoot 和 WriteResult 交给 File History Session。
5. File History Session 校验事件 sessionId 和 modRoot 是否匹配当前 ProjectManifest。
6. File History Session 把 WriteResult.changes 写入文件级 history。
7. File History Session 按 WriteResult.invalidation.paths 刷新 ProjectSession。
8. ProjectSession refresh 编排更新主窗口 ProjectManifest。
9. ProjectSession refresh 编排清理主窗口本地 query cache 和 resource cache。
10. ProjectSession refresh 编排广播 ProjectSession 失效事件。

### 文件历史文本同步事件

1. 主窗口确认文件级 history 回放。
2. File History Session 调用写入服务回放 changeset。
3. File History Session 按 WriteResult 刷新受影响的已加载 ProjectSession。
4. File History Session 遍历回放涉及的非目录变更。
5. 文本变更存在可回放文本时发送文件编辑器文本应用事件。
6. 文件编辑器窗口收到文本应用事件。
7. 文件编辑器 ViewModel 按 sessionId、modRoot 和 path 匹配当前窗口目标。
8. 匹配成功且文件编辑器不 dirty 时，文件编辑器 ViewModel 替换文本快照并清空草稿 undo/redo。
9. 匹配成功且文件编辑器 dirty 时，文件编辑器 ViewModel 暂存外部文本并提示，不覆盖当前 textarea。

### ProjectSession refresh 事件

1. 主窗口保存编排取得 WriteResult.invalidation.paths。
2. ProjectSession refresh 编排按当前 ProjectManifest 过滤项目作用域路径。
3. ProjectSession refresh 编排调用 session 服务刷新 ProjectSession。
4. ProjectSession refresh 编排更新主窗口 ProjectManifest。
5. ProjectSession refresh 编排清理主窗口本地 query cache 和 resource cache。
6. ProjectSession refresh 编排广播 ProjectSession 失效事件。
7. 编辑器窗口收到 ProjectSession 失效事件。
8. 编辑器窗口校验事件 manifest 的 sessionId 和 modRoot 是否匹配本窗口目标。
9. 编辑器窗口把失效事件应用到本窗口 query cache 和 resource cache。
10. 编辑器窗口 ViewModel 按 query cache 失效类型重查主实体或刷新派生数据；主实体 dirty 时通过 Draft Session 暂存外部 spec，派生刷新不得重置当前 draft。

### 贴图上传保存事件

1. 编辑器窗口调用贴图上传编排。
2. 贴图上传编排调用贴图上传服务完成写盘。
3. 上传结果包含文件变更时发送贴图上传保存事件。
4. 主窗口保存监听收到贴图上传保存事件。
5. 主窗口保存编排把事件 sessionId、modRoot 和 WriteResult 交给 File History Session。
6. File History Session 校验事件 sessionId 和 modRoot 是否匹配当前 ProjectManifest。
7. File History Session 把 WriteResult.changes 写入文件级 history。
8. File History Session 按 WriteResult.invalidation.paths 刷新 ProjectSession。
9. ProjectSession refresh 编排更新主窗口 ProjectManifest。
10. ProjectSession refresh 编排清理主窗口本地 query cache 和 resource cache。
11. ProjectSession refresh 编排广播 ProjectSession 失效事件。

## 规范

- URL 参数序列化只能省略 null 和 undefined，空字符串必须作为显式输入传递。
- ProjectSession 失效事件必须携带更新后的 manifest 和 invalidation。
- 保存类事件必须携带 sessionId、modRoot 和 WriteResult。
- 单例 key 必须使用结构化业务身份序列化，不得用分隔符拼接多个字段。
- 既有窗口复用必须先显示再聚焦。
- 跨窗口事件 handler 可以异步，监听适配层必须等待 handler promise 并把错误交给注册方。
- 跨窗口事件 payload 必须表达完整业务身份，监听方不得用当前 active Mod 补齐缺失身份。
- 文件编辑器保存事件必须携带 path。
- 文件编辑器聚焦事件必须用 null 表示清空上下文。
- 文件编辑器文本应用事件必须携带 sessionId、modRoot、path 和 text。
- 文件编辑器文本应用事件只能由 File History Session 在 ProjectSession refresh 成功后发送；命中 dirty 文件编辑器时只能暂存外部文本，不能覆盖当前 textarea。
- 窗口 label 必须由 label prefix 和规范化 singleton key hash 组成。
- 窗口创建时必须保持 hidden，显示时机交给启动挂载链路。
- 编辑器保存事件必须携带 kind、id 和 spec。
- 编辑器窗口收到 ProjectSession 失效后只能清理本窗口 cache，由 ViewModel 按 query 失效类型决定刷新粒度。
- 编辑器窗口收到保存事件时必须校验 sessionId、modRoot、目标 id 和当前 bundle 类型。
- 编辑器窗口 ViewModel 必须通过 Edit Target Draft Session 拥有专用 editor 的目标身份、base、draft、dirty、外部更新暂存和 revision；子组件不得把外部 props 变化直接当作覆盖草稿的依据。
- 专用 editor dirty 时，外部保存事件和主实体 detail 失效只能暂存外部 spec 并提示，不能覆盖当前 draft。
- 贴图上传保存事件必须携带 filename、overwritten、sessionId、modRoot 和 WriteResult。
- 主窗口处理保存类事件前必须校验事件 sessionId 与当前 ProjectManifest 匹配。

## 陷阱

- 把窗口 label 直接拼成业务字段，会让路径大小写、斜杠差异和分隔符碰撞破坏单例边界。
- 把窗口事件适配层接入业务日志或 app 配置，会让底层事件通道反向依赖应用业务。
- 用当前 active Mod 补齐保存事件身份，会把旧窗口或非活动 Mod 的写入记到错误 history。
- 子窗口直接刷新 ProjectSession，会绕过主窗口 manifest owner 并造成多窗口 manifest 分裂。
- 子窗口保存后只更新自身状态而不广播保存事件，会丢失主窗口 history 和 session 失效链路。
- 文件历史回放后不通知打开的文件编辑器，会让窗口文本停留在已被磁盘回放覆盖的旧内容。
- 文件历史回放命中 dirty 文件编辑器时直接覆盖 textarea，会丢失未保存文本草稿。
- 文件编辑器复用既有窗口时不发送聚焦上下文，会让错误行和上下文提示保留旧目标。
- 编辑器窗口把任意 query cache 失效都当成完整 bundle 失效，会重置本地草稿并造成无关资源变化影响主实体。
- 编辑器窗口在 dirty 状态下直接应用同实体外部保存事件，会覆盖未保存的专用 editor 草稿。
- 业务模块绕过托管窗口入口直接创建 WebviewWindow，会丢失单例复用、初始隐藏、权限边界和 URL 参数规则。
