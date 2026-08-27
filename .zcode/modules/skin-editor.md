# 舰船皮肤编辑器

## 定义

编辑按 ID 索引的 `.skin` 单文件实体与其 hull/资源引用。

## Owner 与链路

- 列表 ViewModel 管理选择、创建/删除与资源；Editor ViewModel 管理目标 Draft Session；Rust backend 管理 ID、路径、扩展名、重命名/删除与 changeset。
- 保存经配置 save orchestrator、File History 和 session refresh 完成。
- 皮肤列表必须从 skin entity list 保留 sprite ResourceRef，并按可视区渐进解析自身 hull 缩略图。
- 新建动作才允许加载舰体引用目录，目录项严禁预取缩略图。

## 不变量

- 单文件保存只允许目标 `.skin`；前端严禁推导磁盘路径或 ID，dirty 外部版本只允许暂存。
