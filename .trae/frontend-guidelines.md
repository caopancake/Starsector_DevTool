# Frontend Guidelines

本文档只记录当前前端实现必须遵守的长期规则。当前规则之外的设计资料只写入 `todo.md` 或 `reference.md`。

## 目录与命名

- Vue 单文件组件使用 PascalCase，例如 `ShipEditor.vue`、`ConfigFileHistoryView.vue`。
- 职责层文件统一使用 dot 后缀：`*.service.ts`、`*.store.ts`、`*.orchestrator.ts`、`*.window.ts`、`*.events.ts`。
- `src/domain/` 文件不得使用 service、store、orchestrator 这类职责后缀，只使用能力名或数据名。
- `src/shared/types/` 文件使用 `*.types.ts`，`index.ts` 和 `workspace.ts` 作为共享类型入口例外。
- `src/app/components/config/` 组件统一使用 `Config*` 前缀；编辑器组件保留用户概念名，例如 `ShipEditor.vue`。
- 禁止在职责层文件名中混用旧 kebab 后缀和 dot 后缀；新增文件优先按目录职责表达层级。
- `src/app/` 只放应用壳、窗口挂载入口、全局 provider、页面装配和 Vue 业务组件。
- `src/domain/` 只放纯业务模型、schema、表格规则和编辑器纯工具，不调用后端、不访问 store。
- `src/services/` 只放后端 API 调用和单一业务服务。
- `src/stores/` 只放 Pinia store。
- `src/orchestrators/` 只放跨 store、service、history 和窗口的用户动作编排。
- `src/windows/` 只放窗口创建、窗口事件和窗口生命周期协调。
- `src/shared/` 只放跨模块复用的纯工具、Tauri 适配、共享类型和 UI 基础能力。
- 项目内导入统一使用 `@/...` 别名，不新增相对跨层导入。
- 术语、类型和变量名必须体现边界：CSV 草稿历史使用 `csvEditHistory`，文件级保存历史使用 `fileHistory`，编辑器窗口内局部历史使用 `localEditorHistory`。

## 组件边界

- 组件负责渲染、用户输入和组件内临时 UI 状态。
- 组件不得直接拼接磁盘路径、调用 Rust command 处理文件写入，必须通过 service 或 orchestrator。
- 组件不得直接写入任意跨层状态；跨模块操作必须通过 orchestrator 或明确的 store 状态入口。
- 组件内可以保留局部 undo/redo，但保存级行为必须交给文件级历史系统。
- 业务组件需要提示、确认框或主题信息时，优先使用 app provider 注入的入口；非组件代码使用统一 adapter。

## Store 与 Service

- 前端访问后端的唯一宏观链路是 `前端 -> shared/api -> Rust command -> service -> 后端实现`，任何情况都不允许绕过。
- 前端业务代码不得直接 import `@tauri-apps/api/core`，不得直接执行 `invoke()`；只有 `src/shared/api/` 可以封装 Tauri command。
- hull 引用解析必须走 `src/shared/lib/hull-references.ts`；组件不得直接用 `shipSprites[hullId]` 解析舰船、舰船皮肤、装配或联队缩略图。
- `npm.cmd run lint` 包含架构静态检查；shared 依赖方向、分层矩阵、前端后端链路、组件和 store 的 API 边界、保存入口、文件历史记录入口、配置 entity 保存入口、schema 注册与依赖方向和 AppData 关键缓存同步都必须通过该检查。
- 架构静态检查以目录层级、文件职责后缀和类型形状为主，不用业务文件白名单放行；新增同类模块必须天然落入现有层级规则。
- Store 拥有内存状态和纯状态变更，不直接承担文件 IO、确认弹窗、跨模块编排。
- Service 负责单一业务能力，例如打开窗口、保存文件、同步缓存或回放历史。
- Orchestrator 负责一次用户动作跨越多个模块的流程，例如 CSV 保存、配置保存、文件级 undo/redo。
- Orchestrator 导出函数不得和 domain 纯函数同名；带 store、副作用或当前选择状态的函数名必须体现状态来源。
- API adapter 只封装 Tauri command/event 的调用形状，不包含业务决策。
- `shared` 工具不得反向依赖任何上层应用目录。

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
- 二进制贴图上传和覆盖必须进入文件级 changeset，不得跳过文件历史。

## 编辑器与窗口

- 舰船、武器、弹体和发射预览使用独立 Tauri 窗口。
- 编辑器窗口按 `kind + normalized modRoot + id` 单例化；再次打开同一目标只聚焦已有窗口。
- 编辑器窗口独立加载自身需要的 `AppData`，加载失败只影响当前窗口。
- 编辑器窗口保存 `.ship`、`.wpn`、`.proj` 只写对应 spec，不隐式保存 CSV。
- 文件编辑器窗口按文件路径单例化；保存只写当前文件，不触发自动重新加载。
- 主窗口与独立窗口之间通过 Tauri event 同步已保存的文本或 spec。

## UI 与 CSS

- 视觉大于一切；前端实现不得为了性能、代码简化或临时交互绕过既有视觉规则。
- 视觉规则以 `css-guidelines.md` 为准，组件不得内联绕过主题 token。
- 页面级布局、导航、表格、详情面板、配置页、文件历史、编辑器窗口和弹窗样式必须使用对应 CSS 模块。
- 新增控件应复用既有按钮、输入、列表、表格、面板和消息样式。
- 文案必须和容器尺寸匹配，按钮和紧凑面板不得用过大的标题字号。
