# alex_csv 读取与写入 parser

## 定义

`alex_csv` parser 负责读取 Starsector CSV 文件、保留可见空行，并把前端 rows 渲染回 CSV 文本。

## 边界

- `src-tauri/src/parsers/alex_csv.rs` 实现 `read_csv_data()`、`render_csv_text()` 和 cell 转换。
- `src-tauri/src/services/project/mod.rs` 通过 ProjectSession 按需读取 CSV window，并在保存当前表 patch 时渲染 CSV 文本。
- `src-tauri/src/models/project.rs` 中 `CSV_TABLES` 定义表路径。

## 规范

- CSV 文件必须按 UTF-8 无 BOM 读取。
- 缺失 CSV 文件返回空 header、空 rows 和目标 path。
- parser 必须保留真正空行、全逗号空行和 `#` 开头行。
- `#` 开头行是合法 CSV 行；如果只有单个 cell，读取时补齐到 header 宽度。
- `#` 开头行产生的业务 ID 不得作为其它字段、schema source、关联文件或编辑器入口的合法引用。
- 保存时只写 header 中存在的列。
- `_rowKey` 和其它内部字段不能写入 CSV。
- CSV 解析错误必须包含文件路径和 `alex_csv` 错误上下文。

## 链路：读取 CSV

1. ProjectSession 根据表 key 取得 CSV 路径。
2. `read_csv_data()` 读取 UTF-8 无 BOM 文本。
3. `alex_csv` 字节状态机生成 records。
4. 第一行作为 header。
5. 其余 records 转换为 JSON row map，并生成稳定 rowKey。
6. Rust 按搜索、筛选和窗口范围返回 CSV window。

## 链路：写入 CSV

1. Rust 收到 `sessionId + table + rowKey patch`。
2. ProjectSession 用 baseline 和 patch 合成当前表 rows。
3. `render_csv_text()` 按 header 顺序渲染 CSV 文本。
4. Rust 把 CSV 文本放入当前表 changeset。
5. 保存成功后只刷新当前表 baseline 和相关 session cache。
