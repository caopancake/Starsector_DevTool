# Module Map

本文档是 `.cursor/modules/` 的模块文档模板和索引。项目宏观架构边界写在 `.cursor/overview.md`，模块级定义、边界、规范和调用链写在对应模块文档中。

## 模块文档规范

### 文件与命名

- 模块文档统一放在 `.cursor/modules/`。
- 文件名使用英文 kebab-case，并以 `.md` 结尾
- 文档标题使用中文模块名，保持和本文档索引一致。

### 内容结构

- 每个模块文档保留 `定义`、`参考`、`边界`、`链路`、`规范` 和 `陷阱` 章节结构。
- `定义` 只用一句话说明该模块的作用、定义，不允许包含任何实现细节。
- `参考` 只列举能支撑正式模型和 ownership 的关键文件、目录或方法，并说明该对象在模型中的作用。
- `边界` 只写 ownership 表和禁止边界表中长期成立的职责归属、状态归属、读写边界、消费边界和跨模块拥有关系。
- `链路` 只写正式模型中每一条真实链路的调用顺序，不能混入规范、解释、候选方案、历史原因或临时流程。
- `规范` 只写输入输出表、状态持久化表、错误语义、保存语义、跨模块调用语义和长期实现规则中能约束代码的内容。
- `陷阱` 只写禁止边界表的反向错误做法，以及会导致状态错归属、输入绕过、输出污染、错误语义错位、持久化污染、链路断裂或外部协议误判的具体风险。
- 结构不得互相复制，不允许出现任何重合的语义。

### 书写规则

- 模块正文不得引用其它模块文档的文件名。
- 模块正文禁止泛用性指代、概览性描述、凑行数句、重复换词句和无法约束实现的空话。
- 写章节前必须先建立模块正式模型：核心对象、输入来源、输出对象、状态归属、持久化归属、外部协议或文件格式、UI 行为边界、错误语义和跨模块入口。
- 写章节前必须先建立模块 ownership 表：数据模型、API / command、store、持久化、错误、日志、路由、跨模块入口和外部资源分别归谁拥有，以及谁只能消费不能写入。
- 写章节前必须先建立模块输入输出表：每类输入写清来源、解析层、合法输出和失败语义；每类输出写清消费者、字段语义和禁止污染边界。
- 写章节前必须先建立模块状态持久化表：每个状态写清 owner、是否持久化、保存位置、恢复时机、更新边界和消费方。
- 写章节前必须先建立模块真实链路表：页面入口、store / action、API / IPC、Rust command、core service、持久化、事件、错误和路由链路按真实调用顺序拆开。
- 写章节前必须先建立模块禁止边界表：不得直接 IPC、不得直接读写持久化、不得绕过 parser / mapper / normalizer、不得直接读取外部原始值、不得错归属 toast / log / route、不得反向依赖业务模块。
- 模块正文必须直接按正式模型进行组织，落盘即为完整版本。
- 模块文档不允许多于 300 行。
- `定义` 章节不允许多于 1 行；
- `参考` 章节不允许少于 5 行；每一行必须以一个目录、文件、或方法开头，优先以目录为开头。
- `边界` 章节不允许少于 10 行；不要求以文件开头。
- `链路` 章节必须把每一条真实链路拆成次级章节，内部只按调用顺序编写，不参与字典序排序。
- `规范` 章节不允许少于 10 行；不允许以文件开头。
- `陷阱` 章节不允许少于 5 行；不允许以文件开头。
- 除 `链路` 章节和其它明确表示顺序的章节外，同一章节内的同级条目必须按字典序排序。

### 更新边界

- 模块文档不得记录阶段任务完成情况。
- 模块文档不得为普通新增项追加清单式实现细节。
- 模块文档不得把测试计划、临时实现、候选设计或后续计划写入长期规范。
- 只有新增或修改内容改变模块长期规范时，才允许更新模块文档。
- 新增模块文档时，先在本文档中添加索引，再在对应模块文档中填写内容。

## 模块索引

