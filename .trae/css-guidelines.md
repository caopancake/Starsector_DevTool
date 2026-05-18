# CSS Guidelines

本文档固定当前项目的视觉系统。所有规则来自 `src/styles/`、`src/main.ts` 和当前 Vue class 用法。本文档只写当前已实现样式，不写功能路线。

## 视觉总则

- 项目视觉是高密度桌面数据工具，不使用营销页 hero、装饰插图、装饰渐变、装饰光斑。
- 主结构必须保持 IDE 布局：标题栏、左侧导航、中间工作区、右侧详情或检查器。
- 信息密度优先于留白装饰；页面 section 不包成嵌套大卡片。
- 稳定布局不得写 inline style；inline style 只允许承载动态值，例如颜色 swatch、图片 data URL、canvas 尺寸。
- 表格不放重复操作列；行级上下文操作固定放在右侧详情面板或专用窗口。
- 像素资源必须使用 `image-rendering: pixelated`，画布资源同时保留 `image-rendering: crisp-edges`。
- 字体不得按 viewport 缩放；全局字体固定为 `Inter, Segoe UI, Microsoft YaHei, sans-serif`。
- 所有可见边框使用 `1px solid`，除特别列出的左侧 active 指示条外不得使用 2px 以上边框。

## 样式入口与模块归属

- `src/styles/index.css` 是主样式入口，导入顺序固定为 `base`、`titlebar`、`app-shell`、`workspace`、`overview`、`settings`、`config`、`file-history`、`schema-forms`、`tables`、`detail-pane`、`editors`。
- `src/main.ts` 在主样式入口之后额外导入 `src/styles/file-editor.css`，该文件只服务文件编辑器窗口。
- `base.css` 只放全局 reset、主题 token、Naive UI 基础覆盖、滚动条、共享面板、共享 ColorPicker、共享 switch。
- `titlebar.css` 只放自定义标题栏、品牌区和窗口控制按钮。
- `app-shell.css` 只放主框架、左侧导航基础、工作区顶栏、空状态、确认弹窗内容布局、主内容 grid。
- `workspace.css` 只放导航扩展、Mod 树、Mod 树菜单、模块按钮、状态行。
- `overview.css` 只放工作区总览、游戏目录概览、Mod 卡片和扫描 warning。
- `settings.css` 只放设置页、主题色选择、设置表单和顶栏搜索/势力筛选宽度。
- `config.css` 只放 Mod 信息、势力、战役、配置实体列表、配置预览和 Mod 信息总览。
- `file-history.css` 只放文件历史检查页。
- `schema-forms.css` 只放 Schema section、字段行、数组对象、键值编辑器、JSON 额外字段、紧凑图标按钮。
- `tables.css` 只放 CSV 表格、单元格、编辑态输入和表格空提示。
- `detail-pane.css` 只放右侧详情面板、预览、操作区、字段速览。
- `editors.css` 只放舰船、武器、弹体、发射预览窗口、画布、检查器、编辑器表单和编辑器列表。
- 组件 scoped 样式只能用于完全局部且不形成跨页面规则的样式；一旦出现第二个调用点，必须迁入对应模块文件。

## Token 固定值

- 间距 token 固定为 `--space-1: 4px`、`--space-2: 8px`、`--space-3: 12px`、`--space-4: 16px`。
- 圆角 token 固定为 `--radius-sm: 5px`、`--radius-md: 8px`、`--radius-lg: 10px`。
- 亮色背景 token 固定为 `--color-bg: #f7f7f5`、`--color-panel: #ffffff`、`--color-panel-muted: #fafafa`、`--color-surface: #f1f1ef`。
- 暗色背景 token 固定为 `--color-bg: #0f1115`、`--color-panel: #171a20`、`--color-panel-muted: #13161b`、`--color-surface: #20242c`。
- 主文字 token 使用 `--color-text`；次级文字使用 `--color-text-soft`；弱文字使用 `--color-muted`；占位和极弱文字使用 `--color-faint`。
- 主色状态使用 `--color-primary`、`--color-primary-hover`、`--color-primary-pressed`、`--color-primary-soft`、`--color-primary-border`。
- 主色反白文字使用 `--color-on-primary`。
- warning 使用 `--color-warning`、`--color-warning-bg`、`--color-warning-border`；danger 使用 `--color-danger`、`--color-danger-bg`、`--color-danger-text`；success 使用 `--color-success`、`--color-success-bg`。
- 文件编辑器错误边框和行高亮使用 `--color-danger-border-soft`、`--color-danger-highlight-soft`、`--color-danger-highlight`、`--color-danger-highlight-border`。
- 浮层阴影固定使用 `--shadow-floating`；普通面板阴影固定使用 `--shadow-subtle`。
- canvas 背景固定使用 `--color-canvas-bg`。

