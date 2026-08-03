# 主窗口历史命令

## 定义

在主窗口把 Primary+Z / Primary+Shift+Z 按优先级分派到 CSV 草稿或文件级 history。

## Owner 与链路

- shortcut composable 仅在非原生文本编辑目标拦截按键，调用 history command orchestrator。
- orchestrator 读取 active `modRoot/tableKey`：先 CSV draft undo/redo，当前表无 entry 才调用 File History replay。

## 不变量

- 不在 input/textarea/select/contenteditable 抢原生撤销；不在子窗口消费主窗口 CSV history。
- 失败只反馈，不移动 history 栈；不得以 active Mod 补齐事件身份。
