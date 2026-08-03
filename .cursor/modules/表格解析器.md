# 表格解析器

## 定义

把已读取的 Starsector CSV-like 字节解析为表头/行，并把已净化行按表头渲染为 CSV 文本。

## Owner 与链路

- IO 拥有路径、UTF-8 BOM、缺失文件；parser 仅 bytes/path label <-> `CsvTable`/文本；cache 拥有 rowKey、运行时字段与懒加载；write service 拥有 patch、changeset 和 invalidation。
- query：IO -> parser -> cache 注入 rowKey/faction -> window/source/entity 消费。保存：patch 去 `_rowKey` -> service 合成 -> parser render -> changeset -> rowKey map。

## 不变量

- 保留可见空行、全逗号行、`#` 行和 quoted CRLF；短 hash 行补齐，非 hash 宽度错误拒绝，EOF 未闭合引号报 path/行上下文。
- parser 不识别业务表、不写盘、不生成 rowKey/ResourceRef/运行时字段；render 仅 header 列，绝不写 `_rowKey/_faction`。
