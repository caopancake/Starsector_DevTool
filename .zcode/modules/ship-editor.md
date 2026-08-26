# 舰船编辑器

## 定义

独立窗口以画布和表单编辑一个 `.ship` 规格。

## Owner 与链路

- ViewModel query ship bundle、资源与引用，维护目标 Draft Session；组件拥有画布交互/局部 UI；窗口服务拥有单例身份。
- 保存走 editor write -> changeset/File History -> ProjectSession refresh/事件；资源上传走资源正式链路。

## 不变量

- 只写 `.ship`，不直接改 ship CSV；几何、槽位、引擎和 shield 通过正式 spec/draft 规则更新。
- dirty 时外部更新不覆盖；画布不直读磁盘/IPC，不以数组下标或显示文本替代正式 ID。
