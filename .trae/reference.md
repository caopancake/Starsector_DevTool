# Reference

本文档存放尚未实现的目标、候选设计和参考资料。当前已实现模块和调用链见 `.trae/module-map.md`。

## Blueprint System Reference

可视化逻辑编辑器目标：将 Starsector 模板化 Java 模块抽象为节点图，覆盖 Ship System、Bar Event、Mission、rules.csv 对话等常见场景。

### Candidate Directory Layout

- `src/features/blueprint/`：蓝图编辑器 feature 模块。
- `src/features/blueprint/blueprint.store.ts`：蓝图状态管理（节点、连线、选择、历史）。
- `src/features/blueprint/blueprint.service.ts`：序列化、反序列化和代码生成调用。
- `src/features/blueprint/components/BlueprintCanvas.vue`：节点画布。
- `src/features/blueprint/components/NodePalette.vue`：节点面板。
- `src/features/blueprint/components/NodeInspector.vue`：节点属性检查器。
- `src/features/blueprint/components/DialogueFlowEditor.vue`：对话流专用编辑器。
- `src/features/blueprint/components/TemplateWizard.vue`：模板向导容器。
- `src/features/blueprint/lib/`：节点类型、端口类型和代码生成模板。
- `src/features/blueprint/lib/nodes/`：节点注册表。
- `src-tauri/src/services/codegen/`：Java 代码生成 service。
- `src-tauri/src/services/codegen/templates/`：`.java` 模板文件。
- `blueprints/`：随工具分发的节点库定义 JSON。

### Community Library Targets

| 库          | 集成范围                                                                | 节点化目标                   |
| ----------- | ----------------------------------------------------------------------- | ---------------------------- |
| MagicLib    | MagicRender 粒子/光束/拖尾、MagicBarEvent JSON 对话、MagicCampaign 工具 | 视觉效果节点 + 对话导出格式  |
| GraphicsLib | ShaderAPI 光照/泛光/扭曲/涟漪后处理                                     | 视觉效果节点（着色器参数化） |
| LazyLib     | MathUtils/CollisionUtils/CombatUtils/WeaponUtils                        | 条件/计算工具节点            |
| LunaLib     | LunaSettings 运行时配置面板、LunaCombatPlugin 钩子                      | 配置绑定节点 + 向导选项      |
| BoxUtil     | BoxCollider 区域判定/范围计算/碰撞检测                                  | 空间判定节点                 |

### Code Generation Notes

- 生成的 Java 必须兼容 Starsector 运行时约束，默认按 JDK 7 目标处理。
- 生成代码应保持可读：缩进稳定、import 整理、必要注释清晰。
- 蓝图元数据保存为 `.blueprint.json`，与生成的 `.java` 并存。
- 支持从蓝图重新生成，也允许用户脱离蓝图手动维护生成代码。
- 节点库注册表采用 JSON Schema 描述，允许社区扩展。

## Community Library Data Integration Reference

目标：将 MagicLib / GraphicsLib / LunaLib 等社区核心库的数据配置文件纳入工具编辑范围。该方向聚焦纯数据配置文件，与蓝图系统的 Java 生成互补。

### Candidate Embedding Strategy

| 库文件                                         | 可复用组件                     | 备注                        |
| ---------------------------------------------- | ------------------------------ | --------------------------- |
| `data/config/modSettings.json` (MagicLib)      | JsonFieldEditor                | 扩展扫描范围                |
| `data/config/magicBounty_data.json` (MagicLib) | SchemaFormRenderer + 列表编辑  | 新建 schema + 列表视图      |
| `data/lights/light_data.csv` (GraphicsLib)     | MissionView 或 CSV 表格        | 扩展 CSV 扫描范围           |
| `data/lights/texture_data.csv` (GraphicsLib)   | MissionView 或 CSV 表格        | path-image 列适合富编辑     |
| `ship_systems.csv` (原版)                      | 主表格模块                     | `CSV_TABLES` 可新增系统入口 |
| `.system` JSON 文件 (原版)                     | SchemaFormRenderer + JSON 编辑 | 可新建 ship-system schema   |
| LunaSettings JSON (LunaLib)                    | JsonFieldEditor                | 扩展扫描范围                |

### Dependency Detection Notes

- 读取 Mod 的 `mod_info.json` 中 `dependencies` 数组。
- 检测到 `magiclib` 依赖时，暴露 MagicLib 相关编辑入口。
- 检测到 `shaderLib` 依赖时，暴露 GraphicsLib 相关编辑入口。
- 检测到 `lunalib` 依赖时，暴露 LunaLib 相关编辑入口。
- 无对应依赖时，相关入口隐藏，不报错、不占空间。

### Candidate Schema Files

- `schemas/ship-system.schema.json`：`.system` 文件字段定义。
- `schemas/magic-bounty.schema.json`：`magicBounty_data.json` 条目字段定义。
- `schemas/csv/ship_systems.columns.json`：`ship_systems.csv` 列类型注解。
- `schemas/csv/light_data.columns.json`：GraphicsLib `light_data.csv` 列类型注解。
- `schemas/csv/texture_data.columns.json`：GraphicsLib `texture_data.csv` 列类型注解。
