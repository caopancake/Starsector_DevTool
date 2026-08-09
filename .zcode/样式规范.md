# 样式规范（AI 规则）

## 视觉模型

- 高密度桌面数据工具，IDE 结构：42px 标题栏、左导航、中工作区、右详情/检查器；信息密度优先，不做营销 hero、装饰渐变/插图/光斑或嵌套大卡片。
- 视觉一致性优先于性能和实现便利。复用既有控件与全局模块；稳定布局不用 inline style，只有动态色值、data URL、canvas 尺寸可 inline。
- 像素图必须 `pixelated`（canvas 同时 `crisp-edges`）；预览不用 `object-fit: cover`；字体固定 `Inter, Segoe UI, Microsoft YaHei, sans-serif`，不得 viewport 缩放。

## 样式位置与 token

- `src/styles/index.css` 依次导入：`base/titlebar/app-shell/workspace/overview/settings/config/file-history/schema-forms/tables/detail-pane/editors`；`main.ts` 另导入仅供文件编辑器的 `file-editor.css`。
- 全局主题、Naive UI 覆盖、共享面板/控件在 `base.css`；其它规则归其业务 CSS。scoped CSS 仅允许单组件、不会复用的局部规则；第二处使用即迁入对应模块。
- 只使用既有 `--space-{1..4}`、`--radius-{sm,md,lg}`、主题的 `--color-*`、`--shadow-*` 和 `--color-canvas-bg` token；不得新增全局色 token 或用硬编码颜色替代 token。
- 所有可见边框为 `1px solid`，仅既定 active 左条可更粗；普通圆角不大于 10px，圆形仅用于点、handle、滚动条 thumb。

## 布局与控件

- `html/body/#app` 固定全视口、无 margin、`overflow:hidden`；`*` 使用 border-box；按钮和输入继承字体。
- 主框架：标题栏 42px、导航 224px、workspace topbar 62px、详情列 280px。新增页面保持 `min-width/min-height:0` 和明确滚动 owner。
- 用 4/8/12/16px 间距、5/8/10px 圆角；Naive 输入/选择为紧凑 30px/12px。复用既有 panel、button、input、list、table、message class。
- 表格没有重复操作列；行操作在详情面板/专用窗口。禁止负 margin、emoji、文本符号替代图标和孤立 modal 尺寸。
- 文案必须匹配紧凑容器；标题、ellipsis、nowrap、滚动与空状态遵从既有同类页面。

## 修改前检查

1. 先查 `src/styles/` 与同类组件的 class；复用其布局和 token。
2. 新增跨页面规则写入所属 CSS，且遵守 index 导入顺序。
3. 运行 `npm.cmd run format:check`、`npm.cmd run lint`、`npm.cmd run typecheck`；视觉变化必须人工检查亮/暗主题、窄窗口、滚动、hover/focus/disabled。
