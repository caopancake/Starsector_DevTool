# Module Map

本文件维护 `.zcode/modules/` 的写作契约和完整路由。模块文档只保存当前长期有效的 ownership、调用链和边界事实。

## 读取策略

- 先从 `.zcode/overview.md` 确定运行入口，再用 API、组件、ViewModel、service、command、parser、状态键、文件格式、资源 identity 或持久化目标选择模块。
- 索引归属仍不明确时，只读取候选模块的 `定义` 与 `不变量` 进行判定。
- 命中模块后沿当前调用、状态、数据或生命周期关系读取直接依赖；严禁按文件体量扩大范围。
- 设计候选只允许写入 `.zcode/reference.md`，阶段任务只允许写入 `.zcode/todo.md`，已知体验问题只允许写入 `.zcode/bugs.md`。

## 模块文档规范

### 文件与命名

- 模块文档必须位于 `.zcode/modules/`，文件名必须使用英文 kebab-case 并以 `.md` 结尾。

### 内容结构

- 每份模块文档必须且只允许包含 `定义`、`Owner 与链路`、`不变量` 三个二级章节。
- `定义` 必须说明模块范围；`Owner 与链路` 必须按真实调用顺序说明 owner 与交接；`不变量` 必须约束输入、输出、状态、保存和错误边界。

### 书写规则

- 模块正文必须由当前代码、schema、配置或静态检查规则支撑，严禁记录任务、候选设计、实现过程或临时状态。
- 模块正文必须直接按完整正式模型组织；调用、状态、数据和生命周期顺序必须与当前实现一致。
- 模块正文严禁引用其它模块文件名；跨模块关系必须描述正式 owner 与交接接口。

### 更新边界

- 新增模块必须先建立索引入口，再编写完整模块契约；模块边界变化必须同步更新索引和对应文档。
- 普通任务进度、测试计划、候选设计和后续计划严禁写入模块文档。

## 应用生命周期与平台

- [应用启动与窗口挂载](modules/app-window-mounting.md)：命中 `src/main.ts`、URL 窗口类型、settings 初始化、Vue 根与异步控件注册。
- [多窗口机制](modules/windowing.md)：命中 managed window、singleton identity、跨窗口事件、关闭守卫与主窗口 refresh 协调。
- [应用设置与主题](modules/app-settings.md)：命中 `settings.json`、settings store、主题、editMode、日志目录与子窗口 snapshot。
- [应用反馈与日志](modules/app-feedback-log.md)：命中 AppFeedback、确认框、业务消息、应用日志、错误文件入口与工具私有配置清理。

## 目录、工作区与项目会话

- [目录打开](modules/directory-opening.md)：命中目录选择、游戏或 Mod 识别、canonical root、ProjectSession 建立与打开 outcome。
- [新建 Mod](modules/mod-creation.md)：命中 Mod 父目录、最小目录骨架、`mod_info.json` renderer 与创建后的受信 session 打开。
- [工作区运行态与持久化](modules/workspace.md)：命中多 Mod 页签、导航上下文、workspace 快照、启动恢复、移除 Mod 与活动 Mod 同步。
- [项目会话与清单缓存](modules/project-session.md)：命中 `sessionId + modRoot`、manifest、按需 query、派生索引、cache 和写后 invalidation。

## 表格、草稿与保存

- [表格解析器](modules/csv-parser.md)：命中 CSV-like bytes、表头与行解析、CSV render、quoted CRLF 和格式错误上下文。
- [表格编辑](modules/csv-tables.md)：命中窗口化表格 query、tables store、行身份、选择、dirty 与表格保存入口。
- [草稿会话](modules/draft-session.md)：命中 base、draft、dirty、revision、pending external、目标切换与未保存确认。
- [表格草稿历史](modules/csv-edit-history.md)：命中按 Mod/表隔离的内存 operation、CSV undo/redo、rowKey 映射和 history limit。
- [表格保存与变更集](modules/table-save-changeset.md)：命中 dirty patches、关联 spec 动作、原子 changeset、rowKey map 与保存后提交。

## 文件、文本与历史

- [文件编辑器](modules/file-editor.md)：命中独立文本窗口、`sessionId + modRoot + path`、文本 Draft Session、保存和外部文本同步。
- [配置文本解析器](modules/json-parser.md)：命中 Starsector JSON-like 清洗、解析、pretty render 与 path/位置错误。
- [后端文件读写与变更集](modules/rust-file-io-changeset.md)：命中 UTF-8 IO、canonical 路径、父链校验、文件或目录快照与 replay。
- [文件历史与变更集](modules/file-history.md)：命中已写盘 changeset、按 Mod 隔离的文件级 undo/redo、确认回放与 session refresh。
- [主窗口历史命令](modules/main-history-command.md)：命中 Primary+Z、Primary+Shift+Z、CSV 草稿优先级与文件 history 分派。

## 配置与字段模式

- [配置系统](modules/config.md)：命中 mod_info、Faction、Mission、Variant、Skin、目标草稿、实体 query/write 与文件级 history。
- [字段模式系统](modules/schema.md)：命中 schema runtime、字段渲染、editMode、校验、引用 source、SelectOption 与资源选择。
- [舰船皮肤编辑器](modules/skin-editor.md)：命中 `.skin`、按 ID 列表、hull 与资源引用、重命名、删除和单文件保存。
- [装配编辑器](modules/variant-editor.md)：命中 `.variant`、hull 引用、舰船名称与缩略图、重命名、删除和单文件保存。

## 专用编辑器与预览

- [舰船编辑器](modules/ship-editor.md)：命中 `.ship`、画布交互、槽位、引擎、shield、资源上传与独立窗口保存。
- [武器编辑器](modules/weapon-editor.md)：命中 `.wpn`、`specClass` 字段、弹体引用、资源、保存与只读预览入口。
- [弹体编辑器](modules/projectile-editor.md)：命中 `.proj`、projectile/missile 分支、资源依赖、独立窗口 query 与保存。
- [战术系统编辑器](modules/system-editor.md)：命中 `.system` spec、schema 表单、type 条件字段与独立窗口保存。
- [武器发射预览](modules/weapon-preview.md)：命中已保存武器/弹体 bundle、单例只读窗口、Canvas 播放与依赖失效刷新。

## 资源、性能与信息页

- [资源与原版回退](modules/assets-core-fallback.md)：命中 `ResourceRef`、Mod/Core 优先级、data URL batch、PNG 上传与派生资源索引。
- [性能基线](modules/performance-baseline.md)：命中正式计时日志、可复现样本、ProjectSession 阶段、持久化索引和入口 bundle 体积。
- [关于页面](modules/about-page.md)：命中主窗口只读信息页、构建时内联 `CHANGELOG.md`、marked 渲染与 about 路由。
