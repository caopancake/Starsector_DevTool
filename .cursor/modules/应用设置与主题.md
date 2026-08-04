# 应用设置与主题

## 定义

管理 settings 运行态、app-data 持久化、主题/editMode 与子窗口完整镜像。

## Owner 与链路

- Rust `app_settings` service 是 `settings.json` 的 UTF-8 strict JSON owner，并在保存 `logDirectory` 时返回规范化的完整 `AppSettings`；`settings.store` 是运行态、枚举/范围校验、token/snapshot owner。
- 主窗口普通设置为 `load -> initialize store -> watcher -> save -> 成功后广播同一 snapshot`；子窗口只能从 URL snapshot 初始化并监听完整 snapshot 事件。
- `historyLimit` 由 persistence 同步到两种 history store。日志目录由 Settings ViewModel 通过 `saveLogDirectory` 保存：Rust 成功后才替换为返回 snapshot，并跳过这一次 watcher 回写。

## 不变量

- settings 只写 app data，禁止 browser storage/workspace/Mod；子窗口不读写文件、不补默认值。
- `theme/accent/editMode` 使用正式枚举；字段入口消费 editMode。主题只由 store、root token 和 provider 驱动：store 生成一份确定的主题色快照，root CSS token 与 Naive UI common/Input 同时消费该快照；provider 不得传入 `var(...)`，因为 Naive 会在运行时推导具体颜色，禁止读取 DOM 计算色值或保留独立的日/夜回退色；数值输入保留其正式增减操作区。
- `starsectorRoot` 仅默认目录提示；`logDirectory=null` 表示 app data，空白字符串无效。Rust 只接受绝对目录（不是日志文件路径），在创建前后校验 canonical root、既有父链链接、app data、Mod 和已记录 workspace 边界，并确认可写；成功后保存/回传完整规范化 snapshot。自定义目录缺失时日志操作报错，不重建或回退；日志名固定。
