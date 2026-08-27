# 弹体编辑器

## 定义

独立窗口编辑一个 `.proj` 规格及其依赖资源。

## Owner 与链路

- 窗口/URL 以 `kind + modRoot + id` 单例；ViewModel query bundle、维护目标 Draft Session 和资源缓存。
- 保存经 editor service/orchestrator -> Rust spec write -> File History Session -> ProjectSession refresh/窗口事件。

## 不变量

- 只写该 `.proj`，不反写武器/CSV；dirty 外部更新暂存。`projectile/missile` 分支以后端/Schema 正式结构为准，不构造默认对象掩盖缺失。
- 外观贴图为纯引用：浏览只接受 Mod 根内的 png 并原样写入字段，Mod 外拒绝，不复制、不改名、不做目录整理。