## 全局基础元素

- `html`、`body`、`#app` 必须是 `width: 100vw`、`height: 100vh`、`margin: 0`、`overflow: hidden`。
- `button`、`input`、`textarea` 必须继承 `font: inherit`。
- `*` 必须使用 `box-sizing: border-box`。
- 滚动条宽度和高度固定为 10px；thumb 最小高度 36px；thumb border 固定为 `3px solid transparent`；thumb radius 固定为 `999px`。
- `.muted` 只能设置 `color: var(--color-muted)`，不得附加字号、margin 或布局。

## Naive UI Select 与输入覆盖

- `.n-base-selection` 最小高度固定 30px，字号固定 12px，圆角固定 `--radius-sm`。
- `.n-base-selection` 常态边框固定 `1px solid var(--color-border)`。
- `.n-base-selection` hover 边框固定 `1px solid var(--color-border-strong)`。
- `.n-base-selection` active/focus 边框固定 `1px solid var(--color-primary-border)`，阴影固定 `inset 0 0 0 1px var(--color-primary-border)`。
- `.n-base-selection-label` 最小高度固定 30px，背景固定 `--color-panel`，hover 背景固定 `--color-panel-muted`。
- `.n-base-selection-input`、placeholder、render label 字号固定 12px。
- 多选 tag 间距固定 4px，tag 容器 padding 固定 `3px 4px`。
- `.n-base-select-menu` option 高度固定 28px，option 字号固定 12px，菜单 padding 固定 4px，菜单圆角固定 `--radius-md`。
- `.n-base-select-option` 单行 margin 固定 `1px 0`，padding 固定 `0 8px`，圆角固定 `--radius-sm`。
- `.n-input-number .n-button` 和 `.n-input-number .n-button-group` 必须 `display: none`。

## Titlebar

