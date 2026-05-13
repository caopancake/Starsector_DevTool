# Backend Guidelines

后端使用 Rust + Tauri commands。Rust 是文件系统、解析、保存和校验的权威实现。

## 分层

- `commands/`：Tauri command 参数接收和错误转换。
- `services/`：业务流程，例如加载项目、保存表格、保存 spec。
- `parsers/`：CSV 和 Starsector 宽松 JSON 的解析与写回辅助。
- `models/`：payload、项目数据、核心 spec 类型。
- `filesystem/`：路径、资源扫描、文本 IO、JSON 文件、贴图上传。
- `errors.rs`：统一错误类型和结果别名。

## 调用规则

- command 不承载业务逻辑，只做薄入口。
- service 不直接散落路径字符串；优先使用模型和 filesystem helper。
- parser 不负责 UI 语义。
- filesystem 不推断前端状态，只处理路径和文件。
- 所有 command payload 使用 camelCase 契约，避免前后端字段漂移。

## 编码与文件 IO

- 所有源码和文本配置读取必须按 UTF-8 无 BOM 处理。
- Rust 文本读取优先使用 `read_utf8_no_bom()`。
- Rust 文本写入优先使用 `write_utf8_no_bom()`。
- PowerShell 读取源码必须带 `-Encoding utf8`。
- 禁止 Raw 方式读取源码内容。

## 数据格式

- Starsector JSON 允许宽松格式：`#` 注释、尾逗号、未加引号 key。
- 写回 JSON 使用结构化 pretty JSON，不承诺保留注释和手写格式。
- CSV 保存必须保留表头、注释行和空字段。
- spec 模型采用“核心字段强类型 + extra 保留未知字段”，兼容 Starsector 长尾字段。

## 贴图规则

- 舰船贴图写入 `graphics/ships/`。
- 武器贴图写入 `graphics/weapons/`。
- 弹体贴图写入 `graphics/missiles/`。
- 上传时必须处理重名覆盖确认，不能静默覆盖。

## 验证目标

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
