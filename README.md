# Starsector DevTool

Windows 桌面版 Starsector Mod 配置工具，使用 Tauri 2 + Vue 3 + TypeScript + Rust 构建。

## 功能

- 选择并打开 Starsector 游戏根目录
- 或打开一个单独的 Starsector Mod 目录
- 编辑舰船、武器、联队、船插、工业 CSV
- 势力筛选、搜索、排序、单元格编辑、保存和撤销
- 舰船 `.ship` 可视化编辑
- 武器 `.wpn` 可视化编辑
- 弹体 `.proj` 编辑
- 发射预览
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

```powershell
.\build.ps1
```

或：

```bat
build.bat
```

构建完成后产物位于：

```text
src-tauri\target\release\starsector-devtool.exe
```

构建脚本内部使用 `tauri build --no-bundle`，不生成 MSI/NSIS 安装包。

## 验证

```powershell
npm.cmd run encoding:check
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings
```

## 文档

- 项目入口：[AGENTS.md](./AGENTS.md)
- 细则文档：[.trae/](./.trae/)

## 许可

GPL-3.0，见 [LICENSE](./LICENSE)。
