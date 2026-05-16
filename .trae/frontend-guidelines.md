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

## 多 Mod 工作区规则

- workspace.store 是编排层：管理 Mod 列表、活动 Mod 和视图路由，不持有 AppData。
- project.store 是数据缓存层：`modsData: Map<modRoot, AppData>`，`data` computed 指向活动 Mod。
- tables.store 和 editors.store 使用 `stateMap: Map<modRoot, PerModState>` 实现 per-Mod 隔离。
- 对外 API 通过 computed proxy 保持向下兼容，内部读写当前 Mod 的状态。
- 切换 Mod 时由 App.vue 的 watch 同步触发所有 store 的 `activateFor(modRoot)`。
- 持久化由 App.vue 的 watch 防抖 500ms 后调用 `saveWorkspace()`；恢复期间跳过自动保存。
- Mod 数据加载失败时标记 error 状态，允许用户移除失效项。

## 编辑器边界

- Canvas 的通用能力可以抽为 composable：viewport、网格绘制、快捷键、历史记录、贴图上传。
- 业务强绑定逻辑留在编辑器组件内，例如舰船 hit detection、舰船 drag mutation、武器 barrel drag。
- 坐标编辑应保持可预测；当前拖拽坐标以 0.5 为单位吸附。
- 舰船编辑器和武器编辑器允许保留各自的坐标换算与选择语义；共享的是交互原则，而不是强行抽成同一套业务模型。
- 画布内选择应尽量跟随最近可编辑目标；右侧检查器点击可以形成临时强选择，但不能破坏下一次画布操作的直觉。
- undo/redo 使用统一 history composable，避免各编辑器自建状态栈。
- 在所有情况下，画布必须以邻近采样进行渲染，不允许退回模糊缩放或线性插值。
- 这个规则同时适用于舰船编辑器、武器编辑器、发射预览，以及任何后续新增的像素资源画布或缩略图画布。

## UI 方向

- 目标风格：Native UI、现代圆角、Notion 风格极简、高密度专业工具。
- 默认使用用户上次选择的浅色或暗色主题；两套主题都必须保持状态色可读。
- 圆角保持克制，常规控件和面板控制在 6-10px，不使用大圆角卡片化视觉。
- 字间距保持系统默认，不设置负字距；表格和表单以紧凑行高保证数据工具密度。
- 首页应是实际工具界面，不做营销 landing page。
- 主要操作入口放在上下文明确的位置，例如右侧详情面板和编辑器 footer。
- 上下文已经由面板、分组或弹窗标题明确表达时，按钮文案应保持精简，例如在“甲板”分组内使用“添加”“删除”，不要写成“添加甲板”“删除甲板”。
- 表格区优先信息密度、扫描效率和稳定滚动，不放重复操作列；表格只负责选择记录和单元格编辑。
- 右侧详情面板是上下文操作面板，优先呈现当前记录摘要、缩略图和编辑器/预览入口，字段 KV 只做速览。
- 右侧详情预览必须完全由当前 tab 和当前记录派生，不保留局部缓存；有图显示图，能推导路径但加载失败时显示“贴图缺失”和相对路径，无法推导资源时显示模块专属“无预览”说明。
- 联队当前没有专用资源预览链路，不猜测 `.variant` 或图标路径；工业使用 CSV 的 `image` 字段作为右侧详情预览来源。
- 舰船和武器编辑器采用画布主导 + 右侧检查器；弹体编辑器采用标准表单弹窗。
- 编辑器右侧表单优先使用分组卡片视觉；低频或高级字段可以继续折叠。
- 高密度字段行优先使用内联图标按钮和短标签；只有需要明显主操作时才使用整行文字按钮。
- 舰船和武器画布的槽位、边界、中心、护盾、引擎和炮口视觉由编辑器共享绘制 helper 统一维护；武器槽位按类型几何、尺寸层级和选中态表达，非槽位元素也必须保持同一套清晰对比风格。
- 视觉重设计时优先整理布局、间距、色彩 token 和控件层级。

## 提示反馈

- 任何保存按钮在按下并完成处理后，必须给出成功、无改动或失败提示。
- 任何失败的用户行为都必须给出可见提示，不能只在控制台记录或静默失败。
- 失败提示应说明当前动作和失败原因，例如“保存 CSV 失败”或“上传贴图失败”。
- 成功提示应匹配真实保存边界，例如顶部保存提示 CSV，编辑器保存提示 `.ship/.wpn/.proj`。
- `message.*` 只应出现在 UI 边界：`src/app` 组件或具体 feature 组件；service、shared API 和 composable 不直接弹提示。
- service 应抛统一前端错误类型，UI 边界使用统一格式化函数展示错误，避免重复拼接失败文案。

## CSS 原则

- CSS 入口是 `src/styles/index.css`，不要恢复单一全局巨型样式文件。
- `base.css` 只放全局 reset、CSS token、主题变量和滚动条基础样式。
- `titlebar.css` 只放自定义窗口标题栏和窗口控制按钮样式。
- `app-shell.css` 只放应用壳、左侧导航、顶部业务栏、空状态和主内容布局。
- `tables.css`、`detail-pane.css`、`editors.css` 分别承载对应模块样式。
- 共享 UI 结构优先使用稳定语义 class，例如 action group、section card、inspector、footer actions；只有出现真实复用和稳定语义时再抽 Vue 组件。
- 编辑器共享结构组件只承载壳层和插槽，例如 header、footer、inspector；不得承载保存、上传、画布交互或具体字段业务。
- 新增样式优先放入语义匹配的 CSS 模块；只有跨模块稳定复用的 token 才进入 `base.css`。
- 总览页和设置页的页面级布局未来放入 `app-shell.css`；Mod 列表导航仍归 `app-shell.css`；表格、右侧详情和编辑器样式不得混放到这些未来页面规则里。
- 跨页面稳定复用的 panel、section title、empty state、action row 可以放入 `base.css`，但必须保持语义通用，不能带具体业务名称。
- 主题通过 `data-theme="light|dark"` 切换，颜色、间距、边框、阴影、圆角优先使用 token。
- 自定义标题栏取代系统窗口栏，窗口拖动和最小化/最大化/关闭逻辑应集中在标题栏组件。
- 不使用一整套相近色相堆叠的单调主题。
- 禁止依赖布局副作用修 UI；优先使用明确的 grid、flex、min/max 尺寸和 overflow 规则。

## 蓝图编辑器规则（Phase 17 规划）

- 蓝图编辑器位于 `src/features/blueprint/`，遵循标准 feature 结构（store/service/components/composables/lib）。
- 节点画布复用 ShipEditor 的画布基础能力（viewport composable、缩放/平移/网格）。
- 节点类型定义采用 JSON Schema 描述，位于 `blueprints/nodes/`，运行时加载。
- 社区库节点（MagicLib/GraphicsLib/LazyLib/LunaLib/BoxUtil）作为独立节点包加载，不硬编码到画布组件。
- 对话流编辑器是蓝图画布的特化模式，节点类型受限为对话相关（台词/选项/条件/动作）。
- 模板向导是独立组件，使用 SchemaFormRenderer 驱动表单，输出交给 Rust codegen service。
- 蓝图 JSON 序列化格式独立于代码生成；蓝图保存不触发 Java 生成，需用户显式"生成代码"。
- 蓝图编辑器使用独立 undo/redo 栈（不混入全局 history），因其操作粒度不同于 CSV/spec 编辑。
