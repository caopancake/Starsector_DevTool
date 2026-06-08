# 性能计时与基线样本

## 定义

性能计时与基线样本模块负责把已接入的前后端耗时观测统一写入应用日志，并限定人工基线样本的使用边界。

## 参考

- `src-tauri/src/services/project/entry.rs`：拥有 ProjectSession 打开完成后的后端性能 trace 写入入口。
- `src-tauri/src/services/project/performance.rs`：拥有 Rust `PerformanceTrace`、阶段 timer、字段清洗和 `PERF` 日志消息渲染。
- `src-tauri/src/services/project/session.rs`：在 ProjectSession 构建过程中记录 mod_info、factions、mission_count、csv_index 和 spec bundle 阶段。
- `src/app/components/NavSidebar.vue`：记录主窗口表格切换动作耗时。
- `src/app/components/tables/CsvGrid.vue`：记录 CSV grid 激活单元格、选择行和更新单元格动作耗时。
- `src/app/composables/use-csv-table-view-model.ts`：消费 CSV grid model 的 performance sample，并写入 grid 建模耗时日志。
- `src/app/composables/use-performance-logger.ts`：向组件暴露同步 action 计时包装入口。
- `src/domain/tables/csv-grid-model.ts`：生成 grid 建模耗时样本，包含总耗时、source index 耗时、列宽耗时、行列数量和表名。
- `src/services/csv-table.service.ts`：记录 source options 查询、资源 data URL hydration 和结果组装总耗时。
- `src/services/performance.service.ts`：拥有前端 `measurePerformance`、`measurePerformanceAsync`、`recordPerformance`、字段过滤和字段值清洗。
- `src/services/query-cache.service.ts`：记录 query cache hit、pending hit 和 miss 的耗时。
- `src/services/session.service.ts`：记录前端打开 ProjectSession 的 invoke 耗时和总耗时。

## 边界

- `CsvGridPerformanceSample` 只描述 grid model 构建耗时和规模，不拥有 grid 渲染、虚拟滚动或编辑状态。
- `PerformanceFields` 只能携带 number、string、boolean、null 或 undefined，不能携带对象、数组、row data、manifest 或资源 data URL。
- `PerformanceTrace` 只归 Rust ProjectSession 打开链路使用，不能作为通用业务日志结构扩散到 command 或前端。
- `PERF` 日志归 app log 消费，不新增独立性能日志文件、持久化表或设置项。
- `alex_csv` parser 暴露 metric callback，但普通 CSV 文件读取当前不把 parser metric 写入 app log。
- `measurePerformance` 和 `measurePerformanceAsync` 只包裹调用方 action 并在 finally 记录耗时，不改变 action 返回值或错误传播。
- `query cache` 计时归前端 cache service 拥有，只描述缓存命中状态和耗时，不描述 query 结果内容。
- `recordPerformance` 是前端性能日志唯一写入入口，调用方只提供名称、耗时和允许字段。
- `人工基线样本` 只作为人工验收输入，不进入代码、测试、默认配置、workspace persistence 或 app settings。
- `后端 trace 写入` 只在 ProjectSession 打开成功后执行，打开失败不能为了性能日志吞掉原始错误。
- `字段清洗` 归性能日志工具拥有，调用方不得自己拼接带换行、制表或多行内容的 log message。
- `性能计时` 只记录观测数据，不能触发缓存失效、文件写入、history 移动、UI toast、路由跳转或编辑模式切换。
- `组件计时 composable` 只用于同步组件动作，不拥有异步 query、后端 command 或 app log service。

## 链路

### Rust ProjectSession Trace

1. Rust project entry 创建 `PerformanceTrace::new("project.openSession")`。
2. Rust project entry 调用 traced ProjectSession 打开函数。
3. session 构建读取 `mod_info.json`。
4. session 构建记录 `mod_info` 阶段，字段包含 mod_info 路径。
5. session 构建发现 faction tags 并读取 faction files。
6. session 构建记录 `factions` 阶段，字段包含 faction 文件数和 tag 数。
7. session 构建统计 mission list 条目数。
8. session 构建记录 `mission_count` 阶段，字段包含 mission 数。
9. session 构建注册 session CSV table 索引。
10. session 构建记录 `csv_index` 阶段，字段包含 table 数。
11. session 构建读取 ship、weapon、variant、skin、projectile、system 和 skill spec bundle。
12. session 构建分别记录各 spec 子阶段文件数和 warning 数。
13. session 构建记录 `spec_bundle` 阶段汇总各类 spec 文件数。
14. session 打开成功后，project entry 生成 total 和 stage `PERF` message。
15. project entry 将每条 message 以 info level 追加到 app log。
16. session 打开失败时返回原始错误，不写入 trace log。

