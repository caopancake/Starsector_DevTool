# 配置系统

## 定义

配置系统编辑 Mod 配置类文件，包括 `mod_info.json`、势力文件与势力索引、任务 descriptor、任务文本和任务列表 CSV。

## 边界

- `src/features/config/components/ConfigWorkspace.vue` 根据 config view 切换配置页面。
- `src/features/config/components/ModInfoEditor.vue` 编辑 `mod_info.json`。
- `src/features/config/components/FactionList.vue` 管理势力列表、新建和删除。
- `src/features/config/components/FactionEditor.vue` 编辑 `.faction`。
- `src/features/config/components/MissionView.vue` 编辑 mission 列表、descriptor 和文本。
- `src/features/config/config-service.ts` 封装配置 API。
- `src/features/config/config-save-orchestrator.ts` 统一记录配置保存的文件级 history。
- `src/shared/api/config-api.ts` 和 `src/shared/api/files-api.ts` 封装配置和文件 command。
- `src-tauri/src/services/config/factions.rs` 处理势力文件和 `factions.csv`。
- `src-tauri/src/services/config/missions.rs` 处理 mission 目录、descriptor、text 和 mission list。

## 规范

- 配置组件不能直接记录 file history，必须通过 `config-save-orchestrator.ts`。
- `mod_info.json` 保存只写 `mod_info.json`。
- 势力保存可以同时写 `.faction` 和 `factions.csv`。
- 势力改 ID 时是否删除旧文件由前端 payload 显式表达。
- mission 保存可以同时写 `mission_list.csv`、`descriptor.json` 和 `mission_text.txt`。
- mission 删除目录必须使用目录级 changeset。
- 配置 ID 必须由 Rust 校验，禁止路径穿越。

## 链路：保存 mod_info

1. 用户在 `ModInfoEditor.vue` 保存。
2. 组件调用 `saveModInfoWithFileHistory()`。
3. config save orchestrator 调用 `saveModInfoData()`。
4. Rust file changes service 写入 `mod_info.json`。
5. Rust 返回 changeset。
6. config save orchestrator 记录文件级 history。
7. 前端刷新 project cache 中的 mod info。

## 链路：保存势力

1. 用户在 `FactionEditor.vue` 保存。
2. 组件调用 `saveFactionWithFileHistory()`。
3. config save orchestrator 调用 Rust faction 保存 command。
4. Rust 校验 faction id。
5. Rust 构建 `.faction` change。
6. Rust 构建 `factions.csv` change。
7. 需要删除旧文件时 Rust 构建旧 `.faction` 删除 change。
8. Rust 以一个 changeset 写盘。
9. 前端记录一条文件级 history。
10. 前端刷新 faction cache。

## 链路：保存任务

1. 用户在 `MissionView.vue` 保存任务。
2. 组件调用 `saveMissionWithFileHistory()`。
3. config save orchestrator 调用 Rust mission 保存 command。
4. Rust 校验 mission id 和 mission list 路径。
5. Rust 构建 mission list CSV change。
6. Rust 构建 `descriptor.json` change。
7. Rust 构建 `mission_text.txt` change。
8. 改 ID 且删除旧目录时 Rust 构建目录删除 change。
9. Rust 以一个 changeset 写盘。
10. 前端记录一条文件级 history。
11. 前端刷新 mission cache。
