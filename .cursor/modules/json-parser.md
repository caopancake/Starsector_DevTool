# alex_json 宽松 JSON parser

## 定义

`alex_json` parser 负责把 Starsector JSON-like 文本规范化为 strict JSON 并解析为 `serde_json::Value`。

## 参考

- `src-tauri/src/domain/config.rs`：消费已解析 JSON 值，校验配置实体 ID、相对路径和 `.variant` / `.skin` 结构。
- `src-tauri/src/io/json_files.rs`：读取 UTF-8 无 BOM 文本、调用宽松 parser、附加文件路径错误上下文，并递归剥离内部字段。
- `src-tauri/src/parsers/alex_json.rs`：实现宽松 JSON 清洗、字符串边界保护、strict JSON 解析和负例测试。
- `src-tauri/src/services/config/indexed_entities.rs`：保存 faction 与 mission 结构化配置时写出 strict pretty JSON。
- `src-tauri/src/services/config/skins.rs`：读取旧 `.skin` 目标、校验实体匹配，并写出 strict pretty JSON。
- `src-tauri/src/services/config/variants.rs`：读取旧 `.variant` 目标、校验实体匹配，并写出 strict pretty JSON。
- `src-tauri/src/services/editor_specs.rs`：导入和定位 editor spec 时读取 JSON-like 文件，保存 editor spec 时写出 strict pretty JSON。
- `src-tauri/src/services/project/projectiles.rs`：从 Mod 与 core projectile 目录读取 JSON-like `.proj` 文件并注入运行时来源字段。
- `src-tauri/src/services/project/root.rs`：读取 `mod_info.json` 生成目录识别、游戏概览和 ProjectSession manifest 数据。
- `src-tauri/src/services/project/spec_files.rs`：读取 `.variant` 与 `.skin` 文件并转换为正式实体索引。
- `src-tauri/src/services/project/write/csv_patch.rs`：重命名关联 spec 时读取旧 JSON-like 文件、改写实体 ID 并写出 strict pretty JSON。

## 边界

- app settings、workspace 和前端 JSON textarea 使用 strict JSON 语义，不属于 `alex_json` 宽松 parser。
- parser 不读取文件、不校验路径、不遍历目录、不写文件、不构建 changeset。
- parser 不拥有 config entity、editor spec、ProjectSession、core cache、resource 或 file history 状态。
- parser 不保留注释、尾逗号、单引号或原始格式；保存链路只写 strict pretty JSON。
- parser 不剥离 `_source`、`_rowKey` 或其它内部字段；内部字段剥离归 IO helper 或保存 service 调用。
- parser 不验证业务必填字段、实体 ID、文件扩展名、目录归属或 source option 语义。
- parser 输入只允许是已经由 IO 层读取出的文本。
- parser 输出只允许是 `serde_json::Value` 或解析错误。
- 目录扫描、缺失目录返回空集合、重复 ID 处理和 warning 归 ProjectSession service。
- 文件路径错误上下文归 IO 层；parser 错误只表达清洗后 strict JSON 解析失败或格式转换失败。
- 普通文本文件编辑保存保持用户文本原样，不通过 parser 规范化 JSON-like 内容。
- 结构化保存链路必须使用当前内存 JSON 值写出 strict pretty JSON，不尝试恢复原始 JSON-like 语法。
- 宽松语法清洗只能作用于字符串外区域；双引号字符串内内容必须原样保留。
- 单引号字符串规范化只能在双引号字符串外进行，并必须通过 JSON string 序列化生成合法字符串。
- `read_json_file` 是后端读取 JSON-like Mod 文件的正式入口。

## 链路

### 读取目录和 manifest JSON

1. 用户打开目录后，Rust root service 判断目标是游戏目录、Mod 目录或未知目录。
2. 游戏目录概览扫描 `mods` 下的 `mod_info.json`。
3. Mod 目录打开 ProjectSession 时读取目标 Mod 的 `mod_info.json`。
4. IO 层用 UTF-8 无 BOM 读取文本。
5. IO 层调用 `parse_starsector_json`。
6. parser 清洗 JSON-like 文本并调用 `serde_json::from_str`。
7. IO 层给解析错误附加文件路径上下文。
8. root 或 session service 消费解析结果生成 overview summary 或 ProjectManifest。

### 读取 spec 索引

1. ProjectSession 打开或路径失效时进入 spec 加载链路。
2. service 按实体目录扫描 `.ship`、`.wpn`、`.proj`、`.system`、`.skill`、`.variant` 或 `.skin` 文件。
3. IO 层逐个文件读取 UTF-8 无 BOM 文本。
4. IO 层调用 `parse_starsector_json`。
5. parser 返回 JSON value。
6. service 按实体 kind 读取正式 ID 字段。
7. service 对 `.variant` 和 `.skin` 进一步构造带 relPath、计数和原始 data 的实体索引。
8. service 对重复 `.variant` / `.skin` ID 保留第一项并记录 warning。
9. service 把索引写入 ProjectSession 或 core cache。

