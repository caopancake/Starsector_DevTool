# Backend Guidelines

本文档只记录当前 Rust 后端必须遵守的长期规则。当前规则之外的设计资料只写入 `todo.md` 或 `reference.md`。

## 模块分层

- Tauri command 层只负责参数接收、错误转换和调用 service。
- 业务规则、路径安全、文件读写、解析和保存必须放在 service 或 parser 模块。
- command 模块按 project、workspace、tables、config、files、assets 等边界组织；command 名称保持前端兼容。
- Rust 是文件系统、路径校验、删除语义、写盘和 changeset 回放的权威实现。
- 前端传来的路径只能作为待校验输入，后端必须重新校验路径归属和写入边界。

## 编码与 IO

- 所有文本文件按 UTF-8 无 BOM 读取和写入。
- 文档与源码保持 CRLF。
- 读取 CSV、JSON-like spec、配置文件和 workspace 私有状态必须返回带路径和上下文的错误。
- 写文件前必须确保目标路径在允许的 Mod、游戏目录或工具私有目录内。
- 删除目录必须由后端显式支持目录级事件，不能靠前端递归拼路径。

## 数据格式

- CSV 解析必须保留真正空行、全逗号空行和 `#` 开头注释行，让前端表格能显示和删除。
- CSV 行身份由前端 `_rowKey` 表示，业务 ID 只从表格字段读取。
- Starsector JSON-like 文件使用宽松 parser，支持当前已验证的注释、尾逗号、未加引号枚举、无前导零小数和分号条目结束。
- 宽松 parser 必须保留负例测试，避免把明显错误的格式放得过宽。
- `mod_info.json`、`.ship`、`.wpn`、`.proj`、`.system`、`.faction`、mission 文件都必须在错误中带出具体文件路径。

## 文件变更集

- 文件级保存历史的权威载体是 `FileChangeRecord[]`。
- 单文件保存和多文件保存都使用同一种 changeset。
- changeset 可以表达文本文件创建、修改、删除和目录删除。
- `apply_file_change_set` 必须在失败时尽量回滚已写入内容，并把错误返回给前端。
- 文件级 undo/redo 的栈移动由前端在后端回放成功后提交，后端不替前端移动历史状态。

## 保存边界

- CSV 保存只写对应 CSV，除非用户确认创建或删除关联 spec 文件。
- `.ship`、`.wpn`、`.proj`、`.system` 保存只写对应 spec，不隐式保存 CSV。
- 配置保存只写当前配置模块明确拥有的文件。
- Workspace 私有状态只能写工具私有目录，不得写入 Mod。
- `starsector-core` 只读，不注册为可编辑 Mod。

## 资源与贴图

- 图片加载优先 Mod 文件，再使用推断或显式 `starsectorRoot` 下的 core fallback。
- 像素资源预览必须保持邻近采样。
- 二进制贴图覆盖暂不纳入文件级 changeset，必须作为不可逆操作处理。
- 贴图上传和覆盖必须由后端校验扩展名、目标目录和写入路径。

## 验证目标

- Rust `cargo fmt --check` 必须通过。
- Rust `cargo clippy --all-targets -- -D warnings` 必须零 warning。
- Rust 测试必须覆盖 parser、changeset、路径安全和关键保存语义。
