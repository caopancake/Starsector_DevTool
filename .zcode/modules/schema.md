# 字段模式系统

## 定义

将正式 schema 映射为配置/编辑器字段渲染、校验与引用选择。

## Owner 与链路

- domain/schema runtime 拥有字段语义、source、normalization 与纯转换；Schema 组件只渲染/提交字段事件；ViewModel 提供上下文与 Draft Session。
- 引用 source 经统一 query/service 返回选项与 ResourceRef，资源缓存批量补图；已选的 CSV ID 也必须回查当前 Mod、再回查原版的同一行，复用名称与资源引用。只有不存在于任何来源的旧值才作为纯 ID 保留。
- 舰船 ID 的显示名称必须优先使用 `ship_data.csv` 的 `name`；只有该名称缺失或为空时才允许使用对应 `.ship` 的 `hullName`，两者均为空时只允许显示 hull ID。
- 联队 ID 的 CSV 行没有名称列时，source query 以其 `variant` 的 `displayName` 作为显示名称，并继续沿用该 variant 的舰体资源引用；菜单项和已选标签均消费同一个 `SelectOption`。
- Bundled schema 在注册时校验每个 `csv:` source 的表名必须属于正式 CSV 表注册表；无效 source 必须阻止注册，不得静默渲染为空下拉。

## 不变量

- plain editMode 只显示文本/JSON 文本；smart 才使用增强控件。字符串真换行必须使用 textarea。
- Smart 下拉的选项菜单与已选标签共用同一 `SelectOption`；可解析资源一律显示缩略图及 CSV 标签（名称与 ID），不可解析的手输值仅显示其 ID。
- 前端不得通过字段名猜语义、构造 ResourceRef、扫描文件或在 schema 组件内写盘；未知/额外字段按正式 JSON 边界保留。
