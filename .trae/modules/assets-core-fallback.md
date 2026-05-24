# 资源、贴图与原版资源回退系统

## 定义

资源系统读取、扫描和上传图片资源，并为 Mod 缺失资源提供 `starsector-core` 原版资源回退；ProjectSession 通过按需 query 提供只读原版引用。

## 边界

- `src/shared/api/query-api.ts` 封装资源读取和 core 扫描 command。
- `src/shared/api/write-api.ts` 封装贴图上传 command。
- `src/services/assets.service.ts` 是图片 data URL 读取的业务入口。
- `src/services/resource-cache.service.ts` 是 ProjectSession 资源 data URL 的唯一前端缓存入口。
- `src/app/composables/use-core-schema.ts` 和 `src/app/composables/use-core-graphics.ts` 管理 core 字段与图像索引加载。
- `src-tauri/src/commands/assets.rs` 暴露贴图上传、图片 data URL 和 core 扫描 command。
- `src-tauri/src/services/config/assets.rs` 承接资源 command，处理图片 data URL、core 扫描和贴图上传 service 入口。
- `src-tauri/src/io/assets.rs` 提供低层图片和贴图 IO helper，只能由 service 调用。
- ProjectSession 的 source query 和 hull reference query 返回 `ResourceRef`；图片 data URL 只能由批量资源 query 产生。

## 规范

- 图片加载优先 Mod 路径，再使用原版资源回退。
- 原版资源回退来源由 ProjectSession manifest 中的 `starsectorRoot` 表达。
- 原版引用数据只用于下拉选择和缩略图，不注册为可编辑 Mod，也不参与保存。
- source option 和 hull reference option 不携带 data URL；需要缩略图时必须批量查询 `ResourceRef`。
- `ResourceRef` 的生成权归 Rust session query；前端不得构造 ResourceRef 形状对象。
- ProjectSession 资源 data URL 只能通过统一资源缓存服务调用批量 query；组件不能直接调用批量资源 API。
- 资源缓存 key 必须包含 sessionId、source、relPath、ownerKind、ownerId 和 key。
- session 失效、关闭 session 和文件 changed paths 必须同步清理前端资源缓存。
- 上传贴图必须由 Rust 校验目标目录、文件名、扩展名、写入路径和覆盖语义。
- 上传和覆盖二进制贴图必须进入文件级 history，使用二进制单文件 changeset。
- Canvas 和预览中的像素资源必须保持邻近采样。
- `load_sprite_data_url` 必须在入口检查空路径；空路径直接返回 None，不得对空路径执行文件 IO。

## 链路：加载图片 data URL

1. 前端持有 source query、hull reference query、CSV row preview query 或 entity query 返回的 `ResourceRef`。
2. 前端按当前界面需要批量请求资源 data URL。
3. Rust 根据 `sessionId` 和 `ResourceRef` 定位 Mod 或 core 根目录。
4. Rust 读取图片并生成 data URL。
5. 缺图返回空 data URL。
6. 前端把 data URL 传给预览或编辑器。

## 链路：上传贴图

1. 用户在编辑器中选择贴图文件。
2. 前端调用 `uploadSprite()`。
3. Rust assets service 校验文件名、扩展名和目标目录。
4. Rust 检查目标是否存在。
5. 允许覆盖时 Rust 通过 changeset 写入二进制文件。
6. Rust 返回上传结果和 `FileChangeRecord[]`。
7. 前端记录普通文件级 history。
