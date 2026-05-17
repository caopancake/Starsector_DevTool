# Frontend Guidelines

前端使用 Vue 3 + TypeScript + Pinia + Naive UI。目标是长期可维护的桌面工具前端：状态边界清晰、保存语义明确、交互稳定，不为了短期便利牺牲数据契约。

## 目录边界

- `src/app/`：应用壳、全局 provider、顶层路由和跨 feature 编排。
- `src/features/`：按业务域组织功能模块；feature 内部优先自洽，避免把业务状态散到全局。
- `src/shared/`：跨 feature 的 API adapter、类型和通用 Starsector 工具函数；不能放具体页面流程。
- `src/styles/`：全局样式模块和主题 token；具体规则见 `.trae/css-guidelines.md`。
- 新增目录或跨层复用前，先确认它表达的是稳定边界，而不是为了减少单文件行数。

## 职责规则

- 组件负责展示、用户事件和局部流程编排；复杂业务流程应沉到 feature service 或 store。
- Store 负责可共享业务状态、dirty tracking、选择状态、打开/关闭编辑器等；不要把临时 DOM 状态提升到 store。
- Service 表达业务动作并封装后端调用语义；组件不直接拼 Tauri command payload。
- Composable 只承载稳定、可复用的交互能力，例如快捷键 scope、画布 viewport、history 操作。
- Shared 只放真正跨 feature 复用的类型、API 和纯工具；没有多个调用方时不要提前抽 shared。
- 共享 UI 组件只放稳定的跨 feature 控件，例如统一选色器；组件内部负责归一化输入，调用方负责声明保存格式和业务语义。
- 类型定义应靠近真实契约。前后端共享 payload 变更时，前端类型、API adapter 和使用点必须一起更新。

## 多 Mod 工作区规则

- workspace store 是编排层：管理 Mod 列表、活动 Mod、视图路由和展开状态，不持有 AppData。
- project store 是数据缓存层：按 `modRoot` 隔离 AppData，不把当前活动 Mod 当作唯一数据源。
- tables、editors、history 等业务 store 必须按 Mod 隔离状态，不能在切换 Mod 时串选择、dirty 或弹窗引用。
- 所有写入操作必须明确指向目标 `modRoot`；不要依赖“当前活动 Mod”作为隐式保存边界。
- 持久化只保存工具工作区状态，不把私有 UI 状态写进 Mod 目录。
- 恢复会话时要能处理 Mod 缺失、读取失败和重复导入；失败 Mod 保留可移除状态。
- dirty state 必须使用稳定 row id / row key 追踪，不能退回按表格索引追踪。

## 编辑器边界

- Canvas 通用能力可以抽为 composable；具体编辑语义留在对应编辑器内。
- 舰船、武器、弹体编辑器各自维护坐标换算和业务语义；不要为了共享代码合并不同领域模型。
- 画布交互必须保持可预测：选择、拖拽、预览、快捷键和右侧检查器联动要有清晰优先级。
- 编辑器保存 `.ship/.wpn/.proj` 与顶部 CSV 保存是两条独立链路，不能互相代写。
- undo/redo 接入统一 history 体系；局部 history 只能作为编辑器内部操作粒度的实现细节。
- 像素资源画布和预览必须使用邻近采样，不允许退回模糊缩放或线性插值。
- 贴图上传、路径选择和尺寸同步不得改变 spec 保存边界以外的数据。

## UI 与 CSS

- 视觉风格、CSS 模块归属、主题 token 和具体控件样式要求见 `.trae/css-guidelines.md`。
- 本文不重复 CSS 细则；涉及布局、控件风格、主题色和图像预览时，以 CSS 指导为准。
- 页面交互必须服务实际工具工作流，不做营销式 landing page 或解释性装饰界面。
- Schema 表单统一通过 `sourceId.key` 聚合数据源；保存时由业务组件拆回各源。
- Schema、设置页和编辑器内的颜色字段使用共享 `ColorPicker`；输出格式由字段契约决定，不由组件猜测保存边界。

## 提示反馈

- 用户触发的保存、删除、导入、上传、生成等动作完成后必须有可见反馈。
- 失败不能只写 console；提示要包含动作和原因，便于定位问题。
- 成功提示必须匹配真实保存边界，例如 CSV、`.ship`、`.wpn`、`.proj`、`.faction`、workspace。
- `message.*` 只出现在 UI 边界；service、shared API 和 composable 抛错或返回结构化结果。
- 危险操作必须用 danger/error 语义，并说明是否只删除索引、是否删除实体文件。

## 蓝图编辑器规则（Phase 17 规划）

- 蓝图编辑器应作为独立 feature 建模，不混入现有表格或 spec 编辑器状态。
- 蓝图数据、节点库和代码生成输出要分清保存边界；保存蓝图不应隐式覆盖生成代码。
- 节点定义应由数据驱动，社区库节点包不能硬编码进画布组件。
- 代码生成由后端 service 承担，前端负责配置、预览和用户确认。