- [应用启动与窗口挂载系统](modules/app-window-mounting.md)：说明前端入口如何按窗口类型挂载主窗口、编辑器窗口和文件编辑器窗口。
- [多窗口机制](modules/windowing.md)：说明 Tauri 多窗口的创建、单例化、聚焦和跨窗口事件边界。
- [工作区运行态与持久化系统](modules/workspace.md)：说明主窗口 workspace 运行态、启动恢复、自动保存和跨 store 活动状态同步。
- [目录打开与目录识别入口](modules/directory-opening.md)：说明用户选择文件夹后的目录识别、游戏概览打开结果和 Mod 打开结果。
- [ProjectSession / Manifest 缓存系统](modules/project-session.md)：追踪 ProjectSession 打开/关闭、query、write、cache invalidation 和 manifest 状态边界。
- [CSV 表格系统](modules/csv-tables.md)：追踪 CSV window query、CSV Table Draft Session、当前表 patch 保存、行身份、dirty 和详情动作边界。
- [CSV 草稿历史系统](modules/csv-edit-history.md)：说明未保存 CSV draft operation 的内存级 undo/redo 栈。
- [Draft Session 草稿会话系统](modules/draft-session.md)：说明前端编辑目标的 base/draft/dirty/pending external、目标身份和竞态保护状态机。
- [表格保存与关联 spec changeset 系统](modules/table-save-changeset.md)：说明 CSV 保存和关联 spec 动作如何组成一次文件级 changeset。
- [文件级 history / changeset 系统](modules/file-history.md)：说明 File History Session 如何记录已写盘文件 changeset、回放、刷新 session、同步窗口和提交 undo/redo 栈。
- [文件编辑器系统](modules/file-editor.md)：说明文本文件编辑器窗口、保存和文件历史接入。
- [配置系统](modules/config.md)：追踪 mod_info、阵营、任务、装配和皮肤的 ViewModel、entity query、write 和 history 边界。
- [舰船编辑器模块](modules/ship-editor.md)：追踪舰船 spec 独立窗口 ViewModel、entity query、资源加载、保存和同步。
- [武器编辑器模块](modules/weapon-editor.md)：追踪武器 spec 独立窗口 ViewModel、候选 source、资源加载、弹体和预览入口。
- [弹体编辑器模块](modules/projectile-editor.md)：追踪弹体 spec 独立窗口 ViewModel、entity query、保存和同步。
- [战术系统编辑器模块](modules/system-editor.md)：追踪战术系统 spec 独立窗口 ViewModel、entity query、type 条件区段、保存和同步。
- [发射预览模块](modules/weapon-preview.md)：说明武器发射预览窗口的读取和非保存边界。
- [舰船皮肤编辑模块](modules/skin-editor.md)：说明 `.skin` 列表、schema 表单、新建、保存和删除链路。
- [装配编辑模块](modules/variant-editor.md)：说明 `.variant` 列表、schema 表单、新建、保存和删除链路。
- [Schema 系统](modules/schema.md)：说明配置 schema、字段渲染、多来源字段和表单边界。
- [资源、贴图与原版资源回退系统](modules/assets-core-fallback.md)：追踪 ResourceRef、批量资源 query、resource cache、core fallback、上传和失效链路。
- [alex_csv 读取与写入 parser](modules/csv-parser.md)：说明 Starsector CSV-like parser 的读取、空行保留和写回规则。
- [alex_json 宽松 JSON parser](modules/json-parser.md)：说明 Starsector JSON-like 清洗、解析和错误边界。
- [Rust 文件 IO、路径校验与目录 changeset](modules/rust-file-io-changeset.md)：说明 Rust 文本 IO、路径安全、目录 changeset 和失败回滚。
- [主窗口历史命令分派机制](modules/main-history-command.md)：说明主窗口 Primary+Z / Primary+Shift+Z 在 CSV 草稿和文件历史之间的分派。
- [应用设置与主题机制](modules/app-settings.md)：说明 settings 运行态、持久化、主题 token、编辑模式和子窗口 settings 镜像。
- [应用反馈与日志入口机制](modules/app-feedback-log.md)：说明 AppFeedback、确认对话、错误文件入口、应用日志和配置维护动作。
- [性能计时与基线样本](modules/performance-baseline.md)：说明性能计时日志、基线样本和长期边界。
- [About 页面](modules/about-page.md)：说明 About 页面的 markdown 读取和渲染机制。