- `.titlebar` 固定 `display: grid`，列为 `minmax(0, 1fr) auto`，高度和最小高度均为 42px。
- `.titlebar` 背景固定 `--color-panel`，底边框固定 `1px solid var(--color-border)`，必须 `user-select: none`。
- `.titlebar-brand` 固定 `display: flex`，gap 固定 8px，水平 padding 固定 12px。
- `.titlebar-mark` 固定 24px × 24px，圆角 5px，背景 `--color-primary`，文字 `--color-on-primary`，字号 11px，字重 750。
- `.titlebar-text` 固定 `display: grid`，line-height 固定 1.2。
- `.titlebar-text strong` 字号固定 12px，字重 650。
- `.titlebar-text span` 字号固定 11px，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.titlebar-button` 固定宽 44px，高 100%，padding 0，背景透明，border 0。
- `.titlebar-button:hover` 背景固定 `--color-surface-hover`，关闭按钮 hover 背景固定 `--color-danger` 且文字 `--color-on-primary`。
- `.titlebar-button svg` 固定 16px × 16px，`stroke-width: 1.8`。

## App Shell

- `.app-frame` 固定 grid 行 `42px 1fr`，宽高均为 100vw/100vh，背景 `--color-bg`，overflow hidden。
- `.app-shell` 固定 grid 列 `224px 1fr`，min-width/min-height 均为 0，overflow hidden。
- `.nav-pane` 固定 flex column，gap 8px，padding 12px，背景 `--color-panel-muted`，右边框 `1px solid var(--color-border)`，overflow auto。
- `.nav-section` 固定 grid，gap 8px，padding-bottom 8px。
- `.nav-label` 固定 padding `4px 8px`，字号 11px，字重 650，颜色 `--color-muted`。
- `.workspace` 固定 grid 行 `62px 1fr`，position relative，overflow hidden。
- `.topbar` 固定 grid 列 `minmax(180px, 1fr) auto`，gap 16px，padding `10px 16px`，背景 `--color-panel`，底边框 `1px solid var(--color-border)`。
- `.view-title` 字号固定 18px，字重 700，line-height 1.25，必须 ellipsis 且 nowrap。
- `.view-meta` 字号固定 12px，颜色 `--color-muted`。
- `.top-actions` 和 `.top-action-group` 固定 flex row，gap 8px。
- `.top-action-group` 左 padding 固定 8px，左边框固定 `1px solid var(--color-border)`；第一个 action group 必须取消左 padding 和左边框。
- `.content-grid` 固定 grid 列 `minmax(0, 1fr) 280px`，overflow hidden。
- `.empty-state` 固定 grid，gap 14px，place-content center，文字居中；h1 字号固定 28px，p 使用 `--color-muted`。

## 导航按钮与 Mod 树

- `.nav-button` 基础高度固定 34px，圆角 `--radius-md`，文字左对齐。
- `.nav-button .n-button__content` 固定 grid 列 `minmax(0, 1fr) minmax(28px, auto)`，gap 12px。
- `.nav-text` 必须 `min-width: 0`、ellipsis、nowrap。
- `.nav-button.active` 文字色 `--color-primary`，背景 `--color-primary-soft`，内阴影 `inset 0 0 0 1px var(--color-primary-border)`。
- `.nav-workspace-links` gap 固定 2px，margin-bottom 8px，padding-bottom 8px，底边框 `1px solid var(--color-border)`。
- `.nav-workspace-links .nav-button` 固定高度 32px，padding `0 8px`，border `1px solid transparent`，圆角 `--radius-sm`。
- `.nav-workspace-links .nav-button:focus` 必须 outline none；`:focus-visible` 必须 border `--color-primary-border` 且内阴影 `inset 0 0 0 1px var(--color-primary-border)`。
- `.mod-tree` 固定 flex column，gap 1px，overflow-y auto。
- `.mod-tree-item` 圆角固定 `--radius-sm`，不得使用真实 border 占用布局空间。
- `.mod-tree-item.expanded` 背景固定 `color-mix(in srgb, var(--color-panel-muted) 58%, transparent)`，边界固定使用 `box-shadow: inset 0 0 0 1px var(--color-border)`。
- `.mod-tree-header` 固定 flex row，gap 4px，padding `5px 8px`，圆角 `--radius-sm`，transition `background 0.1s`。
- `.mod-tree-header:hover` 背景固定 `--color-surface-hover`；active header 背景固定 `--color-surface-active`。
- `.mod-tree-chevron` 固定 16px × 16px，背景 transparent，border 0；expanded 状态固定 `transform: rotate(90deg)`。
- `.mod-tree-name` 字号固定 13px，字重 500，必须 ellipsis 且 nowrap。
- `.mod-tree-dirty-dot` 固定 7px × 7px，border-radius 50%，背景 `--color-warning`。
- `.mod-tree-menu` 固定 20px × 20px，字号 14px，line-height 1，圆角 `--radius-sm`，默认 opacity 0；header hover 时 opacity 1。
- `.mod-tree-dropdown` position absolute，z-index 100，right 8px，margin-top 2px，padding 4px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-floating`。
- `.mod-tree-dropdown button` padding 固定 `6px 12px`，字号 12px，圆角 `--radius-sm`。
- `.mod-tree-modules` padding 固定 `3px 4px 5px`。
- `.mod-tree-separator` 高度固定 1px，margin `4px 0`，背景 `--color-border`，opacity 0.75。
- `.mod-tree-module-btn` grid 列固定 `minmax(0, 1fr) auto`，gap 8px，min-height 28px，padding `0 8px`，字号 12px，圆角 `--radius-sm`。
- `.mod-tree-module-btn.module-active` 背景 `--color-primary-soft`，文字 `--color-primary`，字重 500。
- `.mod-tree-module-count` 字号 11px，颜色 `--color-muted`，右对齐。
- `.mod-tree-status` padding 固定 `4px 10px 4px 28px`，字号 12px；错误状态颜色固定 `--color-danger`。

## Overview 与 Mod Card

