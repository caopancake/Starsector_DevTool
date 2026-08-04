# 项目会话与清单缓存

## 定义

后端按已打开 Mod 管理索引、按需 query、写后失效与 manifest；前端仅缓存结果。

## Owner 与链路

- `open -> 经源指纹验证的派生索引快照或正式解析 -> session/manifest -> query cache`；write service 事务写入、更新 baseline、返回 changes/invalidation；refresh orchestrator 以原始 changeset 刷新 session、更新主窗口 manifest、清相关 cache、广播。
- 后端 `entry/root/session/query/write/cache/model` 分层；前端 project store 仅保存活动 session/manifest。

## 不变量

- Session 由 `sessionId + modRoot` 身份约束；所有 Mod 缓存隔离。query 不写盘，write 不重开整个项目。
- ID 归属的实体视图、表计数与写后失效快照只枚举非注释且实体 ID 非空的 CSV 行；缺 ID 行仍是原始表格、草稿与保存链路的一部分，但不属于实体树或实体详情查询，不能阻断其它已注册实体或扩大失效范围。
- cache 失效必须按结构化 invalidation 精确处理；前端不能以完整项目快照、磁盘扫描或旧 session 取代 query。
- session refresh 只能接收已写盘或已回放的 `FileChangeRecord`；单文件的 before/after 文本与目录快照共同推导实体 ID、CSV 行 ID 和资源路径。无法解析时才发出该实体种类的正式 `id: null` scope；重命名必须同时携带旧、新 ID。
- 持久化索引仅存于工具私有数据目录，按 canonical `modRoot` 分片；它只保存可由 Mod 源文件重新推导的规格、阵营、任务和表计数，不保存 session、编辑态或保存权威数据。
- 打开时必须对所有索引输入计算内容指纹；路径集合、内容或格式版本任一不一致即丢弃快照并走正式解析。缓存损坏或不可写只降级为重建，不得读取旧快照。
