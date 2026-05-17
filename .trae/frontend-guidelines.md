# Frontend Guidelines

本文档只记录当前前端实现必须遵守的长期规则。当前规则之外的设计资料只写入 `todo.md` 或 `reference.md`。

## 目录与命名

- Vue 单文件组件使用 PascalCase，例如 `ShipEditor.vue`、`FileHistoryView.vue`。
- 其它前端文件统一使用 kebab-case，例如 `file-history-store.ts`、`config-save-orchestrator.ts`。
- 禁止在前端文件名中混用 dot 分层和 kebab-case；新增文件优先按模块目录表达层级。
- `src/app/` 只放应用壳、窗口挂载入口和全局 provider。
- `src/features/<domain>/` 是业务模块边界，模块内可以包含 component、store、service、api、types。
- `src/shared/` 只放跨模块复用的纯工具、Tauri 适配、窗口基础设施和 UI 基础能力。
- 术语、类型和变量名必须体现边界：CSV 草稿历史使用 `csvEditHistory`，文件级保存历史使用 `fileHistory`，编辑器窗口内局部历史使用 `localEditorHistory`。

## 组件边界

- 组件负责渲染、用户输入和组件内临时 UI 状态。
- 组件不得直接拼接磁盘路径、调用 Rust command 处理文件写入，必须通过所属 feature 的 service 或 orchestrator。
- 组件不得直接写入其它 feature 的 store；跨模块操作必须通过公开 service。
- 组件内可以保留局部 undo/redo，但保存级行为必须交给文件级历史系统。
- 业务组件需要提示、确认框或主题信息时，优先使用 app provider 注入的入口；非组件代码使用统一 adapter。

## Store 与 Service

- Store 拥有内存状态和纯状态变更，不直接承担文件 IO、确认弹窗、跨模块编排。
- Service 负责单一业务能力，例如打开窗口、保存文件、同步缓存或回放历史。
- Orchestrator 负责一次用户动作跨越多个模块的流程，例如 CSV 保存、配置保存、文件级 undo/redo。
- API adapter 只封装 Tauri command/event 的调用形状，不包含业务决策。
- `shared` 工具不得反向依赖 feature。

## 工作区与状态

- 多 Mod 状态必须按 `modRoot` 隔离，dirty、选择、CSV 草稿历史、文件级历史和窗口引用不能串 Mod。
- `project.store` 是已加载 `AppData` 的前端缓存，不是磁盘权威状态。
- `tables.store` 只管理表格草稿状态、选择状态和 dirty 状态；保存副作用由表格保存 orchestrator 处理。
- 游戏目录概览只代表轻量扫描结果，不等同于完整读取 Mod。
- 没有业务 ID 的空行仍然是可编辑、可删除的 CSV 行，但不得显示 spec 编辑入口。

## 保存与历史

- CSV 单元格编辑、新建行、删除行只进入 CSV 草稿历史，不写磁盘。
- CSV 保存成功后清空当前 `modRoot + tableKey` 的 CSV 草稿历史。
- CSV 保存、配置保存、文件编辑器保存、舰船/武器/弹体 spec 保存都必须进入文件级保存历史。
- 文件级保存历史只记录 `FileChangeRecord[]` changeset，undo/redo 必须通过后端 `apply_file_change_set` 写回磁盘。
- 文件级 undo/redo 必须先确认，写盘成功后再移动 undo/redo 栈；失败时栈保持原样。
- 二进制贴图覆盖暂不进入文件级 changeset，只能作为不可逆屏障记录。

## 编辑器与窗口

- 舰船、武器、弹体和发射预览使用独立 Tauri 窗口。
- 编辑器窗口按 `kind + normalized modRoot + id` 单例化；再次打开同一目标只聚焦已有窗口。
- 编辑器窗口独立加载自身需要的 `AppData`，加载失败只影响当前窗口。
- 编辑器窗口保存 `.ship`、`.wpn`、`.proj` 只写对应 spec，不隐式保存 CSV。
- 文件编辑器窗口按文件路径单例化；保存只写当前文件，不触发自动重新加载。
- 主窗口与独立窗口之间通过 Tauri event 同步已保存的文本或 spec。

## UI 与 CSS

- 视觉规则以 `css-guidelines.md` 为准，组件不得内联绕过主题 token。
- 页面级布局、导航、表格、详情面板、配置页、文件历史、编辑器窗口和弹窗样式必须使用对应 CSS 模块。
- 新增控件应复用既有按钮、输入、列表、表格、面板和消息样式。
- 文案必须和容器尺寸匹配，按钮和紧凑面板不得用过大的标题字号。
