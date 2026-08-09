# 装配编辑器

## 定义

编辑按 ID 索引的 `.variant` 单文件实体及 hull/资源引用。

## Owner 与链路

- 列表/Editor ViewModel 分别拥有选择与目标 Draft Session；Rust backend 拥有文件目标、ID、重命名、删除和 changeset；配置 save 编排 history/refresh。
- 装配列表按当前 `hullId` 批量请求舰船表名称与缩略图；第一行显示 `ships.name · variant.displayName`，第二行显示 `variantId`。新建动作才加载完整舰体引用目录，目录项不预取缩略图。

## 不变量

- 只写当前 `.variant`，路径和文件内容 ID 均由后端验证；前端不扫描/推导路径，dirty 外部更新仅暂存。
- 舰船名称只由后端按当前 Mod `ship_data.csv` 优先、其余项再查原版同表解析；无法解析名称时明确显示 `hullId`，不改变装配引用或持久化数据。
