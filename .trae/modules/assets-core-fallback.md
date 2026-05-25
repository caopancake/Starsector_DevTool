# 资源、贴图与原版资源回退系统

## 定义

资源系统读取、扫描和上传图片资源，并为 Mod 缺失资源提供 `starsector-core` 原版资源回退；ProjectSession 通过按需 query 提供只读原版引用。

## 边界

- `src/shared/api/query-api.ts` 封装 ProjectSession 资源读取 command。
- `src/shared/api/assets-api.ts` 封装贴图上传和 core 扫描 command。
- `src/services/assets.service.ts` 是图片 data URL 读取的业务入口。
- `src/services/resource-cache.service.ts` 是 ProjectSession 资源 data URL 的唯一前端缓存入口。
- `src/app/composables/use-core-schema.ts` 和 `src/app/composables/use-core-graphics.ts` 管理 core 字段与图像索引加载。
- `src-tauri/src/commands/assets.rs` 暴露贴图上传、图片 data URL 和 core 扫描 command。
- `src-tauri/src/services/config/assets.rs` 承接资源 command，处理图片 data URL、core 扫描和贴图上传 service 入口。
- `src-tauri/src/io/assets.rs` 提供低层图片和贴图 IO helper，只能由 service 调用。
- ProjectSession 的 source query 和 hull reference query 返回 `ResourceRef`；图片 data URL 只能由批量资源 query 产生。
- core 字段扫描返回 `DiscoveredField`，字段类型必须使用正式 `DiscoveredFieldType`。

## 规范

- 图片加载优先 Mod 路径，再使用原版资源回退。
- 原版资源回退来源由 ProjectSession manifest 中的 `starsectorRoot` 表达。
- core 扫描没有可用 Starsector root 时必须使用 `null` 语义并停止查询，不能用空字符串作为扫描入口参数。
- core 字段和图像索引缓存必须按 Starsector root 归属，切换 root 后必须重新扫描当前 root。
- core 字段和图像索引后台加载失败必须写入 app log，不能静默清空状态后丢失错误原因。
- core 字段和图像索引扫描 command 必须返回读取、遍历、解析和字段源结构错误，不能用空集合或跳过文件伪装扫描成功。
- 原版引用数据只用于下拉选择和缩略图，不注册为可编辑 Mod，也不参与保存。
- source option 和 hull reference option 不携带 data URL；需要缩略图时必须批量查询 `ResourceRef`。
- 前端需要给 source option 附加缩略图时必须转换为 hydrated source option，不能把 data URL 写回后端 source option wire 模型。
- 前端需要给 hull reference option 附加缩略图时必须从 option 的 `ResourceRef` 批量查询 data URL，不能读取或补造不存在的 `sprite` wire 字段。
- Hull reference query 的目标集合必须命名为 reference ids，因为该集合同时覆盖 ship hull id 和 skin hull id，不能用 hull ids 掩盖引用类型边界。
- source option 和 hull reference option 的来源字段必须使用正式来源模型，不得用裸字符串承载来源语义。
- hull reference option 的 kind 必须使用正式引用类型模型，不得用裸字符串承载 ship / skin 语义。
- `ResourceRef` 的生成权归 Rust session query；前端不得构造 ResourceRef 形状对象。
- `ResourceRef.source` 是正式资源来源枚举，只能表达当前 Mod 或原版资源，不得使用裸字符串扩展来源语义。
- `ResourceRef.ownerKind` 是正式资源归属枚举，只能表达已支持的 entity 或 CSV 表资源归属，不得使用裸字符串扩展归属语义。
- CSV 行图标资源引用必须有正式 owner id；缺少 id 的行不能生成 `ownerId` 为空的 `ResourceRef`。
- 前端需要运行时校验 `ResourceRef` 时必须使用共享资源来源和归属模型常量，不得在业务服务内另写一份合法值集合。
- `DiscoveredField.type` 是正式字段类型枚举，不得用裸字符串扩展 core 字段扫描语义。
- core 扫描 command 必须使用 payload 对象作为 wire 边界，不能使用裸 command 参数。
- ProjectSession 资源 data URL 只能通过统一资源缓存服务调用批量 query；组件不能直接调用批量资源 API。
- 资源 data URL 缺失在 wire 和前端资源缓存中必须保持 null，不能在缓存层压成空字符串；面向 UI 的 service 可在最终展示字段中转换为空字符串。
- 资源文件不存在返回 null；资源文件存在但读取失败必须返回错误，不能伪装为缺失资源。
- `ResourceRef.source=core` 必须有当前 session 的 Starsector root；缺失 root 是状态错误，不能当作资源缺失。
- core `ResourceRef` 生成需要读取原版舰船、皮肤或装配索引时，索引加载失败必须作为 query 错误返回，不能伪装成没有缩略图。
- 前端资源缓存 key 和后端批量查询内的资源去重 key 都必须包含完整资源身份：sessionId、source、relPath、ownerKind、ownerId 和 key；后端 session 内去重不包含 sessionId。
- 批量资源查询返回项必须携带完整 `ResourceRef` 身份字段；前端资源缓存必须校验返回项和请求资源一一对应，不能只按数组下标或部分字段假设 wire 结果有效。
- session 失效、关闭 session 和文件 changed paths 必须同步清理前端资源缓存。
- 上传贴图必须由 Rust 校验目标目录、文件名、扩展名、写入路径和覆盖语义。
- 上传贴图文件名必须按正向可移植 `.png` 文件名规则校验，不能通过替换字符、补扩展名或其它改写方式生成另一个目标文件名。
- 贴图上传目标子目录必须显式提交正式 SpriteSubfolder 枚举，不得缺省为默认目录，也不得用裸字符串在前后端分别解释。
- 上传和覆盖二进制贴图必须进入文件级 history，使用二进制单文件 changeset。
- 贴图上传在 changeset 校验和回放前不得创建目录或写入任何文件，失败输入不能留下未记录的磁盘副作用。
- Canvas 和预览中的像素资源必须保持邻近采样。
- `load_sprite_data_url` 必须在入口检查空路径；空路径直接返回 None，不得对空路径执行文件 IO。

## 链路：加载图片 data URL

1. 前端持有 source query、hull reference query、CSV row preview query 或 entity query 返回的 `ResourceRef`。
2. 前端按当前界面需要批量请求资源 data URL。
3. Rust 根据 `sessionId` 和 `ResourceRef` 定位 Mod 或 core 根目录。
4. Rust 读取图片并生成 data URL。
5. 缺图返回 null data URL。
6. 前端 UI 适配层把 data URL 传给预览或编辑器。

## 链路：上传贴图

1. 用户在编辑器中选择贴图文件。
2. 前端调用 `uploadSprite()`。
3. Rust assets service 校验文件名、扩展名和目标目录。
4. Rust 检查目标是否存在。
5. 允许覆盖时 Rust 通过 changeset 写入二进制文件。
6. Rust 返回统一 `WriteResult`，并在 `refreshedEntity` 中返回上传状态。
7. 前端记录普通文件级 history，并按 `invalidatedPaths` 失效 session 与资源缓存。
