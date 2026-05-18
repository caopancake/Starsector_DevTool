# alex_json 宽松 JSON parser

## 定义

`alex_json` parser 把 Starsector 和 Mod 中常见的 JSON-like 格式清洗成严格 JSON，再交给 `serde_json` 解析。

## 边界

- `src-tauri/src/parsers/alex_json.rs` 实现清洗、解析和负例测试。
- `src-tauri/src/io/json_files.rs` 调用宽松 parser 读取 JSON-like 文件。
- `src-tauri/src/services/project/mod.rs`、`projectiles.rs`、`config` 和 `editor_specs.rs` 依赖 JSON 文件读取。

## 规范

- parser 支持 `#` 注释、尾逗号、未加引号对象 key、全大写未加引号 enum、无前导零小数、Java float suffix、分号条目结束和单引号字符串。
- parser 的清洗必须只作用于字符串外区域。
- parser 必须保留负例测试，避免接受明显错误格式。
- 保存 JSON-like 文件时写出 pretty JSON，不保留原注释和尾逗号。
- 解析错误必须带出文件路径上下文。

## 链路：读取 JSON-like 文件

1. Rust filesystem 读取 UTF-8 无 BOM 文本。
2. `parse_starsector_json()` 移除字符串外 `#` 注释。
3. parser 规范化字符串外分号条目结束。
4. parser 规范化单引号字符串。
5. parser 移除尾逗号。
6. parser 给未加引号 key 加双引号。
7. parser 给全大写 enum 值加双引号。
8. parser 规范化无前导零小数。
9. parser 移除 Java float suffix。
10. parser 截取第一个 JSON object 结束位置。
11. parser 调用 `serde_json::from_str()`。
12. filesystem 层把错误附加文件路径后返回。
