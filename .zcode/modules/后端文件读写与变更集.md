# 后端文件读写与变更集

## 定义

提供 UTF-8 文本 IO、canonical 路径边界与可回放的文件/目录 changeset。

## Owner 与链路

- IO 统一读取/写入、canonical root/父链检查、快照、changeset 构建与 replay；service 在正式保存入口调用。
- 写/删前快照，成功后返回 `FileChangeRecord` 与展开后的 invalidation paths；ProjectSession 以该记录中的前后文本和目录快照推导精确失效；回放同样先验证。

## 不变量

- 拒绝 `..`、root 外路径及任一已有父链 symlink/junction/reparse point；读、遍历、写、删、回放复用规则。
- 文件 UTF-8 无 BOM/CRLF；目录必须正式目录事件，失败返回上下文且不让前端递归拼路径。
