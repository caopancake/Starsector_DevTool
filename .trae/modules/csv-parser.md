# alex_csv 读取与写入 parser

## 定义

`alex_csv` parser 负责读取 Starsector CSV 文件、保留可见空行，并把前端 rows 渲染回 CSV 文本。

## 边界

- `src-tauri/src/parsers/alex_csv.rs` 实现 `read_csv_data()`、`render_csv_text()` 和 cell 转换。
- `src-tauri/src/services/project/tables.rs` 在完整项目加载时读取所有表。
- `src-tauri/src/services/tables.rs` 在保存时渲染 CSV 文本。
- `src-tauri/src/models/project.rs` 中 `CSV_TABLES` 定义表路径。

## 规范

- CSV 文件必须按 UTF-8 无 BOM 读取。
- 缺失 CSV 文件返回空 header、空 rows 和目标 path。
- parser 必须保留真正空行、全逗号空行和 `#` 开头行。
- `#` 开头行是合法 CSV 行；如果只有单个 cell，读取时补齐到 header 宽度。
- `#` 开头行产生的业务 ID 不得作为其它字段、schema source、关联文件或编辑器入口的合法引用。
- 保存时只写 header 中存在的列。
- `_rowKey` 和其它内部字段不能写入 CSV。
- CSV 解析错误必须包含文件路径和 csv crate 原始错误。

## 链路：读取 CSV

1. Rust project tables service 取得 CSV 路径。
2. `read_csv_data()` 读取 UTF-8 无 BOM 文本。
3. parser 规范化可见空行。
4. csv crate 读取 records。
5. 第一行作为 header。
6. 其余 records 转换为 JSON row map。
7. Rust 返回 `CsvTable`。

## 链路：写入 CSV

1. Rust tables service 收到 header 和 rows。
2. `render_csv_text()` 创建 csv writer。
3. writer 写入 header。
4. writer 按 header 顺序写入每行 cell。
5. Rust 得到 CSV 文本。
6. Rust 把 CSV 文本放入 FileChangeRecord。
