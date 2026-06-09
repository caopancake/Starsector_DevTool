# Backend Guidelines

本文档只记录当前 Rust 后端必须遵守的长期规则。当前规则之外的设计资料只写入 `todo.md` 或 `reference.md`。

## 模块分层

- 后端入口的唯一宏观链路是 `Rust command -> service -> domain / io / parser / model`，任何情况都不允许绕过。
- Rust command 层只能调用 service；除参数接收和错误转换外，不允许包含任何实现细节。
- `npm.cmd run lint` 包含 Rust 架构静态检查；检查依据是 crate 层级依赖方向，不得靠禁止项枚举来定义边界。
- command 层必须保持纯 service 边界，command 注册必须完整，service 不得反向依赖 command，domain / io / parser 不得反向依赖 service 或 command。
- 业务规则和数据转换放在 service 或 domain；路径安全、文件读写放在 service 或 io；解析和渲染放在 parser。
- command 模块按 project、workspace、tables、config、files、assets 等边界组织；command 名称保持前端兼容。
- service 和 command 公开函数名表达业务能力，不使用 history 这类内部效果命名。
- service 不得依赖 command payload 模型；command wire payload 只能停留在 command 边界。
- command 层负责把 wire payload 拆成 service 业务参数；service 公开函数不得接受 command payload，也不得用 command-only 命名表达业务能力。
- domain 只放纯业务规则、校验、构造和数据转换，不依赖 command、service、io、parser 或 command payload。
- Rust 是文件系统、canonical root 路径边界、删除语义、写盘和 changeset 回放的权威实现。
- 前端传来的路径只能作为待校验输入，后端必须重新校验 canonical root 归属、链接父链和写入边界。
- ProjectSession 的正式后端结构是 `entry / root / session / query / write / cache / model`。
- `project/mod.rs` 只能保留模块声明和 command-facing service re-export。
- `entry` 承载 command-facing ProjectSession 入口编排，可组合 ProjectSession 内部能力和同级 app service 效果。
- `root` 承载目录识别、游戏概览和非 session 根服务。
- `query` 只读，不写盘。
- `write` 执行写入事务并产出失效信息，不打开或重建整个项目。
- `cache` 按 session 或 Starsector root 管理缓存，core cache 必须按类型懒加载。
- `model` 只能承载 session、query、write、rowKey、patch 和 resource 相关模型，不依赖上层。

## 编码与 IO

- 所有文本文件按 UTF-8 无 BOM 读取和写入。
- 文档与源码保持 CRLF。
- 读取、解析、写入和删除错误必须返回足够定位问题的上下文。
- 写文件前必须确保目标路径在允许的 canonical Mod、游戏目录或工具私有目录内，并拒绝任一已有父链 symlink、junction 或 reparse point。
- 读文件、目录遍历、删除和 changeset 回放必须使用同一路径边界；只读扫描不能用字符串前缀判断替代 canonical root 校验。
- 删除目录必须由后端显式支持目录级事件，不能靠前端递归拼路径。

## 数据格式

- 数据格式解析规则归属对应 parser 模块文档。
- parser 必须有负例测试，避免把明显错误的格式放得过宽。

## 文件变更集

- 后端写盘、删除和回放必须通过统一 changeset 边界。
- changeset 构建和回放能力归属 `io` 层；command-facing 保存入口归属 service。
- changeset 应能覆盖声明支持的文件和目录变更，并在失败时返回错误。
- changeset 构建、目录快照和回放必须在写入或删除前完成 canonical root 和链接父链校验。

## 保存边界

- 保存流程只能写入当前模块明确声明拥有的目标。
- Workspace 私有状态只能写工具私有目录，不得写入 Mod。

## 资源与贴图

- 资源读取和写入必须通过后端校验 canonical root、链接父链、目标和格式。

## 验证目标

- Rust `cargo fmt --check` 必须通过。
- Rust `cargo clippy --all-targets -- -D warnings` 必须零 warning。
- Rust 测试必须覆盖 parser、changeset、路径安全和关键保存语义。
