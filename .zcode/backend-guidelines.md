# Backend Guidelines

本文件维护 `src-tauri/src/` 的分层、ProjectSession、路径、文本、parser、IO 与 changeset 边界。通用调查和验证流程见 `.zcode/workflow.md`。

## 基础分层

- command 只允许处理 wire payload、错误转换和 service 调用，并且只允许依赖 service 与 command-facing model。
- service 只允许接收业务模型，严禁接收 command payload；普通 service 允许依赖 service、domain、IO、parser 与 model。
- domain 只允许拥有纯规则并依赖 domain 与 model；model 只允许依赖 model。
- parser 只允许负责格式解析和渲染并依赖 parser 与 model；IO 只允许负责路径和文件，并依赖 IO、parser 与 model。
- 公开名称必须表达业务能力和 owner，严禁使用内部写盘效果代替业务语义。

## ProjectSession

- `services/project/` 必须按 root、session、query、write、resources、cache 与 model 分层；root 只暴露正式 session、query 和 resource 入口。
- query 必须只读，严禁写文件或应用 changeset；write 必须执行目标写入，严禁重新打开 ProjectSession。
- cache 必须按实体类型懒加载 Mod 与 Core 数据；严禁预读完整 Core 集合。
- session 必须由 `sessionId + modRoot` 约束，并且只允许接收已写盘或已回放的 `FileChangeRecord` 进行 refresh。
- write 必须返回实际 changes、结构化 invalidation 和保存结果；无法定位实体 ID 时只允许扩大到该实体类型的正式全类 scope。

## 路径与资源

- Rust 是所有磁盘路径、遍历、读取、写入、删除、目录事件和 changeset 回放的权威。
- 所有外部路径必须重新 canonicalize，并验证目标属于声明 root；已有父链中的 symlink、junction 与 reparse point 必须被拒绝。
- 文件编辑命令带有 session 时必须校验 `sessionId + modRoot` 所有权；显式无 session 的错误恢复编辑只允许访问调用方提供的 `modRoot` 内目标，并且必须执行相同的绝对路径、父目录与链接逃逸校验。
- 读取、扫描、写入、删除和回放必须复用同一套路径与 walk-entry 校验。
- Mod 资源必须优先于 Core 资源；Core 只允许作为 canonical 游戏根下的只读 fallback。
- workspace、settings、日志与持久化索引只允许写入工具私有目录，严禁写入 Mod 目标。

## 文本与 parser

- 文本读取必须拒绝 UTF-8 BOM；已知 CP1252 智能引号和 en dash 只允许按 IO 中的明确映射规范化。
- `write_utf8_no_bom` 必须按调用方提供的文本原样写入 UTF-8 字节；具体文件格式的 renderer 必须拥有其换行、缩进和序列化规则。
- 新建 Mod 的 `mod_info.json` renderer 必须输出 UTF-8 无 BOM 与 CRLF；其它格式必须遵守各自 parser 或保存模型的现行输出语义。
- CSV-like 与 JSON-like parser 必须独立于路径选择和业务表识别，并在格式错误中携带 path、行或位置上下文。
- parser 严禁写盘、构造业务 identity、生成运行时字段或吞掉结构错误。

## Changeset

- 保存、删除、导入与回放必须先构建文件或目录快照，再由 IO 应用可回放 changeset。
- 目录变更必须作为正式目录事件记录并展开精确影响；失败必须保留上下文且严禁提交前端成功状态。
- 每个保存入口只允许写入所属模块声明的持久化目标；关联文件操作必须由同一正式保存模型显式声明。
