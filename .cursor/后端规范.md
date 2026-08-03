# 后端规范（AI 规则）

- 唯一层级：`command -> service -> domain/io/parser/model`。command 仅 wire 参数、错误转换和 service 调用；service 不接收 command payload；下层不反向依赖上层。
- `domain` 是纯规则/转换；`io` 是路径和文件；`parser` 是解析/渲染；`models` 是交换模型。业务公开名称表达能力而非内部效果。
- ProjectSession：`entry/root/session/query/write/cache/model`；`query` 只读，`write` 事务写入并返回失效，core cache 按类型懒加载。
- Rust 是路径、文件、删除、写入和 changeset 回放权威。所有前端路径都重新校验 canonical root、父链 symlink/junction/reparse point 与写入目标；扫描、读取、删除、回放复用同一边界。
- 文本 UTF-8 无 BOM、CRLF；错误携带定位上下文。格式负例必须有测试。
- 所有写/删/回放经 changeset；IO 拥有构建/回放，service 为 command-facing 入口。目录操作必须是正式目录事件。
- 保存仅写本模块目标；workspace 只写工具私有目录；资源读写同样走后端路径/格式校验。
- 验收：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、测试（含 parser、changeset、路径与保存语义）。