- `.overview-page` padding 固定 `28px 36px`，overflow-y auto。
- `.overview-header h1` margin 固定 `0 0 4px`，字号 22px，字重 600。
- `.overview-subtitle` margin 固定 `0 0 22px`，字号 13px，颜色 `--color-muted`。
- `.overview-grid` grid 列固定 `repeat(auto-fill, minmax(300px, 1fr))`，gap 16px。
- `.game-overview` gap 固定 16px。
- `.game-overview-summary` grid 列固定 `minmax(0, 1fr) auto`，gap 12px，padding 16px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`。
- `.game-overview-summary strong` 字号 13px，颜色 `--color-text`；span 字号 12px，颜色 `--color-muted`；两者必须 ellipsis 且 nowrap。
- `.game-warning-list` gap 固定 8px。
- `.game-warning-item` gap 固定 2px，padding 12px，背景 `--color-warning-bg`，border `1px solid var(--color-warning-border)`，圆角 `--radius-md`。
- `.game-warning-item strong` 字号 12px，颜色 `--color-warning`；span 字号 11px，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.game-overview-empty` gap 8px，padding `var(--space-5)`；如果 `--space-5` 未定义，必须先补 token，禁止在组件内硬编码替代。
- `.overview-mod-card` gap 8px，padding 16px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`。
- `.overview-mod-card` transition 固定 `border-color 0.15s, background 0.15s, box-shadow 0.15s`。
- `.overview-mod-card:hover` border-color `--color-border-strong`，背景 `--color-panel-muted`。
- `.overview-mod-card.card-active` border-color `--color-primary`，内阴影 `inset 0 0 0 1px var(--color-primary-border)`。
- `.mod-card-header` flex row，gap 8px；strong 字号 14px，必须 ellipsis 且 nowrap。
- `.mod-card-version` 字号 12px，颜色 `--color-muted`。
- `.mod-card-status` padding 固定 `1px 6px`，字号 11px，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.mod-card-status.ready` 背景 `--color-success-bg`，文字 `--color-success`；`.error` 背景 `--color-danger-bg`，文字 `--color-danger-text`。
- `.mod-card-path` 字号 11px，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.mod-card-description` 字号 12px，line-height 1.45，必须 `-webkit-line-clamp: 2`。
- `.mod-card-actions` justify-content 固定 flex-end，padding-top 4px。
- `.mod-card-dirty` margin-top 4px，字号 11px，颜色 `--color-warning`。

## Settings

- `.settings-page` gap 12px，padding `28px 36px`，overflow-y auto。
- `.settings-header h1` margin `0 0 8px`，字号 22px，字重 600。
- `.settings-section` width 固定 `min(680px, 100%)`，gap 8px，padding 16px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`。
- `.settings-section h3` 字号 14px，字重 600，margin 0。
- `.settings-row` flex row，justify-content space-between，gap 12px，padding `4px 0`，字号 13px。
- `.settings-row > span` 必须 flex-shrink 0，颜色 `--color-text-soft`。
- `.settings-control-row` flex 1，gap 8px，min-width 0；内部 `.n-input` 必须 flex 1。
- `.settings-number-input` 宽度固定 120px。
- `.accent-settings` gap 8px，justify-items start。
- `.accent-swatch-grid` flex wrap，gap 8px。
- `.accent-swatch-button` 固定 28px × 28px，padding 0，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.accent-swatch-button:hover` 背景 `--color-panel-muted`，border-color `--color-border-strong`。
- `.accent-swatch-button.active` border-color `--color-primary`，内阴影 `inset 0 0 0 1px var(--color-primary)`。
- `.accent-swatch-button span` 固定 16px × 16px，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.accent-custom-control` grid 列固定 `auto minmax(260px, 1fr)`，gap 8px，min-height 32px，padding `2px 8px`，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.settings-hint` padding-top 4px，字号 12px，颜色 `--color-muted`；error 状态颜色 `--color-danger`。
- `.settings-footer` width 固定 `min(680px, 100%)`，justify-content flex-end，padding-top 4px。
- `.top-search-input` 宽度固定 240px；`.top-faction-select` 宽度固定 180px。

## Config Pages

- `.config-factions-layout` 和 `.mission-view` 必须 flex 1，min-height 0，overflow hidden。
- `.config-entity-list` 宽 220px，min-width 200px，背景 `--color-panel-muted`，右边框 `1px solid var(--color-border)`，overflow hidden。
- `.faction-list` 宽度固定 240px。
- `.config-entity-list-header` padding 固定 `12px 16px`，底边框 `1px solid var(--color-border)`。
- `.config-entity-list-header h3` 和 `.mission-editor-header h3` 字号 14px，字重 650，margin 0。
- `.config-entity-list-items` padding `8px 0`，margin 0，overflow-y auto，list-style none。
- `.config-entity-list-empty` padding `12px 16px`，字号 12px，line-height 1.5，颜色 `--color-faint`。
- `.config-entity-list-item` grid 列固定 `24px minmax(0, 1fr) 28px`，gap 8px，padding `6px 16px`，字号 13px。
- `.config-entity-list-item:hover` 背景 `--color-surface-hover`，文字 `--color-text`。
- `.config-entity-list-item.active` 背景 `--color-primary-soft`，文字 `--color-primary`，内阴影 `inset 2px 0 0 var(--color-primary)`。
- `.config-entity-thumb` 固定 24px × 24px，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-sm`，overflow hidden。
- `.config-entity-thumb img` 固定 width/height 100%，object-fit contain，image-rendering pixelated。
- `.config-entity-name` 必须 ellipsis 且 nowrap。
- `.config-entity-delete` 默认 opacity 0；item hover 时 opacity 1。
- `.color-swatch` 固定 14px × 14px，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.mission-editor-header` padding `12px 16px`，背景 `--color-panel`，底边框 `1px solid var(--color-border)`。
- `.mission-editor-body` gap 12px，padding 16px，overflow-y auto。
- `.mission-icon-preview` 固定 88px × 88px，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-md`，overflow hidden。
- `.faction-editor-page` padding `12px 16px`，overflow-y auto。
- `.faction-editor-header` padding-bottom 8px，margin-bottom 12px，底边框 `1px solid var(--color-border)`。
- `.faction-editor-header h2` 字号 15px，字重 650。
- `.mod-overview-page` gap 12px，padding `28px 36px`，背景 `--color-panel-muted`，overflow-y auto。
- `.mod-overview-grid` grid 列固定 `repeat(2, minmax(180px, 1fr))`，gap 12px。
- `.mod-overview-card` gap 4px，padding 16px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`。
- `.mod-overview-card strong` 字号 22px，字重 650，必须 ellipsis 且 nowrap。
- `.mod-overview-breakdown` width 固定 `min(520px, 100%)`，border `1px solid var(--color-border)`，圆角 `--radius-md`，overflow hidden。
- `.mod-overview-breakdown-row` grid 列固定 `minmax(0, 1fr) auto`，min-height 32px，padding `0 12px`，字号 12px。
- `.faction-previews` grid 列固定 `minmax(220px, 410px) minmax(160px, 256px)`，gap 12px，padding 12px，border `1px solid var(--color-border)`，圆角 `--radius-md`。
- `.faction-full-preview` border `1px solid var(--color-border)`，圆角 `--radius-sm`，image-rendering pixelated。

## File History

- `.file-history-page` gap 12px，padding `28px 36px`，背景 `--color-panel-muted`，overflow-y auto。
- `.file-history-header` flex row，gap 12px，align-items flex-start，justify-content space-between。
- `.file-history-header h1` margin `0 0 4px`，字号 22px，字重 650。
- `.file-history-header p` 字号 12px，颜色 `--color-muted`。
- `.file-history-summary` grid 列固定 `repeat(3, minmax(120px, 1fr))`，gap 12px。
- `.file-history-summary > div` gap 4px，padding 12px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`。
- `.file-history-summary span` 字号 12px，颜色 `--color-muted`；strong 字号 20px，字重 650。
- `.file-history-stacks` grid 列固定 `repeat(2, minmax(0, 1fr))`，gap 12px。
- `.file-history-panel` 背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`，overflow hidden。
- `.file-history-panel > header` flex row，gap 8px，padding 12px，底边框 `1px solid var(--color-border)`。
- `.file-history-panel h2` 字号 14px，字重 650。
- `.file-history-panel > header span` 字号 11px，颜色 `--color-muted`。
- `.file-history-empty` margin 0，padding 16px，字号 12px，颜色 `--color-muted`。
- `.file-history-entry` gap 8px，padding 12px，底边框 `1px solid var(--color-border)`。
- `.file-history-entry-main` grid 列固定 `auto minmax(0, 1fr) auto`，gap 8px。
- `.file-history-entry-index` 字号 11px，颜色 `--color-faint`。
- `.file-history-entry-main strong` 字号 12px，字重 650；内部 span 和 em 字号 11px，颜色 `--color-muted`。
- `.file-history-change-list` gap 4px，padding 0，margin 0，list-style none。
- `.file-history-change-list li` grid 列固定 `minmax(0, 1fr) auto`，gap 8px，字号 11px。
- `.file-history-change-list code` 必须 ellipsis 且 nowrap，颜色 `--color-text-soft`。

## Tables

- `.table-panel` position absolute，inset 固定 `0 280px 0 0`，overflow auto，背景 `--color-panel`。
- `.data-table` width 固定 `max-content`，min-width 固定 2400px，字号 12px，border-collapse collapse，table-layout auto。
- `.data-table th` 和 `td` max-width 固定 240px，高度固定 29px，padding 固定 `4px 9px`。
- `.data-table th` 和 `td` 必须 overflow hidden、ellipsis、nowrap。
- `.data-table th` 和 `td` 右边框和底边框固定 `1px solid var(--color-border)`。
- `.data-table th` sticky top 0，z-index 1，背景 `--color-panel`，文字色 `--color-text-soft`，字重 650，底部内阴影 `inset 0 -1px 0 var(--color-border-strong)`。
- `.data-table tr:hover td` 背景 `--color-surface-hover`。
- `.data-table tr.selected td` 背景 `--color-primary-soft`，内阴影 `inset 0 -1px 0 var(--color-primary-border)`。
- `.data-table td.dirty` 文字 `--color-warning`，背景 `--color-warning-bg`，内阴影 `inset 0 0 0 1px var(--color-warning-border)`。
- `.cell-input` width 100%，height 22px，背景 `--color-panel`，border `1px solid var(--color-primary)`，圆角 `--radius-sm`，outline none，box-shadow `0 0 0 2px var(--color-primary-soft)`。
- `.table-empty-note` padding 18px，字号 13px，颜色 `--color-warning`。

## Detail Pane

- `.detail-pane` position absolute，inset 固定 `0 0 0 auto`，宽度固定 280px，padding 12px，overflow auto，背景 `--color-panel-muted`，左边框 `1px solid var(--color-border)`。
- `.pane-title` margin-bottom 8px，字号 11px，字重 650，颜色 `--color-muted`。
- `.detail-card` margin-bottom 12px；`.record-card` gap 固定 10px。
- `.detail-id` 字号 15px，字重 700，颜色 `--color-primary`，overflow-wrap anywhere。
- `.detail-name` 字号 12px，颜色 `--color-text-soft`。
- `.detail-thumbnail` width 100%，height 126px，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-md`，overflow hidden。
- `.detail-thumbnail img` width/height 100%，object-fit contain，image-rendering crisp-edges 和 pixelated。
- `.thumbnail-placeholder` gap 6px，颜色 `--color-faint`；svg 固定 32px × 32px。
- `.thumbnail-placeholder strong` 字号 12px，颜色 `--color-text-soft`。
- `.thumbnail-placeholder span` max-width 210px，字号 11px，line-height 1.35，text-align center，overflow-wrap anywhere。
- `.detail-actions` display grid，gap 8px；操作按钮只能出现在该容器内。
- `.kv-list` gap 固定 5px。
- `.detail-pane .kv-row` grid 列固定 `92px 1fr`，gap 8px，padding `3px 0`，字号 12px，底边框 `1px solid var(--color-border)`。
- `.detail-pane .kv-row span` 颜色 `--color-muted`；strong 字重 500，overflow-wrap anywhere。
- `.detail-empty span` 字号 12px，line-height 1.45。

