# 配置系统（模块）

## 定义

管理 mod_info、Faction、Mission、Variant、Skin 的列表、目标草稿、实体 query/write 与文件级 history。

## Owner 与链路

- 组件只允许负责表单、确认和可视区媒体注册；各 ViewModel 拥有列表、选择、ResourceRef、目标 Draft Session 与外部更新暂存。
- domain 拥有默认值、ID/重命名/内部字段与 schema source；service 校验 query/write 模型；save orchestrator 编排 write -> refreshed entity -> File History -> ProjectSession refresh。
- Rust command 必须校验 `sessionId + modRoot`；backend 拥有 index、目标文件、目录、ID、changeset、重命名和删除验证；前端严禁扫描磁盘补实体。
- Faction、Mission、Skin、Variant 列表必须保留 entity query 返回的 ResourceRef。列表图片必须以列表滚动容器为 observer root，并在上下各一个容器高度的预读区内按需解析。

## 不变量

- 保存只允许写该实体声明目标，成功后必须完成 changeset、history 和 refresh；dirty 时外部更新必须暂存，严禁覆盖草稿。
- `mod_info` 必须使用目标 Draft Session；Skin 与 Variant 的单文件目标、扩展名和 ID 必须以后端 domain 为准。
- 保存必须提交发起保存时的独立快照；请求期间产生的新编辑必须保持 dirty，已写盘版本只允许作为外部版本暂存。
- Faction、Mission、Skin、Variant 的对象选择在当前草稿 dirty 时必须先确认放弃。
- 屏幕外列表图片严禁产生 data URL 查询。资源失效后当前可见图片必须重新解析，屏幕外图片必须在再次接近可视区时解析。
