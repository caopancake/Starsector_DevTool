# 武器编辑器

## 定义

独立窗口编辑一个 `.wpn`、其弹体引用、资源与只读预览入口。

## Owner 与链路

- ViewModel query bundle/source options/资源，维护 Draft Session；组件管理表单/画布局部 UI；预览由专用窗口读取已保存 ProjectSession bundle。
- 保存经 Rust spec write、File History、refresh/窗口事件；弹体编辑器按 `projectileSpecId` 打开。

## 不变量

- 只写 `.wpn`，不写 CSV/弹体；`specClass` 决定正式字段分支。dirty 外部保存暂存，不能覆盖。
- 预览不能读取 local draft；资源/引用只走统一 query/cache，不拼路径或构造 fallback 弹体。
