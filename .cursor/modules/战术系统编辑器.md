# 战术系统编辑器

## 定义

独立窗口编辑战术系统 spec 的 schema 表单与 type 条件区段。

## Owner 与链路

- ViewModel 拥有 entity bundle、Draft Session、外部更新与保存；schema runtime 解析 type 条件字段；Rust editor backend 拥有目标写入与 changeset。

## 不变量

- 仅显示/保存当前 type 合法字段，未知内容按正式结构保留；只写目标 spec。
- 不在组件猜 type、直连 IPC 或覆盖 dirty draft；写后必须走 File History/ProjectSession refresh。
