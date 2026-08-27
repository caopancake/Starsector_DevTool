# 装配编辑器

## 定义

编辑按 ID 索引的 `.variant` 单文件实体及 hull/资源引用。

## Owner 与链路

- 列表/Editor ViewModel 分别拥有选择与目标 Draft Session；Rust backend 拥有文件目标、ID、重命名、删除和 changeset；配置 save 编排 history/refresh。
- 装配列表必须从 variant entity list 保留 sprite ResourceRef，并按可视区渐进解析缩略图。舰船名称必须通过 hull 引用元数据查询获得；第一行显示 `ships.name · variant.displayName`，第二行显示 `variantId`。
- 新建动作才允许加载完整舰体引用目录，目录项严禁预取缩略图。

## 不变量

- 保存只允许写当前 `.variant`，路径和文件内容 ID 必须由后端验证；前端严禁扫描或推导路径，dirty 外部更新只允许暂存。
- 舰船名称必须由后端按当前 Mod `ship_data.csv` 优先、原版补集解析；无法解析名称时必须显示 `hullId`，严禁改变装配引用或持久化数据。