## 图像渲染规则

- Canvas、舰船、武器、弹体、缩略图、文件/配置预览图必须显式设置 `image-rendering: pixelated`。
- Canvas 元素必须同时保留 `image-rendering: crisp-edges` 和 `image-rendering: pixelated`。

## Panel Card 与 Empty Panel

- `.panel-card` display grid，gap 8px，padding 12px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-lg`，阴影 `--shadow-subtle`。
- `.panel-section-title` 字号 12px，字重 650，颜色 `--color-text-soft`。
- `.panel-empty` display grid，gap 4px，padding 12px，颜色 `--color-muted`，背景 `--color-panel`，border `1px dashed var(--color-border-strong)`，圆角 `--radius-lg`。
- `.action-row` flex row，gap 8px，align-items center。

## Schema Forms

- `.schema-form` flex column，gap 0。
- `.schema-section` margin-bottom 6px，background `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-subtle`，overflow hidden。
- `.section-header` flex row，gap 6px，padding `8px 12px`，字号 12px，字重 650，背景 `--color-surface`，底边框 `1px solid var(--color-border)`。
- `.section-header:hover` 背景 `--color-surface-hover`。
- `.section-chevron` 固定 12px × 12px，默认 rotate 90deg；collapsed rotate 0deg；svg 固定 12px × 12px，stroke-width 1.8。
- `.section-fields` flex column，gap 0，padding `8px 12px`。
- `.schema-field` grid 列固定 `110px minmax(0, 1fr)`，gap 固定 `4px 8px`，padding `3px 0`。
- `.schema-field.nested-row` padding-left 12px。
- `.field-label` padding-top 5px，字号 11px，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.field-control` flex column，gap 3px。
- `.field-switch` align-self flex-start，margin-top 1px。
- `.field-warning` 和 `.field-danger` 字号固定 10px；warning 颜色 `--color-warning`；danger 颜色 `--color-danger`。
- `.nested-object` flex column，padding `4px 0 4px 8px`，左边框 `2px solid var(--color-border)`。
- `.array-of-object` 和 `.key-value-editor` flex column，gap 4px，width 100%，overflow hidden。
- `.array-item` width fit-content，max-width 100%，padding `6px 8px`，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-sm`。
- `.array-item-header` flex row，justify-content space-between，gap 4px，margin-bottom 2px。
- `.array-item-index` 字号 10px，字重 650，颜色 `--color-muted`。
- `.kv-row` grid 列固定 `minmax(96px, 140px) minmax(220px, 1fr) 28px`，gap 4px。
- `.reference-key-value .kv-row` grid 列固定 `minmax(220px, 1fr) 88px 28px`，用于 `csv:*` key-value 引用频率编辑。
- `.json-field-row` grid 列固定 `120px minmax(0, 1fr) auto`，gap 8px，padding `3px 0`。
- `.json-field-key` padding-top 5px，字号 11px，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.json-field-empty` padding `8px 0`，字号 12px，颜色 `--color-muted`。
- `.json-field-add` flex row，gap 8px，padding-top 8px。
- `.json-field-new-key` 宽度固定 140px。
- `.compact-icon-button` 固定 28px × 28px，min-width 28px，padding 0；svg 固定 14px × 14px，stroke-width 1.8。

