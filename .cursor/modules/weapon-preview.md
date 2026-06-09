# 发射预览模块

## 定义

发射预览模块是在独立窗口中消费武器、弹体、CSV 行和贴图数据来运行只读发射模拟的画布模块。

## 参考

- `src/app/EditorWindowContent.vue`：按 `kind=weapon-preview` 挂载发射预览组件，并把 ViewModel 的 weapon preview bundle 转为组件输入。
- `src/app/components/editors/WeaponFirePreview.vue`：拥有预览画布、播放状态、开火状态、barrel 轮转、sprite Image 和本地模拟对象。
- `src/app/composables/use-editor-window-view-model.ts`：拥有预览窗口 entity query、跨窗口 spec 同步、session invalidation 和派生数据刷新。
- `src/domain/editors/lib/weapon-sprite-fields.ts`：定义预览可消费的武器贴图字段、视图模式和绘制顺序。
- `src/services/editor.service.ts`：拥有 `WeaponPreviewEntityBundle` 查询、weapon/csv/projectile/resource 组装和资源刷新入口。
- `src/services/query-cache.service.ts`：拥有 entity、projectile 和 resource query 的路径失效判定。
- `src/services/resource-cache.service.ts`：拥有 `ResourceRef` 到 data URL 的批量查询缓存。
- `src/windows/editor.window.ts`：按 `weapon-preview + modRoot + weaponId` 单例化预览窗口。
- `src-tauri/src/services/project/query/entities.rs`：拥有武器 entity 的 CSV 注册边界、`.wpn` 组装和 projectile entity 读取。
- `src-tauri/src/services/project/query/resources.rs`：拥有资源 data URL 批量读取和返回顺序。
- `src-tauri/src/services/project/resources_shared.rs`：拥有武器 sprite 字段到 `ResourceRef` 的映射和 Mod/Core 资源读取语义。

## 边界

- ProjectSession 是预览数据的只读来源，预览窗口不能读取主窗口当前表格草稿或编辑器未保存草稿。
- Rust entity query 拥有 weapon CSV 注册边界；未注册 `.wpn` 不能作为可预览 weapon entity。
- Rust resource query 拥有 sprite 路径校验、Core 回退和 data URL 构造，前端不能拼接资源文件路径。
- `ResourceRef` 只能来自后端 entity query，预览窗口不能自行构造资源身份。
- `WeaponFirePreview` 只拥有 canvas 模拟状态，不拥有 `.wpn`、CSV、projectile 或资源缓存。
- `WeaponFirePreview` 只能 emit `close`，不能 emit 保存、上传、history 或 session invalidation 事件。
- `WeaponPreviewEntityBundle` 只包含预览所需 weapon spec、weapon CSV row、已加载 projectile specs、resource refs 和 sprite data URL。
- `modRoot + sessionId + weaponId` 是预览窗口 query、缓存刷新和跨窗口 spec 同步的身份边界。
- 发射预览不拥有文件级 history、changeset、CSV patch、sprite upload 或 editor spec save。
- 发射预览入口只能打开只读 `weapon-preview` 窗口，不能复用武器编辑器窗口的本地 draft。
- 武器贴图 data URL 刷新由 ViewModel 和 resource cache 负责，组件只把 data URL 加载为 `Image` 并绘制。
- 弹体 spec 只读取 `.wpn.projectileSpecId` 指向的已存在 projectile entity，缺失时保持空 projectile 输入。

## 链路

### 从武器编辑器打开预览

1. 用户在武器编辑器点击发射预览入口。
2. `WeaponEditor` emit `preview`，payload 为当前 weapon ID。
3. `EditorWindowContent` 接收事件并调用 `openWeaponPreviewWindow()`。
4. 窗口管理按 `weapon-preview + modRoot + weaponId` 单例化窗口。
5. 新窗口 URL 携带 `window=editor + kind=weapon-preview + sessionId + modRoot + id + settings + starsectorRoot`。
6. 新窗口挂载 `EditorWindowContent`。
7. `EditorWindowContent` 创建 `useEditorWindowViewModel({ kind: 'weapon-preview' })`。

### 查询预览数据

1. ViewModel 调用 `queryEditorEntityBundle(sessionId, 'weapon-preview', weaponId)`。
2. editor service 调用 `querySessionEntity(sessionId, 'weapon', weaponId)`。
3. Rust entity query 确保 weapons CSV 行已加载，并按注册 CSV 行查找 weapon ID。
4. Rust entity query 将 `.wpn` spec 与 weapon CSV row 组装为 weapon entity。
5. Rust entity query 从 `.wpn` sprite 字段生成 weapon `ResourceRef` 集合。
6. editor service 校验 entity 的 `spec` 与 `csvRow` 都是对象。
7. editor service 读取 `.wpn.projectileSpecId`。
8. editor service 在 projectile ID 存在时调用 `querySessionEntity(sessionId, 'projectile', projectileId)`。
9. editor service 只把存在的 projectile entity 放入 `projectileSpecs`。
10. editor service 调用资源批量缓存读取 weapon sprite data URL。
11. Rust resource query 按 `ResourceRef` 顺序加载 Mod 或 Core 回退资源并返回 data URL。
12. ViewModel 保存 `WeaponPreviewEntityBundle`。
13. `EditorWindowContent` 将 weapon spec、weapon CSV row、projectile specs 和 sprite data 传给 `WeaponFirePreview`。

