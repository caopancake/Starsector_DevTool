# 资源与原版回退

## 定义

在 Rust 路径边界内解析 `ResourceRef`、批量提供 data URL，并处理 Mod/Core 资源与 PNG 上传。

## Owner 与链路

- 后端 query 把资源标为 `ResourceRef`；前端资源缓存批量 query/hydrate，组件只消费结果。
- 资源查找按 Mod 优先、符合规则时 Core fallback；上传经 Rust 校验、二进制 changeset、ProjectSession refresh、结构化 invalidation、缓存清理和窗口广播。
- 舰体引用空请求只返回创建表单所需目录；带 ID 的请求只解析对应预览引用。目录选项不得批量转 data URL，列表缩略图只 hydrate 已请求的资源。
- Core 的 CSV、舰体、武器、联队、皮肤和投射物索引可按 canonical 游戏根目录持久化为派生快照；仅缓存已请求类型，读取前以 Core 源内容指纹校验，Mod 投射物仍优先覆盖 Core。

## 不变量

- 前端不得构造 ResourceRef、拼路径、逐项读图或把 data URL 写入 manifest；缺失 data URL 保持 `null`。
- Core root 与所有资源路径 canonicalize，拒绝 `..` 和已有父链链接/reparse point。
- 上传只接受显式 `SpriteSubfolder` 与不含路径、控制字符、Windows 保留名或非法尾随字符的 PNG 文件名；支持 Unicode 并保留原名，不 trim、不补扩展名/替换字符/改写目标；覆盖也进入文件 history。
