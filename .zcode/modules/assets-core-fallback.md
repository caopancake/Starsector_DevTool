# 资源与原版回退

## 定义

在 Rust 路径边界内解析 `ResourceRef`、批量提供 data URL，并处理 Mod/Core 资源与引用路径解析。

## Owner 与链路

- 后端 query 必须把资源标为 `ResourceRef`；前端通用媒体服务必须批量 query，组件只允许消费 ResourceRef 与缓存结果。
- 资源查找按 Mod 优先、符合规则时 Core fallback；编辑器贴图为纯引用——后端把所选绝对路径校验为位于 Mod 根内并返回正斜杠相对路径，Mod 外拒绝，不做任何写入。
- 舰体引用空请求只允许返回创建表单所需目录；带 ID 的请求只允许解析对应名称与引用元数据。目录选项严禁批量转换为 data URL。
- 前端 data URL 缓存必须使用全局 `512` 项 LRU，后端资源指纹缓存必须使用全局 `512` 项容量。LRU 命中必须刷新访问顺序。
- 通用媒体服务必须保持 `25 ms` 合批、single-flight、session 隔离、路径标准化与资源失效。列表缩略图只允许解析 observer 预读区内的资源。
- Core 的 CSV、舰体、武器、联队、皮肤和投射物索引只允许按 canonical 游戏根目录持久化为派生快照；只允许缓存已请求类型，读取前必须以 Core 源内容指纹校验，Mod 投射物必须优先覆盖 Core。

## 不变量

- 前端严禁构造 ResourceRef、拼路径、逐项读图或把 data URL 写入 manifest；缺失 data URL 必须保持 `null`。
- Core root 与所有资源路径 canonicalize，拒绝 `..` 和已有父链链接/reparse point。
- 引用解析只允许接受 Mod 根内的安全相对路径；必须拒绝绝对路径、`..` 与链接逃逸。文件选择必须先经后端路径校验。
