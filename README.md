# Starsector DevTool

Windows 桌面版 Starsector Mod 配置工具，使用 Tauri 2 + Vue 3 + TypeScript + Rust 构建。

## 功能

- 打开 Starsector 游戏目录或单独的 Mod 目录
- 以工作区方式管理和切换多个 Mod
- 编辑常用 CSV、配置、舰船、武器、弹体和文本文件
- 预览武器发射效果
- 导入和覆盖 PNG 贴图
- 支持保存历史、撤销和重做

## 技术栈

- Tauri 2
- Rust
- Vue 3
- TypeScript
- Naive UI
- Canvas 2D

## 开发

```powershell
npm install
npm.cmd run tauri -- dev
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

项目只发布单文件 exe，不生成安装包。

## 验证

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run encoding:check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri\Cargo.toml --check
```

## 文档

- 项目入口：[AGENTS.md](./AGENTS.md)
- 细则文档：[.cursor/](./.cursor/)

## 许可

GPL-3.0，见 [LICENSE](./LICENSE)。