## ColorPicker

- `.color-picker` grid 列固定 `auto minmax(0, 1fr)`，gap 4px。
- `.color-picker-label` grid-column `1 / -1`，字号 12px，字重 650，颜色 `--color-text-soft`。
- `.color-picker-preview` 固定 26px × 26px，padding 0，border `1px solid var(--color-border)`，圆角 `--radius-sm`，背景必须包含 8px 棋盘格。
- `.color-picker-preview::after` width/height 100%，背景 `var(--preview-color)`，圆角 `calc(var(--radius-sm) - 1px)`。
- `.color-picker-channels` grid 列固定 `repeat(4, minmax(48px, 1fr))`，gap 4px。
- `.color-picker-channels label` grid 列固定 `auto minmax(0, 1fr)`，gap 3px，字号 10px，字重 650，颜色 `--color-muted`。
- `.color-picker-panel` width 248px，padding 12px，gap 8px，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，阴影 `--shadow-floating`。
- `.color-picker-sv` height 140px，border `1px solid var(--color-border)`，圆角 `--radius-sm`，cursor crosshair。
- `.color-picker-sv-handle` 固定 10px × 10px，border `2px solid #fff`，border-radius 50%，box-shadow `0 0 0 1px rgba(0, 0, 0, 0.72)`。
- `.color-picker-slider-row` grid 列固定 `14px minmax(0, 1fr) auto`，gap 4px，字号 11px，字重 650。
- `.color-picker-alpha-value` min-width 24px，text-align right。
- `.color-picker-panel-preview` grid 列固定 `auto minmax(0, 1fr)`，gap 8px，字号 11px。
- `.color-picker-actions` flex row，justify-content flex-end，gap 8px。

