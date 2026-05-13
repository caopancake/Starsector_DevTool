# Frontend Guidelines

前端使用 Vue 3 + TypeScript + Pinia + Naive UI。结构目标是高密度、可维护、原生工具感，不追求网页营销式布局。

## 目录边界

- `src/app/`：应用壳、全局 provider、主布局编排。
- `src/features/`：按业务域组织的功能模块，例如 project、tables、editors。
- `src/shared/`：跨 feature 复用的 API、类型、通用 Starsector 工具函数。
- feature 内部可以有 `components/`、`composables/`、`lib/`、`*.store.ts`、`*.service.ts`。

## 职责规则

- 组件负责展示、用户事件和少量业务流程编排。
- Store 负责状态、dirty tracking、当前选择、打开/关闭编辑器等业务状态。
- Service 负责后端调用语义，不让组件直接知道 Tauri command 细节。
- Composable 只承载稳定、可复用的交互能力；不要为了减少组件行数而过度拆分。
- Shared 只放真正跨 feature 复用的类型、API 和工具。

## 编辑器边界

- Canvas 的通用能力可以抽为 composable：viewport、网格绘制、快捷键、历史记录、贴图上传。
- 业务强绑定逻辑留在编辑器组件内，例如舰船 hit detection、舰船 drag mutation、武器 barrel drag。
- 坐标编辑应保持可预测；当前拖拽坐标以 0.5 为单位吸附。
- undo/redo 使用统一 history composable，避免各编辑器自建状态栈。

## UI 方向

- 目标风格：Native UI、现代圆角、Notion 风格极简、高密度专业工具。
- 首页应是实际工具界面，不做营销 landing page。
- 主要操作入口放在上下文明确的位置，例如右侧详情面板和编辑器 footer。
- 表格区优先信息密度、扫描效率和稳定滚动，不放重复操作列。
- 视觉重设计时优先整理布局、间距、色彩 token 和控件层级。

## 提示反馈

- 任何保存按钮在按下并完成处理后，必须给出成功、无改动或失败提示。
- 任何失败的用户行为都必须给出可见提示，不能只在控制台记录或静默失败。
- 失败提示应说明当前动作和失败原因，例如“保存 CSV 失败”或“上传贴图失败”。
- 成功提示应匹配真实保存边界，例如顶部保存提示 CSV，编辑器保存提示 `.ship/.wpn/.proj`。
- `message.*` 只应出现在 UI 边界：`src/app` 组件或具体 feature 组件；service、shared API 和 composable 不直接弹提示。
- service 应抛统一前端错误类型，UI 边界使用统一格式化函数展示错误，避免重复拼接失败文案。

## CSS 原则

- 当前 `src/styles.css` 仍是待整理状态。
- 全局 CSS 只应保留基础 token、窗口布局、全局 reset 和跨模块通用工具样式。
- 模块样式后续应按页面或 feature 聚合，避免单一全局文件继续膨胀。
- 不使用一整套相近色相堆叠的单调主题。
- 禁止依赖布局副作用修 UI；优先使用明确的 grid、flex、min/max 尺寸和 overflow 规则。
