# 性能基线

## 定义

以正式计时日志和可复现样本记录关键链路性能，不改变业务行为。

## Owner 与链路

- 观测入口、样本格式和日志必须归专用性能模块；业务调用点只允许提供正式阶段数据。
- 基线用于比较同一场景的端到端阶段，不是功能 fallback 或优化授权。
- Mod 打开必须记录 `project.openSession` 的后端阶段和前端 invoke；新建 Mod 必须分别记录 `frontend.createModProject` 与 `frontend.openCreatedModProject`；`persistent_index` 阶段必须记录 `hit` 或 `miss`。
- Source 目录必须记录 `frontend.query.sourceCatalog`，字段必须包含 `source、groups、options、ms`；缓存命中必须由 `frontend.queryCache` 记录。
- 可视区媒体批次必须记录 `frontend.media.visibleBatch`，字段必须包含 `surface、observed、requested、cacheHits、resolved、failed、ms`。
- 配置列表首帧必须记录 `frontend.config.listFirstFrame`，字段必须包含 `surface、entities、observedImages、ms`；计时起点必须是列表加载开始，终点必须是实体行挂载后的下一 animation frame。
- 性能比较必须使用同一 Mod、同一构建与同一操作脚本。`Kratogen_TA 0.5.0` 样本必须包含 `5` 次冷启动首帧、`10` 次同 session 实体切换与 `3` 次完整滚动。
- 每组结果必须报告样本数、最小值、最大值、算术平均值、中位数、nearest-rank P95、前后绝对差和百分比差。

## 不变量

- 严禁引入临时计时 API、调试分支、样例专用优化或影响保存与 query 语义的观测。
- 性能记录必须包含输入规模、环境、阶段与结果；性能结论必须由完整样本统计得出。
- 结构验收必须满足：实体切换新增 source 目录 IPC 数为 `0`，屏幕外图片 data URL IPC 数为 `0`，每个冷缓存 source 后端查询数为 `1`。