## Editor Windows

- `.editor-window-app` grid 行固定 `1fr`，宽高 100vw/100vh，背景 `--color-bg`，overflow hidden。
- `.editor-window-app .modal-backdrop` position static，padding 0，背景 `--color-bg`。
- `.editor-window-app .editor-window`、`.preview-window`、`.projectile-window` 在独立窗口内必须 width/height 100%，border 0，radius 0，box-shadow none。
- `.modal-backdrop` 非独立窗口模式 position fixed，inset 0，z-index 10，place-items center，背景 `rgba(15, 23, 42, 0.42)`。
- `.editor-window`、`.preview-window`、`.projectile-window` grid 行固定 `52px 1fr 52px`，背景 `--color-panel`，border `1px solid var(--color-border-strong)`，圆角 `--radius-md`，阴影 `--shadow-floating`。
- `.editor-window` 宽固定 `min(1280px, calc(100vw - 40px))`，高固定 `min(820px, calc(100vh - 40px))`。
- `.projectile-window` 宽固定 `min(820px, calc(100vw - 40px))`。
- `.preview-window` 宽固定 `min(1100px, calc(100vw - 40px))`。
- `.editor-header` 和 `.editor-footer` min-height 56px，padding `9px 14px`，gap 12px，背景 `--color-panel`。
- `.editor-header` 底边框 `1px solid var(--color-border)`；`.editor-footer` 顶边框 `1px solid var(--color-border)`，背景 `--color-panel-muted`，底边框 0。
- `.editor-title` grid，gap 3px，line-height 1.3。
- `.editor-title strong` 字号 14px，字重 700；span 字号 12px，line-height 1.35，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.editor-body` position relative，display block，overflow hidden。
- `.canvas-stage` position absolute，inset `0 360px 0 0`，背景 `--color-canvas-bg`，overflow hidden。
- `.editor-canvas` width/height 100%，image-rendering crisp-edges 和 pixelated。
- `.editor-side` position absolute，inset `0 0 0 auto`，width 360px，padding 12px，背景 `--color-panel-muted`，左边框 `1px solid var(--color-border)`。
- `.inspector-title` margin-bottom 8px，字号 11px，字重 650，颜色 `--color-muted`。
- `.editor-scroll` height `calc(100% - 22px)`，padding-right 4px，overflow auto。
- `.projectile-body` height 100%，padding 12px，overflow auto。
- 发射预览窗口使用 `editor-body`、`canvas-stage` 和右侧 `editor-side` 控制面板布局，不在顶部或底部放速度按钮。
- `.preview-canvas-stage` inset 固定 `0 300px 0 0`；`.preview-window .editor-side` 宽度固定 300px。
- `.preview-canvas` width/height 100%，image-rendering crisp-edges 和 pixelated。
- `.preview-control-panel` grid gap 固定 16px；`.preview-control-section` 使用 panel 背景、边框和 8px 圆角；`.preview-control-actions` grid 两列。
- `.segmented` flex row，gap 4px，padding 3px，背景 `--color-surface`，border `1px solid var(--color-border)`，圆角 `--radius-md`。
- `.segmented button` 和 `.item-list button` padding `5px 10px`，border `1px solid transparent`，圆角 `--radius-sm`。
- `.segmented button.active`、`.item-list button.selected`、`.bounds-list .selected` 背景 `--color-panel`，文字 `--color-primary`，border-color `--color-primary`，阴影 `--shadow-subtle`。
- `.form-grid` grid 列固定 `110px minmax(0, 1fr)`，gap `7px 8px`，margin-bottom 12px。
- `.form-grid label` 字号 12px，颜色 `--color-muted`。
- `.sprite-field-row` grid 列固定 `minmax(0, 1fr) 30px`，gap 8px。
- `.sprite-icon-button` 固定 30px × 30px，min-width 30px，padding 0；svg 固定 15px × 15px，stroke-width 1.8。
- `.bounds-list` gap 6px，margin-bottom 8px；直接子 div grid 列固定 `28px 1fr 1fr auto`，gap 6px，padding 4px。
- 编辑器内 `textarea` min-height 96px，padding 8px，border `1px solid var(--color-border-strong)`，圆角 `--radius-sm`。
- `.editor-side .n-collapse-item` 和 `.projectile-body .n-collapse-item` 背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-lg`，阴影 `--shadow-subtle`。
- collapse header min-height 38px；header main padding `0 18px`，gap 8px；content inner padding `2px 16px 14px`。

