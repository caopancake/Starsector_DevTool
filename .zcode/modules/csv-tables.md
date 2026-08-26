# 表格编辑

## 定义

提供按窗口 query 的 CSV 表、Draft Session 编辑、dirty/选择和表格保存入口。

## Owner 与链路

- ProjectSession query 提供窗口行；`tables.store` 按 mod/table 管理草稿、选择与 dirty；Draft Session 管理 base/draft/row identity。
- 组件经 ViewModel 操作 store；保存 orchestrator 捕获当前目标、构造 patches/关联动作，调用 service，交 File History/ProjectSession refresh 后提交本地结果。
- 表格导航先同步活动 Mod 与目标表，再暴露表格视图；已处于同一 Mod/表的导航为幂等操作，不触发草稿或查询重置。

## 不变量

- 行身份使用 Rust rowKey，前端新增仅临时 new key；不按数组索引/显示过滤结果定位。
- 表格不直接 IPC/写盘/维护 history；保存只能当前表及声明关联目标，noop 不污染 history/dirty。
