# alex_csv 读取与写入 parser

## 定义

`alex_csv` parser 负责把 Starsector CSV-like 字节内容解析为表头和行对象，并把表头与行对象渲染为 CSV 文本。

## 参考

- `src-tauri/src/io/csv_files.rs`：读取 CSV 文件字节、处理缺失文件语义，并把文件路径作为 parser path label。
- `src-tauri/src/models/project.rs`：定义 `CsvTable`、`CsvTableKey`、窗口返回模型和 source option wire 模型。
- `src-tauri/src/models/write.rs`：定义 CSV row patch、row key mapping、关联 spec 动作、普通文件变更和写入结果 wire 模型。
- `src-tauri/src/parsers/alex_csv.rs`：实现 CSV-like 字节解析、记录宽度规范化、cell 转换和 CSV 文本渲染。
- `scripts/architecture/rules/parser-boundary.mjs`：约束 CSV 读取和写回必须经过正式 parser / IO 边界。
- `src-tauri/src/services/project/cache/csv.rs`：按 ProjectSession 懒加载 CSV rows，生成 rowKey，并在必要时注入 faction 派生字段。
- `src-tauri/src/services/project/factions.rs`：通过 CSV parser 读取 faction index，并消费 comment / padding row 语义。
- `src-tauri/src/services/project/query/csv_window.rs`：消费已加载 CSV rows，按搜索、势力筛选和窗口范围返回表格窗口。
- `src-tauri/src/services/project/query/source_options.rs`：消费已加载 CSV rows，生成 source option、tag metadata 和 core option。
- `src-tauri/src/services/project/session.rs`：建立 CSV table manifest、实体计数和 ProjectSession 的 CSV 路径索引。
- `src-tauri/src/services/project/write/csv_patch.rs`：合成 CSV row patches，调用 CSV 渲染，并把文本写入文件级 changeset。

## 边界

- CSV parser 不拥有磁盘路径校验、文件存在判断、UTF-8 BOM 检查、ProjectSession 状态或 changeset 写盘。
- CSV parser 不生成 rowKey，不解释 rowKey，不判断新增行身份，不返回 key map。
- CSV parser 不识别业务表类型，不读取项目 CSV table definition，不区分 ships、weapons、missions 或 faction index。
- CSV parser 不拥有 comment row 的业务含义；它只保留以 `#` 开头的行数据。
- CSV parser 不注入 `_faction`、`_rowKey` 或其它运行时字段。
- CSV parser 不过滤空行、全逗号空行、comment 行或 padding 行。
- CSV parser 不参与 source option、resource ref、entity count、faction tag、关联 spec 或编辑器入口判断。
- CSV parser 的读取输入是已经通过 IO 层取得的字节切片和 path label。
- CSV parser 的读取输出只能是 `CsvTable { header, rows, path }`。
- CSV parser 的写入输入只能是保存链路提供的 header 和已经去除内部字段的 row map。
- CSV parser 的写入输出只能是 CSV 文本，不创建目录、不写文件、不返回 changeset。
- CSV parser 的公开入口只能是解析字节与渲染文本，不暴露半接入性能计时或调用层观测 API。
- IO 层拥有缺失 CSV 文件返回空表的语义，ProjectSession cache 拥有缺失业务表时从 core 表头补齐 header 的语义。
- ProjectSession cache 拥有 rowKey、懒加载 rows、运行时 faction 字段和 loaded / unloaded 状态。
- 保存 service 拥有 patch 合成、关联 spec 动作处理、changeset 构建、session baseline 更新和 invalidation.paths。
- 前端 store 只能消费 Rust 返回的 rowKey 和 row 数据，保存时必须删除 `_rowKey` 后提交 row patch。

## 链路

### 读取 Mod CSV 表窗口

1. 前端通过 shared query API 调用 `query_csv_table_window`。
2. Rust command 读取 `CsvTableWindowPayload` 并进入 ProjectSession query service。
3. query service 取得对应 session 并调用 `ensure_registered_table_rows`。
4. ProjectSession cache 通过 table key 取得注册表路径。
5. cache 以 Mod root 拼接表相对路径。
6. 文件存在时 IO 层读取 UTF-8 无 BOM 字节并调用 `parse_csv_bytes`。
7. 文件缺失时 IO 层返回空 header、空 rows 和目标 path。
8. parser 扫描 CSV-like 字节并生成 records。
9. parser 在 EOF 发现未闭合 quoted field 时返回 path label 与起始行错误。
10. parser 选择第一条非可见空记录作为 header。
11. parser 按 header 宽度规范化后续 records。
12. parser 把 records 转换为以 header 为 key 的 JSON row map。
13. cache 在 header 为空且存在 Starsector root 时尝试从原版同表读取 header。
14. cache 对支持 faction filter 的表注入 `_faction` 运行时字段。
15. cache 为每行生成 `{table}:row:{index}` rowKey 并写入 session rows。
16. query service 按搜索、势力筛选、start 和 count 返回窗口 rows。

### 读取 faction index

1. ProjectSession 打开或 faction 路径失效时调用 faction service。
2. faction service 定位 `data/world/factions/factions.csv`。
3. IO 层读取 CSV 文件；文件缺失时返回空表。
4. parser 返回 header 与 rows。
5. faction service 在 header 中选择 id 列和 file 列。
6. faction service 跳过 comment row 和全空 padding row。
7. faction service 从每个有效 row 解析 faction id 与 faction file 路径。
8. faction service 读取对应 faction JSON-like 文件。
9. faction service 生成 faction files、faction meta 和 blueprint tag map。

### 读取 source option

