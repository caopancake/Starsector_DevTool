# 文本与格式解析器

## 定义

文本与格式解析器系统把已读取的 Starsector CSV-like 与 JSON-like 字节解析为结构化数据，并按各自格式渲染回文本。

## 参考

`src-tauri/src/parsers/alex_csv.rs`：CSV-like 解析与渲染 owner，字符级行状态机对齐游戏 CSVParser（列数容忍、空行/`#` 行保留），并按最小引号规则渲染。
`src-tauri/src/parsers/alex_json.rs`：JSON-like 字符级 tokener owner，逐项对齐游戏内置魔改 org.json（json.jar 2010 + LoadingUtils，经反编译核验）。
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
2. 解析器先做 CP1252/UTF-8 字符解码，再把 `\r\n` 归一为 `\n`（孤立 `\r` 按普通字符保留）。
3. 表头取首个 `\n` 之前的首行，朴素逗号分割（引号不感知，尾部空段按 Java split 语义丢弃），逐格 trim + 剥首尾引号 + `""` → `"`。
4. 行状态机对齐游戏 CSVParser body 循环：引号逐个翻转、`""` 成对消费产出字面 `"`、引号内逗号/换行原样进单元格、行终止于非引号 `\n`。
5. 列数容忍对齐游戏：短行缺失键不写入行 Map，长行多余单元格丢弃；裸空行保留为空 Map 行，`#` 行按普通行保留（工具裁决，游戏会跳过）。
6. EOF 显式冲刷末行（等价游戏的补 `\n` 保底，不产生合成空行）；引号状态悬至文末报 parse.csv_unterminated_quote 并携带路径与行号。
7. 输出表头与行结构交给缓存与窗口消费；行允许缺失键，消费方按空值处理。

### CSV-like 渲染

1. 保存链路提交已净化行与表头。
2. 解析器仅按表头列渲染，绝不写入 `_rowKey/_faction` 运行时字段；缺失键按空单元格输出。
3. 空 Map 行渲染为裸空行，全空单元格行渲染为 `,` 串，二者保持可区分。
4. 单元格仅在含 `,` `"` `\n` `\r` 时加引号并双写内部引号（最小引号规则），行以 LF 结尾。
5. 输出文本交给写入链路构成 changeset。

### JSON-like 解析

1. IO 提供 UTF-8 文本与路径上下文。
2. 解析器按游戏 LoadingUtils 语义剥离 `#` 注释：`"` 无条件翻转引号状态（注释内也翻转、不感知 `\` 转义，游戏缺陷原样保留），`\n`/`\r` 重置状态，`\r` 被丢弃只保留 `\n`。
3. 字符级 tokener 对齐魔改 org.json：根必须是对象、根 `}` 后剩余文本忽略、尾逗/尾分号容忍、`;` 分隔、无引号键值（word 含内部空格）、`(` 与 `[` 数组、数组空槽产出 null、`=>`/`=` 分隔、字符串内字面换行与未知转义报错、true/false/null equalsIgnoreCase、数值 Long/Double 回退字符串、非有限数值报错、重复键报 json.duplicate_key。
4. 解析产出结构化数据；结构错误保留 path 与行/列位置并抛出。
5. pretty 渲染按写盘序列化规则输出文本。

## 规范

- CSV 解析必须保留可见空行（空 Map 行）、全逗号行、`#` 行和引号内换行；引号内 `\r\n` 按 `\n` 保留。
- CSV 解析对齐游戏 CSVParser：列数容忍（短行缺失键不写入、长行丢弃多余），严禁恢复宽度硬报错。
- CSV 渲染必须保持原表头顺序与原文件的行序语义。
- JSON-like 解析逐项对齐游戏魔改 org.json 与 LoadingUtils 的字面行为（含其缺陷，如 `#` 剥离不感知转义）；行为分歧必须逐项经用户裁决并注明，严禁扩展为通用 JSON 修复器。
- JSON 根必须是对象，重复键必须报 json.duplicate_key，严禁静默 last-wins。
- CP1252 归一化在读取时执行并随保存写回磁盘，且该归一化不可逆。
- 所有格式错误必须结构化携带路径与位置，严禁只返回字符串消息。
- 解析器必须可独立测试，严禁依赖 Tauri state 或全局配置。

## 陷阱

- 让解析器识别业务表名会把格式层与业务层耦合。
- 渲染时写入运行时字段会让缓存行身份污染写盘文件。
- 丢弃短行、可见空行或 `#` 行会改变游戏对表格的原始语义。
- 用正则或字符串替换修 JSON 会绕过对齐规则并引入不可解释的错误。
- 把 BOM 检测放进解析器而不是统一文本读取会让两种格式行为分叉。
- JSON word 累积条件是 `c >= ' '`（内部空格保留）且先读字符后判终止，back() 后重读首字符会把 word 复制一份。
- csv crate 无法渲染零字段记录（写出 `""` 而非空行），裸空行渲染必须手写最小引号规则。