### 前端 Action 计时

1. 调用方准备 performance name 和允许字段。
2. 调用方通过 `measurePerformance()` 或组件 performance logger 包裹同步 action。
3. performance service 使用 `performance.now()` 记录开始时间。
4. performance service 执行调用方 action。
5. action 正常返回时，performance service 在 finally 计算耗时。
6. action 抛错时，performance service 仍在 finally 计算耗时。
7. performance service 调用 `recordPerformance(name, elapsed, fields)`。
8. `recordPerformance` 过滤 null 和 undefined 字段。
9. `recordPerformance` 清洗字段值中的 CR、LF 和 tab。
10. `recordPerformance` 以 info level 写入 `PERF name ms=...` app log。
11. 原 action 的返回值或错误继续返回给调用方。

### 前端异步会话与缓存计时

1. session service 调用 `openProjectSession` 前记录开始时间。
2. session service 调用 shared API 打开 ProjectSession。
3. shared API 返回 manifest 后，session service 记录 `frontend.openProjectSession.invoke`。
4. session service 记录 `frontend.openProjectSession` 总耗时。
5. query cache service 收到 cached query 请求。
6. query cache 命中已完成缓存时记录 `frontend.queryCache hit=true`。
7. query cache 命中 pending promise 时记录 `frontend.queryCache hit=true pending=true`。
8. query cache miss 时执行 loader，写入 cache 后记录 `frontend.queryCache hit=false`。
9. source options service 查询 source options 后批量查询资源 data URL。
10. source options service 完成 option hydration 后记录 `frontend.query.sourceOptions`。

### CSV Grid 建模与交互计时

1. CSV table ViewModel 计算 grid model。
2. grid model 创建列定义和行槽。
3. grid model 计时 source index 构建。
4. grid model 计时列宽计算。
5. grid model 返回 performance sample。
6. CSV table ViewModel watch performance sample。
7. CSV table ViewModel 记录 `frontend.csvGridModel`，字段包含 table、rows、columns、sourceMs 和 widthMs。
8. Nav sidebar 切换表格时用 performance logger 包裹导航 action。
9. CSV grid 激活单元格时用 performance logger 包裹 select row 和 active cell 状态更新。
10. CSV grid 选择行时用 performance logger 包裹 select-row emit。
11. CSV grid 更新单元格时用 performance logger 包裹 update-cell emit。

## 规范

- `PERF` message 必须使用 app log 的 info level，path 和 line 必须为 null。
- `PerformanceFields` 中 null 和 undefined 字段不得出现在最终 log message 中。
- `PerformanceTrace` 的 stage 字段和前端 performance 字段都必须清洗 CR、LF 和 tab。
- `measurePerformance` 必须在 action 抛错时仍记录耗时，并继续抛出原错误。
- `measurePerformanceAsync` 必须在 async action reject 时仍记录耗时，并继续 reject 原错误。
- `recordPerformance` 的 ms 必须四舍五入为整数毫秒。
- Rust trace total message 格式必须包含 `PERF {traceName} stage=total ms=...`。
- Rust trace stage message 格式必须包含 `PERF {traceName}.stage name={stageName} ms=...`。
- 前端 performance message 格式必须包含 `PERF {name} ms=...`。
- 性能字段只能记录路径、表名、query kind、hit 状态、数量、布尔状态和阶段耗时这类轻量上下文。
- 性能日志不得记录 CSV 行内容、JSON 实体内容、图片 data URL、完整 manifest、schema options 全量数据或用户编辑内容。
- 人工大 Mod 基线样本目录为 `D:\Starsector\mods\Kratogen_TA`，只作为人工采样输入。
- 性能计时不得为了记录指标改变 ProjectSession 打开、query cache、CSV 编辑、保存、history、设置或错误语义。
- 普通 CSV 文件读取当前不得被文档描述为已写入 parser 阶段性能日志；parser metric callback 只有接入写入入口后才构成 app log 链路。

## 陷阱

- 把性能样本路径写进默认配置或测试，会把本机人工验收条件误变成项目协议。
- 在性能 log 中拼接 row data、manifest JSON、schema options 或 data URL，会污染 app log 并暴露大字段内容。
- 在计时包装里 catch 并吞掉 action 错误，会让性能观察改变业务失败语义。
- 把 parser 内部 metric callback 当成已落盘日志，会高估当前 CSV 读取观测覆盖范围。
- 为了记录失败耗时而在 ProjectSession 打开失败时写入不完整 trace，会干扰错误定位和日志语义。
- 让计时逻辑触发 toast、缓存失效、状态更新或路由跳转，会把观测工具变成业务副作用。
- 不清洗字段中的换行或制表符，会破坏 app log 的单行 `PERF` 解析边界。
