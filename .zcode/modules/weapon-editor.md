# 武器编辑器

## 定义

独立窗口编辑一个 `.wpn`、其弹体引用、资源与只读预览入口。

## Owner 与链路

- ViewModel query bundle/source options/资源，维护 Draft Session；组件管理表单/画布局部 UI；预览由专用窗口读取已保存 ProjectSession bundle。
- 保存经 Rust spec write、File History、refresh/窗口事件；弹体编辑器按 `projectileSpecId` 打开。

## 不变量

- 只写 `.wpn`，不写 CSV/弹体；`specClass` 决定正式字段分支。dirty 外部保存暂存，不能覆盖。
- 预览不能读取 local draft；资源/引用只走统一 query/cache，不拼路径或构造 fallback 弹体。
- 画布镜像模式按空格开关，仅作用于当前视图（炮塔/固定）的发射点数组，两套数组互不配对；配对只按坐标对称（容差比较）实时计算，禁止按下标或 ID 记忆；镜像新增/调整/删除成对生效，中轴上的发射点退化为单件；检查器数值输入不参与镜像联动。
- 贴图字段为纯引用：浏览只接受 Mod 根内的 png 并原样写入字段，Mod 外拒绝，不复制、不改名、不做目录整理。
