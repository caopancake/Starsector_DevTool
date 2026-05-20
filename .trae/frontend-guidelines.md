# Frontend Guidelines

本文档只记录当前前端实现必须遵守的长期规则。当前规则之外的设计资料只写入 `todo.md` 或 `reference.md`。

## 目录与命名

- Vue 单文件组件使用 PascalCase，例如 `ShipEditor.vue`、`ConfigFileHistoryView.vue`。
- 职责层文件统一使用 dot 后缀：`*.service.ts`、`*.store.ts`、`*.orchestrator.ts`、`*.window.ts`、`*.events.ts`。
- 禁止在职责层文件名中混用旧 kebab 后缀和 dot 后缀；新增文件优先按目录职责表达层级。
- `src/domain/` 文件不得使用 service、store、orchestrator 这类职责后缀，只使用能力名或数据名。
- `src/shared/types/` 文件使用 `*.types.ts`，`index.ts` 作为共享类型入口。
- `src/app/components/config/` 组件统一使用 `Config*` 前缀；编辑器组件保留用户概念名，例如 `ShipEditor.vue`。
- `src/app/` 只放应用壳、窗口挂载入口、全局 provider、页面装配和 Vue 业务组件。
- `src/domain/` 只放纯业务模型、schema、表格规则和编辑器纯工具，不调用后端、不访问 store。
- `src/services/` 只放后端 API 调用和单一业务服务。
- `src/stores/` 只放 Pinia store。
- `src/orchestrators/` 只放跨 store、service、history 和窗口的用户动作编排。
- `src/windows/` 只放窗口创建、窗口事件和窗口生命周期协调。
- `src/shared/` 只放跨模块复用的纯工具、Tauri 适配、共享类型和 UI 基础能力。
- 项目内导入统一使用 `@/...` 别名，不新增相对跨层导入。

## 组件边界

- 组件负责渲染、用户输入和组件内临时 UI 状态。
- 组件不得直接拼接磁盘路径、调用 Rust command 处理文件写入，必须通过 service 或 orchestrator。
- 组件不得直接写入任意跨层状态；跨模块操作必须通过 orchestrator 或明确的 store 状态入口。
- 业务组件需要提示、确认框或主题信息时，优先使用 app provider 注入的入口；非组件代码使用统一 adapter。

## Store 与 Service

- 前端访问后端的唯一宏观链路是 `前端 -> shared/api -> Rust command -> service -> 后端实现`，任何情况都不允许绕过。
- 前端业务代码不得直接 import `@tauri-apps/api/core`，不得直接执行 `invoke()`；只有 `src/shared/api/` 可以封装 Tauri command。
- 引用解析必须走对应统一引用入口，组件不得绕过引用解析边界。
- 架构静态检查以目录层级、文件职责后缀、导入关系和类型形状为主，不得通过业务文件名、业务扩展名或模块名白名单放行。
- 任何 `shared/api` 调用只能出现在 `shared/api`、service 或 orchestrator；组件、store、domain 和普通 composable 不得直接导入。
- Tauri package 只能出现在 `shared/api`、`shared/runtime`、`windows` 或窗口根边界；业务组件不得直接访问 Tauri command、dialog、event 或 window API。
- Store 拥有内存状态和纯状态变更，不直接承担文件 IO、确认弹窗、跨模块编排。
- Service 负责后端 API 调用和单一业务能力，不承担跨模块用户动作编排。
- Orchestrator 负责一次用户动作跨越多个模块的流程。
- Orchestrator 导出函数不得和 domain 纯函数同名；带 store、副作用或当前选择状态的函数名必须体现状态来源。
- API adapter 只封装 Tauri command/event 的调用形状，不包含业务决策。
- `shared` 工具不得反向依赖任何上层应用目录。
- 持久化应用设置必须走 app data 配置服务，禁止使用浏览器 storage。
- 主窗口是应用设置运行态权威；独立窗口只能接收主窗口传入和广播的 settings snapshot，不得读取配置或自行补默认值。

## 工作区与状态

- 多 Mod 状态必须按 `modRoot` 隔离，dirty、选择、CSV 草稿历史、文件级历史和窗口引用不能串 Mod。
- `project.store` 是已加载 `AppData` 的前端缓存，不是磁盘权威状态。
- `tables.store` 只管理表格草稿状态、选择状态和 dirty 状态；保存副作用由表格保存 orchestrator 处理。
- 游戏目录概览只代表轻量扫描结果，不等同于完整读取 Mod。

## 保存与历史

- 保存动作必须走声明的保存边界和历史编排。
- 已写盘保存、撤销和重做必须以后端 changeset 结果为准。

## 编辑器与窗口

- 独立窗口必须通过窗口边界创建、单例化和同步。
- 编辑器窗口保存只能写声明拥有的目标。
- 所有字段编辑入口必须遵守设置中的编辑模式：纯文本模式只提供文本或 JSON 文本编辑，增强控件模式可使用 schema 和引用控件。
- Schema 字符串字段必须保留换行；纯文本模式不得用单行输入吞掉真实换行，增强控件模式遇到换行必须自动使用多行输入。

## UI 与 CSS

- 视觉大于一切；前端实现不得为了性能、代码简化或临时交互绕过既有视觉规则。
- 视觉规则以 `css-guidelines.md` 为准，组件不得内联绕过主题 token。
- 新增控件应复用既有按钮、输入、列表、表格、面板和消息样式。
- 文案必须和容器尺寸匹配，按钮和紧凑面板不得用过大的标题字号。

# 验证目标

- `npm.cmd run typecheck` 必须通过。
- `npm.cmd run lint` 必须通过。
- `npm.cmd run format:check` 必须零 error 零 warn。
- `npm.cmd run encoding:check` 必须通过。
