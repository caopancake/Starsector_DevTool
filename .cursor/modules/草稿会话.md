# 草稿会话

## 定义

以目标身份管理 base、draft、dirty、revision 与 pending external 的前端编辑状态机。

## Owner 与链路

- ViewModel 为一个明确编辑目标创建/切换 Draft Session；用户编辑改 draft，保存成功以返回实体提交 base；外部刷新按目标/revision 接入。
- 组件只消费状态与发事件，不能以 prop 变化直接覆盖 draft。
- 主窗口的配置 Draft Session 在存活期间按 `modRoot` 登记 dirty；配置对象切换、页面/Mod 导航、移除 Mod、关闭工作区和关闭主窗口都先查询该登记，再决定是否允许销毁当前会话。

## 不变量

- identity 完整包含所属 Mod 和实体/文件目标；切换目标前显式处理 dirty。
- dirty 时外部版本仅暂存/提示，不能覆盖；无 dirty 才可采用新 base。草稿不持久化、不直接 query/write/history。
- 保存先复制提交时的草稿；只有 save 显式返回持久化快照才提交 base。请求期间若草稿已继续变化，保存结果作为 pending external 暂存，不能覆盖新输入或清除其 dirty。
- 切换或销毁 dirty 配置会话必须经统一确认；确认前不改变选择、路由或工作区运行态，确认后才释放当前组件作用域中的登记。
