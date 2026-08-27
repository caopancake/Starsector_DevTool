# 字段模式系统

## 定义

将正式 schema 映射为配置/编辑器字段渲染、校验与引用选择。

## Owner 与链路

- domain/schema runtime 拥有字段语义、source、normalization 与纯转换；Schema 组件只渲染/提交字段事件；ViewModel 提供上下文与 Draft Session。
- `csv:` source 目录必须只由 `(sessionId, source)` 标识。目录必须完整返回当前 Mod 非注释唯一值与原版补集，来源内必须保持 CSV 原始行顺序。
- 引用 source 必须经统一 query/service 返回选项元数据与 ResourceRef。缩略图必须由下拉展开与已选值变化触发通用媒体服务按需合批解析。
- 已选值必须在客户端按逐字符身份与目录比较。目录外的非空值必须以原始文本同时作为标签和值，首尾空白必须完整保留；空字符串必须表示未选择。
- 舰船 ID 的显示名称必须优先使用 `ship_data.csv` 的 `name`；只有该名称缺失或为空时才允许使用对应 `.ship` 的 `hullName`，两者均为空时只允许显示 hull ID。
- 联队 ID 的 CSV 行没有名称列时，source query 以其 `variant` 的 `displayName` 作为显示名称，并继续沿用该 variant 的舰体资源引用；菜单项和已选标签均消费同一个 `SelectOption`。
- Bundled schema 在注册时必须校验每个 `csv:` source 的表名属于正式 CSV 表注册表；无效 source 必须阻止注册，严禁静默渲染为空下拉。

## 不变量

- plain editMode 只允许显示文本或 JSON 文本；smart editMode 才允许使用增强控件。包含换行的字符串必须使用 textarea。
- Smart 下拉的选项菜单与已选标签必须共用同一 `SelectOption`。可解析资源的缩略图必须在展开或选中时按需解析并缓存；不可解析的手输值必须显示逐字符原始文本。
- 字段挂载严禁触发选项贴图批量读取。批量解析只允许由下拉展开、已选值变化或资源失效驱动，并且必须经 single-flight 去重。
- 前端严禁通过字段名猜语义、构造 ResourceRef、扫描文件或在 schema 组件内写盘；未知字段与额外字段必须按正式 JSON 边界保留。
