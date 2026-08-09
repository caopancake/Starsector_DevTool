# 参考设计（候选，非现状）

已实现边界以 `module-map.md` 和源代码为准；本文件内容不可直接当作实现授权。

## 蓝图系统

- 目标：把模板化 Java 模块（Ship System、Bar Event、Mission、rules.csv 对话）表达为节点图并生成 JDK 7 兼容 Java；元数据与生成的 `.java` 并存为 `.blueprint.json`，允许脱离蓝图维护。
- 候选前端：`src/app/components/blueprint/`（Canvas、Palette、Inspector、Dialogue Flow、Wizard）、`blueprint.store.ts`、`blueprint.service.ts`、`src/domain/blueprint/lib/`（节点/端口/模板）。
- 候选后端/分发：`src-tauri/src/services/codegen/`（含 Java template）、`blueprints/`（JSON Schema 节点库）；生成结果需可读、稳定缩进/import、必要注释。
- 参考集成：MagicLib（视觉/对话）、GraphicsLib（shader）、LazyLib（计算）、LunaLib（设置/钩子）、BoxUtil（空间判定）。

## 社区数据配置

- 候选编辑范围：MagicLib `modSettings.json`、`magicBounty_data.json`；GraphicsLib `light_data.csv/texture_data.csv`；原版 `ship_systems.csv/.system`；LunaSettings JSON。
- 入口由 `mod_info.json.dependencies` 探测：`magiclib`、`shaderLib`、`lunalib`；未声明依赖时隐藏入口，不报错也不占位。
- 候选 schema：`ship-system`、`magic-bounty`、`ship_systems.columns`、`light_data.columns`、`texture_data.columns`。实现前必须建立正式 module contract。