## File Editor

- `.file-editor-page` grid 行固定 `auto auto minmax(0, 1fr)`，gap 12px，宽高 100vw/100vh，padding 16px，背景 `--color-bg`。
- `.file-editor-header` grid 列固定 `minmax(0, 1fr) auto`，gap 16px。
- `.file-editor-title` 字号 18px，字重 700。
- `.file-editor-path` 字号 12px，字体固定 `Consolas, Cascadia Mono, monospace`，颜色 `--color-muted`，必须 ellipsis 且 nowrap。
- `.file-editor-actions` flex row，gap 8px。
- `.file-editor-message` gap 4px，padding 12px，颜色 `--color-danger-text`，背景 `--color-danger-bg`，border `1px solid var(--color-danger-border-soft)`，圆角 `--radius-md`。
- `.file-editor-message span` 字号 12px，字重 700。
- `.file-editor-message p` margin 0，字体 `Consolas, Cascadia Mono, monospace`，字号 12px，line-height 1.45，overflow-wrap anywhere。
- `.file-editor-body` grid 列固定 `64px minmax(0, 1fr)`，背景 `--color-panel`，border `1px solid var(--color-border)`，圆角 `--radius-md`，overflow hidden。
- `.file-editor-gutter` 字体 `Consolas, Cascadia Mono, monospace`，字号 12px，line-height 20px，text-align right，背景 `--color-panel-muted`，右边框 `1px solid var(--color-border)`。
- `.file-editor-line-number` 高度固定 20px，padding `0 8px`。
- `.file-editor-line-number.active` 颜色 `--color-danger`，字重 700，背景 `--color-danger-highlight-soft`。
- `.file-editor-textarea` padding `0 12px`，字体 `Consolas, Cascadia Mono, monospace`，字号 12px，line-height 20px，background transparent，border 0，outline none，white-space pre。
- `.file-editor-line-highlight` left 固定 64px，高度 20px，背景 `--color-danger-highlight`，上下边框均为 `1px solid var(--color-danger-highlight-border)`。

## Dialogs And Messages

- Naive Message 必须通过 `buildThemeOverrides()` 接入主题 token。
- Message 背景固定使用 `--color-panel`，文字固定使用 `--color-text`，error 文字和 icon 固定使用 `--color-danger`。
- Message 阴影固定为 `--shadow-floating` 加 `inset 0 0 0 1px var(--color-border)`。
- Message border 固定为 0；hover close 背景固定 `--color-surface-hover`；pressed close 背景固定 `--color-surface-active`。
- `.associated-save-dialog` gap 12px；内部 p margin 0，颜色 `--color-muted`。
- `.associated-save-list` gap 8px。
- `.file-history-confirm` gap 8px；p margin 0，颜色 `--color-muted`。
- `.file-history-confirm-list` max-height 180px，padding-left 18px，margin 0，overflow auto，overflow-wrap anywhere。
- `NModal` 表单内容必须使用对应业务模块 class，不允许新增孤立 modal 私有尺寸。

## 禁止项

- 禁止新增未列入本文件的全局颜色 token。
- 禁止用硬编码颜色替代已有 token。
- 禁止使用负 margin。
- 禁止新增大于 10px 的普通控件圆角；全圆角只允许用于圆点、圆形 handle 和滚动条 thumb。
- 禁止使用 emoji。
- 禁止用纯文本符号替代已有图标按钮。
- 禁止在表格中新增操作列。
- 禁止让图片预览使用 `object-fit: cover`。
- 禁止依赖浏览器默认图像插值渲染像素资源。