### 读取导入 spec

1. 前端通过 files API 调用 `load_imported_editor_spec_file`。
2. Rust command 读取 payload 并进入 editor spec service。
3. service 校验导入路径是无父级跳转的绝对路径。
4. service 校验文件扩展名匹配目标 editor spec kind。
5. IO 层读取 UTF-8 无 BOM 文本并调用 parser。
6. parser 返回 JSON value。
7. service 把 JSON value 返回给前端编辑器。

### 读取 mission descriptor

1. mission entity query 根据 mission list row 定位 `data/missions/{id}`。
2. descriptor 文件存在时，IO 层读取 `descriptor.json`。
3. IO 层调用 parser 并附加路径错误上下文。
4. query service 同时读取 `mission_text.txt` 原文。
5. query service 返回 list row、descriptor JSON、text 和 relPath。
6. mission list icon 读取链路再次通过 descriptor JSON 取得 icon 字段。

### 保存结构化 JSON

1. 前端通过 config 或 editor save API 提交结构化 JSON value。
2. Rust command 校验 `sessionId + modRoot`。
3. service 校验目标 ID、路径、实体类型和保存边界。
4. service 对保存 value 调用内部字段剥离。
5. service 对 `.variant`、`.skin`、faction、mission descriptor 或 editor spec 执行业务结构校验。
6. service 使用 `serde_json::to_string_pretty` 生成 strict pretty JSON。
7. service 把 JSON 文本加入 changeset。
8. changeset 写盘成功后返回 invalidated paths 和必要的 refreshed entity。
9. 写出的文件不保留原始注释、单引号、尾逗号、未加引号 key 或宽松数字写法。

### 重命名关联 spec

1. CSV 保存链路收到包含 previous rel path 的关联 spec 变更。
2. service 检查旧 spec 文件是否存在。
3. 旧 spec 存在时，IO 层读取旧 JSON-like 文件。
4. parser 返回 JSON value。
5. service 剥离内部字段。
6. service 按表类型改写 `hullId` 或 `id` 字段为新文件 stem。
7. service 使用 `serde_json::to_string_pretty` 生成 strict pretty JSON。
8. service 在同一个 CSV changeset 中删除旧 spec 并写入新 spec。

## 规范

- parser 必须保护双引号字符串内的 `#`、`;`、尾逗号形态、数字样式和未加引号形态。
- parser 必须支持 `#` 行内注释，并且只剥离字符串外注释。
- parser 必须支持 Java float suffix，并只在字符串外移除 suffix。
- parser 必须支持 JavaScript 风格单引号字符串，并转换为合法 JSON string。
- parser 必须支持 Python / Java 风格大小写布尔值，并转换为 lowercase JSON bool。
- parser 必须支持 leading-dot decimal，并补齐 `0`。
- parser 必须支持 leading-plus number，并移除前导 `+`。
- parser 必须支持 leading-zero integer，并规范化为 strict JSON integer。
- parser 必须支持 semicolon entry separator，并只在字符串外转换为逗号。
- parser 必须支持尾逗号，并只在字符串外移除。
- parser 必须支持未加引号 identifier value，且不能改写 `true`、`false` 和 `null`。
- parser 必须支持未加引号 object key。
- parser 必须在第一个完整 JSON object 结束处截断后续文本。
- parser 必须通过 `serde_json::from_str` 作为最终合法性判断。
- parser 必须保留过宽格式负例，不得接受缺逗号字段、未闭合字符串、数字开头 key、双小数点或缺值字段。
- 读取 JSON-like Mod 文件必须通过 `read_json_file`，不能在 service 内直接调用 strict `serde_json::from_str`。
- 读取错误必须包含文件路径上下文。
- 保存结构化 JSON 必须写出 strict pretty JSON。
- 保存前必须剥离内部字段，不能把运行时 `_source` 等字段写入 Mod 文件。
- 普通文本文件保存不得自动调用 parser 或 pretty JSON 规范化。

## 陷阱

- 把 `#` 注释剥离应用到字符串内部，会破坏描述文本、路径或 ID。
- 把宽松 parser 用于 workspace/settings，会让工具私有协议误接受 Mod 文件语法。
- 保存时试图保留原注释和尾逗号，会把读取 parser 职责错误扩展到格式保真编辑器。
- 在 service 内直接 strict 解析 Mod spec，会拒绝 Starsector 原版和 Mod 中常见 JSON-like 写法。
- 在 parser 内剥离内部字段，会混淆格式解析和运行时状态清理边界。
- 在 parser 内校验实体 ID 或路径，会把业务模型错误塞进格式层。
- 重命名关联 spec 时不经过宽松 parser，会无法处理旧文件中的未加引号 key、单引号或 enum 值。
- 用普通文本保存链路处理结构化配置，会绕过实体校验、内部字段剥离和 pretty JSON 写回边界。
