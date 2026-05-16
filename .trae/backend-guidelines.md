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
- 项目加载时可为同一 spec 聚合多个贴图字段的数据 URL，例如武器的 `turret*` 和 `hardpoint*` 字段；这属于预览/编辑辅助数据，不改变 spec 保存格式。
- 图片加载采用 fallback 链：Mod 目录 → starsector-core 目录（用户配置或自动推断），确保引用 core 图片的配置项和主数据表格（舰船/武器/船插/工业）都能正确预览。
- 项目加载时 sprite 预加载（`sprites.rs`）同样使用 Mod → core fallback 链，`core_dir` 由 `load_all_data` 自动推断并传入所有 sprite 加载函数。
- `scan_core_graphics` 扫描 starsector-core/graphics/ 下所有图片路径，供前端 path-image 字段下拉选取。

## 工具私有持久化

- 持久化目录：Tauri `app_data_dir()`，通常为 `%APPDATA%/com.starsector.devtool/`。
- 持久化文件：`workspace.json`，存储已导入 Mod 列表、活动 Mod、视图状态、展开状态。
- 不写入 Mod 目录内的任何私有状态。
- 读取时若文件缺失或损坏，返回空默认值（安全降级）。
- 写入时先 `create_dir_all` 确保目录存在。
- 持久化操作由前端防抖触发（500ms），通过 `save_workspace` command 调用 Rust service。

## 单例化

- 使用 `tauri-plugin-single-instance`，第二个实例启动时聚焦第一个窗口。
- 不需要进程间通信或状态转移。

## 验证目标

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
