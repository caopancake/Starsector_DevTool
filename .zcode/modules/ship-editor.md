# 舰船编辑器

## 定义

独立窗口以画布和表单编辑一个 `.ship` 规格。

## Owner 与链路

- ViewModel query ship bundle、资源与引用，维护目标 Draft Session；组件拥有画布交互/局部 UI；窗口服务拥有单例身份。
- 保存走 editor write -> changeset/File History -> ProjectSession refresh/事件；资源上传走资源正式链路。

## 不变量

- 只写 `.ship`，不直接改 ship CSV；几何、槽位、引擎和 shield 通过正式 spec/draft 规则更新。
- 编辑器内部显示和编辑 `.ship` 的 `hullName`；编辑器外的舰船显示名称必须优先使用 `ship_data.csv` 的 `name`，只有该名称缺失或为空时才允许使用 `.ship` 的 `hullName`。
- dirty 时外部更新不覆盖；画布不直读磁盘/IPC，不以数组下标或显示文本替代正式 ID。
- 画布镜像模式按空格开关，覆盖武器槽（含甲板）、引擎与碰撞边界；配对只按几何条件实时计算（武器槽=位置对称+size+type 相同，引擎=位置对称+长宽相同，碰撞顶点=位置对称），禁止按下标或 ID 记忆；镜像新增/调整/删除成对生效，中轴元素退化为单件；center/shield/半径类标量与检查器数值输入不参与镜像联动。
