# 资源、贴图与 core fallback 系统

## 定义

资源系统读取、扫描和上传图片资源，并为 Mod 缺失资源提供 `starsector-core` fallback。

## 边界

- `src/shared/api/assets-api.ts` 封装资源相关 command。
- `src/features/assets/core-fields-store.ts` 和相关 loader 管理 core 字段与图像索引。
- `src-tauri/src/commands/assets.rs` 暴露贴图上传、图片 data URL 和 core 扫描 command。
- `src-tauri/src/services/config/assets.rs` 承接资源 command，处理图片 data URL、core 扫描和贴图上传 service 入口。
- `src-tauri/src/filesystem/assets.rs` 提供低层图片和贴图 IO helper，只能由 service 调用。
- `src-tauri/src/services/project/sprites.rs` 在完整项目加载时读取 sprite bundle。

## 规范

- 图片加载优先 Mod 路径，再使用 core fallback。
- core fallback 来源由完整项目加载时确定的 `starsectorRoot` 表达。
- 上传贴图必须由 Rust 校验目标目录、文件名、扩展名和覆盖语义。
- 上传和覆盖二进制贴图必须进入文件级 history，使用二进制单文件 changeset。
- Canvas 和预览中的像素资源必须保持邻近采样。

## 链路：加载图片 data URL

1. 前端请求图片路径。
2. assets API 调用 `load_image_data_url`。
3. Rust assets command 调用资源 service。
4. Rust 先检查 Mod 内目标路径。
5. Rust 在需要时检查 core fallback 路径。
6. Rust 读取图片并生成 data URL。
7. 前端把 data URL 传给预览或编辑器。

## 链路：上传贴图

1. 用户在编辑器中选择贴图文件。
2. 前端调用 `uploadSprite()`。
3. Rust assets service 校验文件名、扩展名和目标目录。
4. Rust 检查目标是否存在。
5. 允许覆盖时 Rust 通过 changeset 写入二进制文件。
6. Rust 返回上传结果和 `FileChangeRecord[]`。
7. 前端记录普通文件级 history。
