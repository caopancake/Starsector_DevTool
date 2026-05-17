# Backend Guidelines

后端使用 Rust + Tauri commands。Rust 是文件系统、解析、保存、路径安全和数据校验的权威实现；前端不应绕过后端直接推断磁盘语义。

## 分层

- `commands/`：薄入口，只负责参数接收、调用 service、把错误转换给前端。
- `services/`：业务流程和保存语义，例如加载项目、保存表格、保存 spec、删除资源。
- `parsers/`：CSV、宽松 JSON 等格式解析与写回辅助，不依赖 Tauri。
- `models/`：payload、AppData、workspace、核心 spec 类型和跨层数据结构。
- `filesystem/`：路径规范化、文本 IO、JSON 文件、资源扫描、贴图写入。
- `errors.rs`：统一错误类型和结果别名，避免到处拼字符串错误。

## 调用规则

- command 不承载业务逻辑，不直接读写业务文件。
- service 组合 parser、filesystem、models，并表达清晰的保存和删除边界。
- parser 不负责 UI 语义；filesystem 不推断前端状态。
- 所有 command payload 使用 camelCase 契约；字段变更必须同步前端 API adapter 和共享类型。
- 对外 command 应稳定、少而清晰；不要为组件内部细节新增一次性 command。
- 任何涉及路径的操作都必须在后端校验，不能信任前端传入的相对路径或文件名。

## 编码与文件 IO

- 所有源码和文本配置读取/写入必须按 UTF-8 无 BOM 处理。
- Rust 文本读取优先使用 `read_utf8_no_bom()`，文本写入优先使用 `write_utf8_no_bom()`。
- 保存前确保父目录存在；失败要返回可读错误，不吞异常。
- 不引入会写出 BOM 或改变换行策略的临时 IO 路径。

## 数据格式

- Starsector JSON 读取使用宽松解析，兼容注释、尾逗号、未加引号 key 等常见写法。
- 写回 JSON 使用结构化 pretty JSON；不承诺保留注释、尾逗号和手写格式。
- CSV 保存必须保留表头、注释行和空字段语义。
- spec 模型采用“核心字段强类型 + extra 保留未知字段”，兼容 Starsector 长尾字段。
- multi-source schema 的聚合/拆分不能改变原文件边界：列表行、JSON 文件、文本文件分别写回对应位置。
- 删除操作要区分“从索引删除”和“删除实体文件/目录”，默认选择风险较低的行为。

## 贴图规则

- 贴图上传按用途写入固定目录：舰船 `graphics/ships/`，武器 `graphics/weapons/`，弹体 `graphics/missiles/`。
- 上传时必须处理重名覆盖确认，不能静默覆盖。
- 图片加载使用 Mod → starsector-core fallback 链；fallback 只影响预览和选择，不改变保存格式。
- 项目加载可以返回贴图 data URL 或可选路径列表作为 UI 辅助，但这些辅助字段不得写回 spec。
- 路径归一化应兼容 Windows 分隔符，并阻止越权访问。

## 工具私有持久化

- 工具私有状态只写入 Tauri `app_data_dir()`，不写入 Mod 目录。
- `workspace.json` 保存已导入 Mod、活动 Mod、视图状态和展开状态等工具状态。
- 读取时若文件缺失或损坏，返回安全默认值并允许前端继续启动。
- 写入时先确保目录存在；workspace 保存失败要向前端返回错误。
- 私有持久化格式可以演进，但必须保持旧数据的安全降级路径。

## 单例化

- 使用 `tauri-plugin-single-instance` 保持单实例。
- 第二个实例启动时聚焦已有窗口；不要在两个进程之间复制或合并工作区状态。
- 单例逻辑不应影响 workspace 持久化的读写时机。

## 验证目标

- 后端改动至少运行 `cargo fmt --manifest-path src-tauri\Cargo.toml --check`。
- 业务逻辑、路径、解析、保存或删除改动要运行 `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings` 和 `cargo test --manifest-path src-tauri\Cargo.toml`。
- 跨前后端契约改动还要运行前端 typecheck，确保 payload 和返回类型同步。

## 代码生成（Phase 17 规划）

- 代码生成属于后端 service，前端只提交结构化输入和用户确认。
- 生成的 Java 必须兼容 Starsector 运行时约束，默认按 JDK 7 目标处理。
- 代码生成应尽量幂等：相同输入产生相同输出，避免无意义 churn。
- 蓝图元数据与生成代码是不同保存边界；保存蓝图不应隐式覆盖 Java。
- 模板、节点注册表和生成目标路径都必须经过路径校验。
