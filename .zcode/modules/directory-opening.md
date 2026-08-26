# 目录打开

## 定义

将用户选定目录识别为游戏概览或 Mod，并建立正式 ProjectSession。

## Owner 与链路

- 组件请求目录；directory-opening orchestrator 调用后端识别，分派 game overview 或 `open ProjectSession`，再写 workspace/project 状态与反馈。ProjectSession 打开失败时回滚本次运行态，并以已识别的 canonical `modRoot` 和错误文件引用写入 workspace 失败状态。新建 Mod 使用单独的受信创建结果入口，直接以 canonical `modRoot` 与可选游戏根刷新概览、建立 session，不再重新识别刚创建的目录。
- Rust root service 拥有 canonical 路径、目录类型、游戏/Mod 识别与 session 打开；`mod_info.json` 解析警告携带结构化 `modRoot + path` 编辑目标；workspace 只消费 outcome。

## 不变量

- 游戏概览不等于已加载 Mod；只有成功 session 才可驱动业务 query。
- 失败只允许回滚本次注册的运行态并保留已有 workspace；恢复编辑目标必须由已识别的 `modRoot` 与其内部错误路径共同确定，路径安全校验只以后端为权威。
- 游戏目录的 `mods` 目标由本模块以同一游戏根判定和路径边界解析；新建 Mod 不自行推导或拼接未校验的游戏路径。
