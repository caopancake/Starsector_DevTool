# 文本与格式解析器

## 定义

文本与格式解析器系统把已读取的 Starsector CSV-like 与 JSON-like 字节解析为结构化数据，并按各自格式渲染回文本。

## 参考

`src-tauri/src/parsers/alex_csv.rs`：CSV-like 解析与渲染 owner，负责表头/行解析、quoted CRLF 与短 hash 行处理。
`src-tauri/src/parsers/alex_json.rs`：JSON-like 宽松清洗与解析 owner，处理 Starsector 允许的非标准语法。
`src-tauri/src/parsers/tool_json.rs`：JSON-like pretty 渲染 owner，负责写盘前的序列化规则。
`src-tauri/src/models/`：解析器输入输出模型与 CP1252 归一化映射 owner。
`src-tauri/src/io/text.rs`：文本读取 owner，拥有 UTF-8 BOM 拒绝与已知 CP1252 字节归一化入口。
`src-tauri/src/io/csv_files.rs`：CSV 文件读写与路径上下文 owner。
`src-tauri/src/io/json_files.rs`：JSON 文件读取与目录遍历 owner。
`.zcode/backend-guidelines.md`：parser 层通用约束。

## 边界

- 解析器只接收字节或文本与路径上下文，严禁拥有文件 IO、路径校验、资源解析或业务表识别。
- 解析器严禁写盘、构造业务 identity、生成 rowKey 或 ResourceRef 等运行时字段。
- 缺失文件、路径验证与授权归 IO；业务对象、changeset 与保存语义归 service。
- 格式错误必须携带 path、记录序号或位置上下文，严禁静默吞掉结构错误。
- 宽松兼容只限正式 Starsector 格式规则，严禁用字符串替换绕过解析器保存。
- 已知 CP1252 智能引号归一化映射的唯一 owner 在 models，CSV 字节解析与文本读取复用同一份。

## 链路

### CSV-like 解析

1. IO 读取字节并拒绝 UTF-8 BOM，附带路径上下文交给解析器。
2. 解析器切分物理行并解析表头。
3. 逐行处理 quoted CRLF、可见空行、全逗号行与 `#` 注释行。
4. 短 hash 行补齐列数；非 hash 行宽度错误拒绝并报告路径、记录序号与物理起始行。
5. EOF 未闭合引号拒绝并报告路径与物理起始行。
6. 输出表头与行结构交给缓存与窗口消费。

### CSV-like 渲染

1. 保存链路提交已净化行与表头。
2. 解析器仅按表头列渲染，绝不写入 `_rowKey/_faction` 运行时字段。
3. 输出文本交给写入链路构成 changeset。

### JSON-like 解析

1. IO 提供 UTF-8 文本与路径上下文。
2. 清洗阶段处理 Starsector 允许的宽松语法。
3. 解析产出结构化数据；结构错误保留 path 与位置上下文并抛出。
4. pretty 渲染按写盘序列化规则输出文本。

## 规范

- CSV 解析必须保留可见空行、全逗号行、`#` 行和 quoted CRLF。
- CSV 渲染必须保持原表头顺序与原文件的行序语义。
- JSON-like 清洗只接受正式 Starsector 宽松规则，严禁扩展为通用 JSON 修复器。
- CP1252 归一化在读取时执行并随保存写回磁盘，且该归一化不可逆。
- 所有格式错误必须结构化携带路径与位置，严禁只返回字符串消息。
- 解析器必须可独立测试，严禁依赖 Tauri state 或全局配置。

## 陷阱

- 让解析器识别业务表名会把格式层与业务层耦合。
- 渲染时写入运行时字段会让缓存行身份污染写盘文件。
- 丢弃短 hash 行或可见空行会改变游戏对表格的原始语义。
- 用正则或字符串替换修 JSON 会绕过清洗规则并引入不可解释的错误。
- 把 BOM 检测放进解析器而不是统一文本读取会让两种格式行为分叉。