### 运行预览模拟

1. `WeaponFirePreview` 根据 props 建立 computed 参数。
2. 组件根据 `.wpn.specClass` 选择 projectile 或 beam 更新路径。
3. 组件根据当前视图读取 turret 或 hardpoint offsets 与 angle offsets。
4. 组件按 weapon sprite draw order 将 data URL 加载为 Image 并绘制。
5. 用户点击开火后，组件只更新本地 `firing`、timer、beam 或 projectile 运行态。
6. projectile 模式按 barrelMode 使用全部 barrel 或当前 barrel 生成本地 projectile 状态。
7. beam 模式按 chargeup、burst、chargedown、beamSpeed 和颜色参数更新本地 beam 状态。
8. animation frame 按播放速度推进本地模拟并重绘 canvas。
9. 用户切换炮塔/固定视图时，组件重置本地 viewMode 并重绘。
10. 用户关闭窗口时只关闭当前预览窗口。

### 保存事件同步

1. 预览窗口监听 `editor-spec-saved`。
2. 保存事件的 `sessionId + modRoot` 必须匹配当前预览窗口身份。
3. 当保存事件是当前 weapon ID 的 weapon spec 时，ViewModel 更新 bundle 的 weapon spec。
4. 当保存事件是当前 bundle 已加载 projectile ID 的 projectile spec 时，ViewModel 只更新对应 `projectileSpecs[id]`。
5. 其它 spec 保存事件不影响当前预览窗口。
6. `WeaponFirePreview` 通过 props 更新重新计算预览参数。

### Session 失效同步

1. 预览窗口监听 `project-session-invalidated`。
2. session invalidation 事件的 `sessionId + modRoot` 必须匹配当前预览窗口身份。
3. ViewModel 将 invalidation 应用到本地 resource cache 与 query cache。
4. query cache 失效命中当前 weapon entity detail 时，ViewModel 静默重新查询完整 preview bundle。
5. query cache 失效命中已加载 projectile detail 时，ViewModel 只刷新当前 bundle 的 projectile specs。
6. resource cache 失效命中当前 weapon resource refs 时，ViewModel 只刷新 sprite data URL。
7. 失效未命中当前 weapon、已加载 projectile 或当前 resource 时，预览窗口不刷新。

## 规范

- barrel 索引无效时必须返回空结果，不能夹取到其它 barrel。
- CSV 行缺失时不能构造预览数据；只有注册 weapon entity 才能打开预览。
- `.wpn` 缺失但 weapon CSV 行存在时，预览可以使用默认 weapon spec 形状运行只读预览。
- `projectileSpecId` 缺失或 projectile entity 不存在时，`projectileSpecs` 必须为空对象。
- `weapon-preview` 不是 `EditorSpecKind`，不能进入导入、新建或保存 spec 链路。
- 发射预览不记录 file history，不调用 write service，不生成 changeset。
- 发射预览窗口必须按 `weapon-preview + modRoot + weaponId` 单例化。
- 发射预览只能消费 ViewModel 传入的 props，不能直接调用 query service、resource service 或 shared API。
- 发射预览中 sprite data URL 缺失时只能跳过对应 sprite 绘制，不能请求单项资源补图。
- 跨窗口 spec 保存同步只能更新当前 bundle 中已有 ownership 的 weapon 或 projectile 数据。
- 缓存失效刷新必须按 query 类型拆分：weapon entity 重查 bundle，projectile detail 刷新已加载 projectile specs，resource 刷新 sprite data URL。
- 预览 canvas 状态是窗口运行态，关闭窗口即丢弃，不持久化、不跨 Mod 复用。
- 预览组件不能读取或写入 weapon 编辑器的本地 draft、undo/redo、sprite upload 状态。
- 预览加载失败只影响当前预览窗口，不能影响主窗口 project store 或其它编辑器窗口。

## 陷阱

- 把预览窗口接入 `save-requested` 或 `editor-spec-saved` 发送端，会让只读模拟污染文件级保存链路。
- 从武器编辑器本地草稿打开预览，会把未保存状态当成 ProjectSession 权威数据。
- 在 projectile 缺失时构造默认 projectile，会掩盖 `.wpn.projectileSpecId` 或弹体文件错误。
- 用前端字符串拼接 sprite 路径直接读图，会绕过 Rust 的路径校验和 Core 回退语义。
- 资源失效后重查完整 preview bundle，会把贴图刷新误扩大为 weapon/projectile 数据刷新。
- projectile 保存事件更新所有 projectileSpecs，会把当前 `.wpn` 未引用的弹体注入预览输入。
- barrel 索引越界时夹取最后一个发射点，会让发射模拟显示错误的武器结构。
