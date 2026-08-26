# 文件编辑器

## 定义

独立窗口编辑一个已授权 Mod 文本文件，支持 ProjectSession 编辑与工作区错误恢复编辑。

## Owner 与链路

- 常规 window identity 为 `sessionId + modRoot + path`；错误恢复 window identity 为结构化扫描 warning 或 Mod 打开失败提供的 `modRoot + path`；ViewModel 拥有文本 Draft Session、加载、保存请求、行列聚焦和外部文本暂存。
- 保存经 service/API -> Rust 校验/changeset；常规模式向主窗口发送保存事件并进入 history/refresh，错误恢复模式在无 ProjectSession 时直接保存目标文件。

## 不变量

- Rust 必须校验 `modRoot` 归属、绝对路径、父目录和链接边界，前端严禁从错误文本推导授权根目录或直接写盘。保存只允许写当前文件。
- 错误恢复入口只允许消费 Rust 游戏概览 warning 或目录打开链路携带的结构化编辑目标；调用链必须提供可信 `modRoot`，错误文件路径必须属于该根目录。无编辑目标的错误严禁显示文件按钮。
- dirty 窗口接收回放文本只能暂存，不能覆盖 textarea；窗口复用通过明确聚焦上下文事件。
- dirty 状态关闭窗口必须显式确认放弃文本，标题栏、Escape 和窗口内关闭均走同一窗口关闭守卫。
