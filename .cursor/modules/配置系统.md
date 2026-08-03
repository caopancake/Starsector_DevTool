# 配置系统（模块）

## 定义

管理 mod_info、Faction、Mission、Variant、Skin 的列表、目标草稿、实体 query/write 与文件级 history。

## Owner 与链路

- 组件仅表单/确认；各 ViewModel 拥有列表、选择、资源 hydration、目标 Draft Session 与外部更新暂存。
- domain 拥有默认值、ID/重命名/内部字段与 schema source；service 校验 query/write 模型；save orchestrator 编排 write -> refreshed entity -> File History -> ProjectSession refresh。
- Rust command 校验 `sessionId + modRoot`；backend 拥有 index/目标文件/目录、ID、changeset、重命名和删除验证；前端不扫描磁盘补实体。

## 不变量

- 保存只写该实体声明目标，成功以 changeset/history/refresh 完成；dirty 时外部更新暂存，不覆盖草稿。
- `mod_info` 走目标 Draft Session；Skin/Variant 单文件目标、扩展名和 ID 以后端 domain 为准。
- 保存提交的是发起保存时的独立快照；若用户在请求期间继续编辑，已写盘版本只作为外部版本暂存，当前新草稿仍保持 dirty。
- Faction、Mission、Skin、Variant 的对象选择在当前草稿 dirty 时必须先确认放弃；不得因替换 keyed editor 直接销毁草稿。
