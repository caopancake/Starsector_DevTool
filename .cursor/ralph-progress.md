# PROGRESS

## 规范

本文件仅适用于执行 ralph 循环 的情景，其它一切修改动作均不允许更新此文档。

## 总体目标

- 让链路非常干净，直到整个项目 code-clean 了才停下。
- 重点处理链路断裂、链路行为不一致、重要参数未传入、行为不一致问题。
- 维持一个 ralph-progress.md 在 .cursor 文件夹里，写你遇到的问题，并且在解决后更新解决的方式。
- 在整个链路里，变量和函数的命名要符合实际语义，根据实际情况调整。
- 在修复过程中，允许适当重构，鼓励在必要情况下调整函数或文件的位置，但不允许不必要的拆分文件。
- 不允许乱用黑名单。不要乱加枚举。不要加入过多静态检查文件。
- 不允许过拟合、不允许加入大量胶水文件、不允许新建大量小文件。
- 不要管 todo.md 里的计划。
- 不要处理 vite 构建问题。

## 已解决

- 问题：独立编辑器窗口的 query cache 失效监听只按 `entity-detail` / `entity-list` kind 粗略判断，导致同一 session 内无关实体 query 被失效时，当前窗口也会重查 bundle。
  - 解决：将编辑器窗口失效判断收敛到正式依赖身份：主实体按窗口 kind 和目标 id 匹配；武器窗口额外只监听当前 bundle 实际引用的 projectile detail；只有武器编辑窗口监听 projectile entity list，因为 projectile 下拉是该窗口 bundle 的显式依赖。
- 问题：文件 history replay 的 Rust command 只接收 direction 和 changes，没有 `modRoot`，后端回放前不能重新校验 changeset 路径归属。
  - 解决：将 `modRoot` 贯穿前端 replay API、write service、history replay orchestrator、Rust command payload 和 service；Rust 在应用 changeset 前校验每个 `FileChangeRecord.path` 必须是归属该 `modRoot` 的绝对路径，并补充 payload 缺失 `modRoot` 和外部路径拒绝测试。
- 问题：文件编辑器普通文本保存只提交 path 和 text，Rust 写盘前没有当前 Mod 写入根，无法证明目标路径归属。
  - 解决：文件编辑器打开请求、窗口 URL、ViewModel、保存事件、前端 service/API、Rust command payload 和 service 全部携带 `modRoot`；Rust 保存文本前校验 path 必须是归属该 `modRoot` 的绝对路径，并补充 payload 缺失 `modRoot` 和外部路径拒绝测试。
- 问题：CSV 保存关联 spec 重命名时，Rust 通过字符串搜索替换 `"hullId"` / `"id"`，绕过 JSON-like parser，不能作为正式格式链路；旧文件不存在且 `afterText` 为 null 时还会写出空文件。
  - 解决：关联 spec 重命名改为读取旧文件并通过 JSON-like parser 解析，按当前表的正式 ID 字段更新对象后 pretty JSON 写入；只有旧文件不存在时才使用前端提交的非 null `afterText`，并补充未加引号 key / 单引号 / enum 值的重命名测试和缺失内容反例。
- 问题：目录级 changeset 的 `WriteResult.invalidation.paths` 只包含目录本身，ProjectSession 的 spec/entity 索引却按目录递归扫描具体文件；删除或恢复嵌套目录时，session invalidation 和前端 query/resource cache 不能稳定命中目录内实际变更文件。
  - 解决：Rust `WriteResult` 从 changeset 生成失效路径时展开目录 change 的 before/after 文件快照，保留目录路径并补入目录内具体文件绝对路径，保证递归索引和缓存失效能按实际文件路径命中；补充目录 change 失效路径展开测试。
- 问题：文件保存和文件 history 回放的 `modRoot` 归属校验使用规范化字符串前缀判断，未拒绝绝对路径中的 `..` 组件，写入路径边界仍可能被 parent-dir 逃逸路径绕过。
  - 解决：后端 `validate_mod_root_path` 在归属判断前按路径组件拒绝 `ParentDir`，文件编辑器保存和 changeset 回放都复用该校验；补充普通保存与回放的 parent-dir 逃逸反例测试。

## 已验证

- `npm.cmd run typecheck` 通过。
- `npm.cmd run lint` 通过。
- `npm.cmd run format:check` 通过。
- `npm.cmd run encoding:check` 通过。
- `cargo test --manifest-path src-tauri\Cargo.toml` 通过。
- `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings` 通过。
- `cargo fmt --manifest-path src-tauri\Cargo.toml --check` 通过。
