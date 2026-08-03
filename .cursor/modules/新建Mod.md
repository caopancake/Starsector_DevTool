# 新建 Mod

## 定义

从已读取的游戏目录或用户选定的父目录创建可被 Starsector 与编辑器识别的最小 Mod 骨架。

## Owner 与链路

- 总览页的创建 ViewModel 在存在游戏概览时选择 `starsectorRoot/mods`，否则请求用户选择 Mod 父目录；创建 orchestrator 调用 service/API/command，再由 Rust service、domain 与 IO 创建目录和模板。
- Rust 成功返回 canonical `modRoot` 与已解析的可选游戏根后，创建 ViewModel 先完成磁盘创建事务并关闭对话框，再由 creation orchestrator 以该受信结果直接刷新游戏概览、建立 ProjectSession；创建本身不写 workspace、session 或 history，打开过程的 loading/失败归工作区生命周期。
- 模板只写 UTF-8 无 BOM、CRLF 的 `mod_info.json`（ID、名称、版本、游戏版本），并创建 `data/hulls`、`data/weapons`、`data/variants`、`data/world/factions`、`data/missions` 与各图像资源空目录。

## 不变量

- 游戏目标必须由后端确认是有效游戏目录，且只能写入其 canonical `mods`；自定义目标必须是安全、已存在且不含链接的父目录。
- Mod ID 同时作为新建目录名，必须是受限 ASCII 标识；目标目录、同父目录已解析 Mod ID 均不得冲突。失败只回滚本次刚创建的根目录，不触及已有目录。
- 不预置 CSV、spec 或业务实体文件，避免空模板改变游戏合并/覆盖语义；后续实体创建继续走各自的保存与 history 边界。
