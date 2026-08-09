# 工作区运行态与持久化

## 定义

管理主窗口多 Mod 运行态、Mod 页签导航上下文、工具私有 workspace 快照、恢复与活动 Mod 同步。

## Owner 与链路

- workspace store 拥有全局页、已加载 Mod、按 `modRoot` 保存的 Mod 页面上下文、概览、列宽和持久化投影；persistence orchestrator 自动保存/启动恢复；navigation/lifecycle orchestrator 同步跨 store、移除/关闭。
- 顶部 Mod 页签经 navigation orchestrator 先同步同一 `modRoot` 的 project/tables/editor/history 运行态，再恢复该 Mod 最近的表格或配置页；左侧只消费当前 Mod 的固定导航。右侧常驻 `+` 只进入工作区总览，齿轮菜单承载总览、设置和关于等全局页。
- 导航 ViewModel 在替换当前配置视图前查询该 Mod 的活跃 Draft Session；工作区关闭、Mod 移除和主窗口关闭同时检查 CSV 与配置 dirty。
- Rust workspace service 只读写工具私有文件；目录 opening 提供打开 outcome；侧栏消费 domain Mod navigation。

## 不变量

- 游戏概览与已开 ProjectSession 分离；按 modRoot 隔离。恢复重新打开 session，完成后显示工作区总览；Mod 页面上下文只存于本次运行，不能作为持久化或 session 权威。
- workspace 缺失返回空默认，损坏报错且不得立即用空态覆盖；自动保存在恢复期暂停。持久化只保存可恢复的目录/Mod/列宽投影，不保存活动页签、全局视图或旧侧栏展开态；列宽使用结构化 `modRoot/table/column`，不拼 key。
- 任何会卸载当前配置组件的导航，或会移除其 Mod 的动作，在 dirty 时必须先确认放弃；取消时不得同步活动运行态或销毁 session。