1. 前端 schema runtime 或 CSV cell picker 通过 shared query API 调用 `query_csv_source_options`。
2. Rust command 读取 `CsvSourceOptionsPayload` 并进入 ProjectSession query service。
3. query service 解析 `csv:{table}.{column}` source。
4. query service 确保当前 Mod 表 rows 已加载。
5. query service 校验 source column 存在于 header。
6. query service 从 current values、当前 Mod rows 和原版 rows 生成 option groups。
7. query service 跳过 comment rows。
8. query service 对非 `id` 列按逗号拆分 token。
9. query service 只为 `id` 列 option 生成 `ResourceRef`。
10. query service 对 tags 和 hints 构建对应 metadata。
11. 前端服务按 option 的 `ResourceRef` 另行批量查询缩略图 data URL。

### 保存 CSV patch

1. 前端 table save orchestrator 捕获当前 manifest、modRoot、table、dirty rows 和关联 spec 动作候选。
2. 前端按 dirty row 构造 `CsvRowPatch[]`。
3. 前端从保存 row 中删除 `_rowKey`。
4. 前端通过 shared tables API 调用 `save_csv_patch`，payload 携带 `sessionId + modRoot + table + patches + associatedSpecs`。
5. Rust command 校验 `sessionId + modRoot` 属于同一个 ProjectSession。
6. Rust 保存 service 确保目标表 rows 已加载。
7. Rust 保存 service 复制当前 header 和 baseline rows。
8. Rust 保存 service 对 delete patch 删除匹配 rowKey 的 row。
9. Rust 保存 service 对已存在 rowKey 的 upsert patch 替换 row。
10. Rust 保存 service 对 `{table}:new:{id}` 新增 row 生成正式 `{table}:row:{index}` rowKey mapping。
11. Rust 保存 service 拒绝未知且非新增格式的 rowKey。
12. Rust 保存 service 以 header 顺序收集每行 cell 并调用 `render_csv_text`。
13. parser 把 null 转为空 cell，把 string / number / bool 转成 cell 字符串，把其它 JSON 值序列化为 cell。
14. parser 使用 CSV writer 输出 header 与 rows。
15. Rust 保存 service 按统一实体定义把 CSV 文本和关联 spec 动作加入同一个 changeset。
16. changeset 写盘成功后，保存 service 更新 session 内当前表 baseline rows 与 header。
17. 保存 service 返回 changes、invalidation 和 row key map。
18. 前端按 key map 替换本地新行 rowKey，并进入文件历史和 session 失效链路。

### 统计 CSV 实体

1. ProjectSession 打开或 CSV 路径失效时调用 table entity summary 统计。
2. session service 根据 `CsvTableKey` 取得目标 CSV 相对路径和实体 id 字段。
3. IO 层读取 CSV 文件；文件缺失时返回空表。
4. parser 返回 header 与 rows。
5. session service 跳过 comment row。
6. session service 只统计实体 id 字段存在且非空的 row。
7. session service 把计数写入 manifest table entity summaries。

## 规范

- CSV 解析错误必须包含 path label 和 `alex_csv` 记录宽度或 UTF-8 错误上下文。
- CSV 文件存在时必须通过 UTF-8 无 BOM 字节读取入口进入 parser。
- CSV 文件缺失必须由 IO 层返回空 header、空 rows 和目标 path。
- CSV header 必须取第一条非可见空 record。
- CSV parser 必须保留 header 之后的可见空行。
- CSV parser 必须保留 `#` 开头行。
- CSV parser 必须保留 quoted field 内部的 CRLF 与空白行。
- CSV parser 必须识别 Windows smart quotes 和 dash 字节并转换为普通字符。
- CSV parser 必须在 EOF 未闭合 quoted field 时返回错误，不能把剩余文本当作合法 cell。
- CSV parser 输出 row map 时只能写入 header 中存在的列。
- CSV parser 渲染时必须只按 header 顺序读取列。
- CSV render 不能写入 `_rowKey`、`_faction` 或其它运行时字段。
- CSV render 遇到不可序列化 cell 值必须返回错误。
- full-width `#` 数据行必须按普通数据行保留全部列值。
- non-hash 短行或超宽行必须返回错误。
- rowKey 必须由 ProjectSession cache 生成，不得由 parser 或前端生成正式已保存行 key。
- 保存新增行只接受 `{table}:new:{id}` 格式作为前端临时 rowKey。
- 保存写回必须经过 changeset，不得由 parser 或 command 直接写盘。
- short `#` 行必须补齐到 header 宽度。
- source option、entity count、faction index 和关联 spec 链路必须跳过 comment row。
- 全逗号空行必须作为可见空 row 保留。
- 只有 ProjectSession cache 可以向 CSV rows 注入 `_faction` 运行时字段。
- 真正空行必须作为可见空 row 保留。

## 陷阱

- 把 `#` 开头行当作 parser 层注释丢弃，会破坏 Starsector CSV-like 文件的可见分隔行和禁用行保留。
- 把 `_rowKey` 或 `_faction` 交给 parser 写回，会污染 Mod CSV 文件。
- 把缺失文件语义放进 parser，会混淆字节格式解析和磁盘读取边界。
- 把 parser 内部计时入口暴露成 public API，会让未接入观测系统的临时入口变成长期接口。
- 把非 ID 列拆出的 token 当作 row 实体，会让 source option 错误继承行资源。
- 把 rowKey 当作 CSV 文件内容，会破坏保存、撤销、重做和 session 失效后的行身份边界。
- 把短非 hash 行补齐，会隐藏 CSV 结构错误。
- 把真正空行过滤掉，会改变用户文件的可见结构。
- 绕过 parser 直接用通用 CSV reader 读取 Starsector CSV-like 文件，会丢失 smart quote、可见空行和 multiline quote 规则。
