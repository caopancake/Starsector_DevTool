# CSS Guidelines

本文档只记录 `src/styles/` 必须遵守的长期视觉规则。组件专属样式归对应业务 CSS 或模块文档；通用调查和验证流程见 `.zcode/workflow.md`。

## 视觉模型

- 界面必须保持高密度 Windows 桌面数据工具结构，以标题栏、Mod 页签、左导航、中工作区和右详情区域为稳定骨架。
- 视觉必须安静、紧凑并支持重复操作；严禁使用营销 hero、装饰性光斑、无业务含义插图或嵌套大卡片组织工作区。
- 字体必须使用 `--font-sans`，其当前值为 `Inter, Segoe UI, Microsoft YaHei, sans-serif`；字号严禁随 viewport 宽度缩放。
- 像素资源必须使用 `image-rendering: pixelated`，需要时同时声明 `crisp-edges`；可检查资源必须使用 `object-fit: contain`。

## 文件 ownership

- `src/styles/index.css` 必须按 `base`、`titlebar`、`app-shell`、`workspace`、`overview`、`settings`、`config`、`file-history`、`schema-forms`、`tables`、`detail-pane`、`editors`、`file-editor` 的顺序导入。
- `src/main.ts` 必须在全局入口只导入 `index.css` 这一个样式入口，子窗口样式由同一聚合文件覆盖。
- `base.css` 必须拥有主题 token、全视口基础、Naive UI 覆盖和跨模块共享控件；业务布局必须位于对应业务 CSS。
- scoped CSS 只允许保存单组件且不会复用的局部规则；第二处复用时必须迁入对应业务 CSS 或 `base.css`。
- 稳定布局严禁使用 inline style；动态色值、data URL 和 canvas 尺寸只允许由组件以动态值传入。

## Token

- 间距必须复用 `--space-{1..4}`，当前对应 4、8、12、16 px。
- 普通圆角必须复用 `--radius-{sm,md,lg}`，当前对应 5、8、10 px；圆形只允许用于点、handle 和滚动条 thumb。
- 页面和组件颜色必须使用现有 `--color-*`、`--scrollbar-*` 与 `--color-canvas-bg`；共享阴影必须使用 `--shadow-floating` 或 `--shadow-subtle`。
- 新增共享视觉语义必须由 `base.css` 在明暗主题中同时定义；业务 CSS 严禁用硬编码颜色替代现有语义 token。
- 可见边框必须使用 1 px；只有既定 active 指示条和控件 handle 允许使用更粗边界。

## 固定布局

- `html`、`body` 与 `#app` 必须固定 100 vw × 100 vh、margin 0、`overflow: hidden`；所有元素必须使用 border-box。
- `.app-frame` 必须保持 42 px 标题栏、38 px Mod 页签和剩余工作区三行结构。
- `.app-shell` 必须保持 224 px 左导航；`.workspace` 必须保持 62 px topbar；详情列和 `.detail-pane` 必须保持 280 px。
- 所有 grid、flex、页面和滚动容器必须显式维护 `min-width: 0`、`min-height: 0` 与唯一滚动 owner。
- 固定格式控件必须使用稳定尺寸或 grid track，严禁因 hover、错误文本、异步数据或空状态改变整体布局。

## 控件与内容

- Naive UI 输入和选择必须保持 30 px 最小高度与 12 px 字号，并复用现有紧凑覆盖。
- 表格操作必须由当前行选择、详情面板或专用窗口承载，严禁增加重复操作列。
- 按钮必须使用现有图标库和控件样式；严禁使用 emoji 或文本符号代替图标。
- 标题、ellipsis、nowrap、换行、滚动和空状态必须与容器尺寸匹配，任何 viewport 下严禁文字重叠或溢出控件。
- 修改视觉前必须先检查 `src/styles/` 和同类组件；完成后必须按 `.zcode/workflow.md` 执行自动检查和人工视觉验收。

## 复用边界

- 引入新视觉形态前必须先找最接近的现有参考物，优先复用现有 token 与结构；说不清它解决了什么现有问题，就默认不引入。
- 同一局部规则出现第二处复用时必须上移到对应业务 CSS 或 `base.css`；严禁保留多份"差不多但不完全一样"的样式。
- 弹窗、状态块与表单控件必须复用现有基座与覆盖，严禁在单页发明 `modal-overlay`、私有按钮或私有状态体系。
- 相同类型的卡片、按钮、输入与弹窗必须共享边框、尺寸、主次关系、危险态与禁用态；同类网络错误使用相近文案与提示方式。
- 拖拽、画布选中态、hover 操作区等复杂交互样式优先留在对应模块样式中，严禁为统一外观强制抹平领域行为。

## 禁止项

- 严禁为单个页面发明新圆角、阴影、按钮或输入框规范。
- 相同语义严禁在不同页面使用不同主色或危险色；局部美化不得破坏整体统一性。
- 严禁随 viewport 缩放字号，严禁文字重叠或溢出控件。
- 严禁使用 emoji 或文本符号代替图标。
- 严禁把纯布局状态错误挂到远端请求链路上。
- 页面里无模板引用的旧 scoped CSS 必须直接删除，严禁搬进共享样式充数。
