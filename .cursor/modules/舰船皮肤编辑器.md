# 舰船皮肤编辑器

## 定义

编辑按 ID 索引的 `.skin` 单文件实体与其 hull/资源引用。

## Owner 与链路

- 列表 ViewModel 管理选择、创建/删除与资源；Editor ViewModel 管理目标 Draft Session；Rust backend 管理 ID、路径、扩展名、重命名/删除与 changeset。
- 保存经配置 save orchestrator、File History 和 session refresh 完成。
- 皮肤列表只请求自身 hull 的缩略图；新建动作才加载舰体引用目录，目录项不预取缩略图。

## 不变量

- 单文件保存只能目标 `.skin`；前端不推导磁盘路径/ID，dirty 外部版本暂存。
