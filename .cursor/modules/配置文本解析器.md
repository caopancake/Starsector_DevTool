# 配置文本解析器

## 定义

解析/渲染 Starsector JSON-like 文本，处理其允许的宽松语法而不拥有文件 IO。

## Owner 与链路

- IO 提供 UTF-8 文本和路径上下文；parser 负责清洗、解析、pretty render 与格式错误；service 决定业务对象、路径、changeset。

## 不变量

- 不把缺失文件、路径验证、资源解析或写盘塞进 parser；错误保留 path/位置上下文。
- 宽松兼容只限正式 Starsector 格式规则；不静默吞掉结构错误，不用字符串替换绕过 parser 保存。
