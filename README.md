# Starsector DevTool

Windows 桌面版 Starsector Mod 配置工具，用 Tauri 2 + Vue 3 + Rust 重建旧版 `old_program` 功能。

## 功能
- 选择并打开 Starsector mod 根目录
- 编辑舰船、武器、联队、船插、工业 CSV
- 阵营筛选、搜索、排序、单元格编辑、保存和撤销
- 舰船 `.ship` 可视化编辑
- 武器 `.wpn` 可视化编辑
- 弹丸/导弹 `.proj` 编辑
- 弹道、导弹、光束预览
- PNG 贴图导入

## 技术栈
- Tauri 2
- Rust
- Vue 3
- TypeScript
- Naive UI
- Canvas 2D

## 开发
```bash
npm install
npm run tauri -- dev
```

## 构建
本项目只发布单文件 exe，不发布安装包。

```powershell
.\build.ps1
```

或：
```bat
build.bat
```

构建完成后产物位于：
```text
release\Starsector_DevTool.exe
```

构建脚本内部使用 `tauri build --no-bundle`，会把前端资源嵌入 exe，但不会生成 MSI/NSIS 安装包。

## 验证
```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## 文档
- 项目入口：[AGENTS.md](./AGENTS.md)
- 旧版参考：[old_program/](./old_program/)

## 许可
GPL-3.0，见 [LICENSE](./LICENSE)。
