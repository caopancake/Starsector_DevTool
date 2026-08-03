# 武器发射预览

## 定义

单例只读窗口，基于已保存的武器/关联弹体 bundle 模拟发射。

## Owner 与链路

- `weapon-preview + modRoot + id` 定位窗口；ViewModel query preview bundle 和资源，组件拥有 canvas、时间与播放控制。
- ProjectSession invalidation 按当前 bundle 实际依赖细粒度刷新；窗口不发保存事件。

## 不变量

- 不读取/写入武器 editor draft、history 或上传状态；缺 projectile 是错误，不构造默认值。
- 资源路径仅由后端 ResourceRef；barrel 越界报/跳过，不夹取其它发射点；无关资源失效不重查完整 bundle。
