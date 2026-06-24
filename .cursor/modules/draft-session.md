# Draft Session 草稿会话系统

## 定义

Draft Session 草稿会话系统负责前端编辑目标的正式草稿状态。系统分两层：`useDraftSession` 是无业务目标的底层状态机；`useEditTargetDraftSession` 是业务编辑器唯一可直接消费的目标会话，拥有目标身份、加载、保存、外部更新暂存和竞态保护。

## 参考

- `src/app/composables/use-draft-session.ts`：底层 primitive，只拥有 base、draft、dirty、pending external、revision 和 stable compare。
- `src/app/composables/use-edit-target-draft-session.ts`：业务编辑目标会话，接收 target、load、save 和 targetKey。
- `src/app/composables/use-config-editor-draft-session.ts`：配置编辑器接入点，配置组件通过它消费目标草稿会话。
- `src/app/composables/use-editor-window-view-model.ts`：专用 editor 主 spec 目标会话 owner。
- `src/app/composables/use-file-editor-view-model.ts`：文件编辑器文本目标会话 owner。
- `src/app/composables/use-text-history.ts`：文件编辑器窗口局部 undo/redo，不拥有 base 或外部更新。
- `src/stores/tables.store.ts`：CSV 表级 dirty 和文件级外部更新标记，是相邻模型，不接入 Draft Session。
- `scripts/architecture/rules/draft-session-boundary.mjs`：禁止业务直接使用底层 primitive 或恢复旧式手写草稿状态。

## 边界

- 业务编辑器不得直接导入 `useDraftSession`；只能通过 `useEditTargetDraftSession` 或模块专用接入点消费草稿能力。
- `useDraftSession` 不知道 target、load、save、service、orchestrator、window event 或业务错误文案。
- `useEditTargetDraftSession` 不导入业务 service/store/orchestrator；加载和保存只能由调用方通过回调注入。
- target identity 必须由调用方提供 `targetKey(target)`；同一外部更新、保存完成和异步返回都必须先匹配当前 target。
- dirty 时外部更新只能进入 pending external；不得覆盖 draft。
- 保存成功后使用 `commitSaved()` 提升 base；不得递增 revision。
- 新目标加载、导入、载入外部版本和非 dirty 外部更新使用 `loadBase()`，必须递增 revision。
- 派生资源、source options、projectile options 和 preview data 不属于主草稿，不得通过 Draft Session 覆盖主 spec。
- CSV dirty 是表级 patch/window 模型；不得把 CSV rows 包成单个 Draft Session value。

## 链路

### 加载编辑目标

1. ViewModel 或模块接入点构造 target。
2. 调用 `loadTarget(target)`。
3. `useEditTargetDraftSession` 记录 `currentTarget` 和 `targetKey`，设置 loading。
4. 调用注入的 `load(target)`，结果可同步或异步。
5. 返回仍匹配当前 target 时，底层 `loadBase(value)` 写入 base 和 draft，清空 pending，并递增 revision。

### 用户修改

1. 组件或子编辑器产生领域草稿值。
2. ViewModel 调用 `setDraft(value)`。
3. 底层状态机克隆写入 draft。
4. dirty 由 stable deep compare 从 base 和 draft 派生。

### 外部更新

1. ViewModel 收到保存事件、query invalidation、manifest 更新或 file text-applied。
2. ViewModel 用正式解析链路得到同 target 的新值。
3. 调用 `applyExternalForTarget(target, value)`。
4. target 不匹配时忽略。
5. dirty 为 false 时 `loadBase(value)`；dirty 为 true 时只写入 pending external 并显示提示。

### 载入外部版本

1. 用户点击载入外部版本。
2. ViewModel 调用 `loadPendingExternal()`。
3. pending external 被提升为 base 和 draft。
4. pending 清空，revision 递增。

### 保存草稿

1. 用户触发保存。
2. ViewModel 调用 `saveDraft()`。
3. `useEditTargetDraftSession` 捕获当前 target 和 targetKey，设置 saving。
4. 调用注入的 `save(target, draft)`。
5. 返回仍匹配当前 target 时，若 save 返回 value 则 commit 返回值，否则 commit 当前 draft。
6. 保存失败不提升 base、不清空 pending、不发送成功语义。

## 规范

- `load(target)` 是唯一加载入口，props/store 派生数据也必须通过它返回 snapshot。
- `save(target, draft)` 可返回后端或保存链路规范化后的 value；未返回时 commit 当前 draft。
- `loadBase()` 只在加载新基准时使用；`commitSaved()` 只在保存成功后使用。
- `loadBase()` 只在生成的 draft 与当前 draft 内容不同时递增 revision；内容相同的外部更新或保存回声不得递增 revision。
- `resetDraft()` 只恢复当前 base，不清空 pending external。
- `clearTarget()` 必须清空 target identity、loading/saving/error 和草稿值。
- 文件编辑器 text history 只记录局部文本输入；载入新 target、载入外部文本和非 dirty text-applied 必须清空 text history。
- 专用 editor 子组件只消费 `draftRevision` 判断是否重置本地 working copy；组件不得拥有 base/pending 状态。
- 配置组件通过 `useConfigEditorDraftSession` 接入，不直接导入底层 primitive。
- 架构 lint 必须阻止业务模块恢复 `useDraftSession` 直用、旧方法名或旧手写状态名。

## 陷阱

- 业务直接导入 `useDraftSession`，会重新分裂出没有 target identity 和竞态保护的半模型。
- 让 `loadBase()` 在 draft 内容未变时仍递增 revision，会让保存回声和等值外部更新无意义重置专用 editor 子组件的 working copy。
- 外部更新直接写 draft 会覆盖用户未保存草稿。
- 在 target session 内导入 service 或 orchestrator，会让通用模块反向拥有业务保存边界。
- 用普通 `JSON.stringify()` 判断 dirty，会让对象 key 顺序影响草稿状态。
- 把 CSV rows 当成单个草稿值，会破坏 rowKey、patch、window query 和文件级外部更新模型。
