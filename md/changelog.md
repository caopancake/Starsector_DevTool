# Starsector Mod 策划配置工具 — 开发日志

## 项目概述

为远行星号(Starsector) mod 开发的本地 Web 策划配置工具，支持 CSV 表格直编、舰船可视化编辑、武器编辑、弹道预览。放在任意 `mod/Tool/` 下即可使用。

---

## 一、0.97a → 0.98a 版本迁移 (2026-05-11)

### 背景
菲雅利帝国 mod 需要从 Starsector 0.97a-RC11 迁移到 0.98a-RC8。

### 改动清单

| 文件 | 改动 |
|------|------|
| `mod_info.json` | gameVersion → `"0.98a-RC8"` |
| `data/hulls/ship_data.csv` | 新增 9 列: c/s, c/f, f/s, f/f, crew/s, crew/f, logistics n/a reason, codex variant id, travel drive |
| `data/weapons/weapon_data.csv` | 新增 2 列: autofireAccBonus, extraArcForAI |
| `data/hulls/wing_data.csv` | 新增 1 列: attackPositionOffset |
| `data/shipsystems/ship_systems.csv` | 新增 2 列: isPhaseCloak, tags |
| `data/hullmods/hull_mods.csv` | 新增 1 列: sModDesc |
| `data/campaign/industries.csv` | 新增 1 列: disruptDanger |
| `data/campaign/special_items.csv` | 新增 2 列: tech/manufacturer, baseRaidDanger |
| `data/scripts/FairyEmpireModPlugin.java` | 清理 JD-Core 反编译注释 |
| `data/scripts/world/FairyEmpireGen.java` | 清理反编译注释 |

### 技术说明
- 所有新增列填空值，使用游戏默认值
- Java API (BaseModPlugin, SharedData, OnHitEffectPlugin 等) 在 0.98a 中未变化
- 现有 JAR 中的 .class (Java 7) 可在 0.98a 的 Java 17 JVM 上直接运行，无需重编译

---

## 二、Tool v1 — 静态 HTML 仪表盘 (2026-05-11)

### 架构
`build.py` 读取所有 CSV + .ship + .variant + 贴图 → 生成自包含的 `dashboard.html`

### 功能
- 5 个数据面板: 舰船/武器/舰载机/船插/产业
- 按阵营分组筛选（菲雅利/维格尔/卡厄斯）
- 表格排序/搜索
- 舰船插槽可视化 (Canvas 画武器槽位)
- 跨表关联跳转
- 导出 .ship JSON 下载

### 问题
- 数据只读，改了只能下载文件再手动替换
- 阵营硬编码
- 单文件 HTML 难以维护

---

## 三、Tool v2 — 本地服务器 + 直接读写 (2026-05-11)

### 架构变更
静态 HTML → Python 本地 HTTP 服务器 (端口 8266)

```
server.py  → REST API 服务器
app.html   → 前端单文件
```

### 核心改进
| v1 | v2 |
|----|----|
| 表格只读 | **Excel式直编**: 点击单元格即改值 |
| 导出下载 | **直写磁盘**: 保存按钮覆写 CSV / .ship |
| 无修改追踪 | 黄色高亮未保存修改 + 撤销按钮 |
| 只画武器槽 | **完整绘制**: 武器槽+引擎+护盾+碰撞边界+质量中心 |

### REST API 端点 (初版)
- `GET /api/data` — 加载所有 mod 数据
- `POST /api/save_csv` — 保存 CSV
- `POST /api/save_ship` — 保存 .ship 文件

---

## 四、舰船编辑器增强 (2026-05-11)

### 新增功能
1. **Undo/Redo** — Ctrl+Z/Y, 250 步快照栈
2. **选中控件缩放框** — 武器/引擎选中后显示虚线框 + 白色 handle，可拖拽调整大小
3. **编辑模式筛选** — 选中"武器"模式只显示武器，其他元素隐藏

### Canvas 可视化元素
| 元素 | 颜色 | 交互 |
|------|------|------|
| 武器插槽 | 类型色编码 (BALLISTIC=橙, ENERGY=蓝...) | 拖拽移动, handle 缩放 |
| 引擎 | 橙色矩形 | 拖拽移动, handle 调宽/长 |
| 护盾 | 青色虚线圆 + 8px 实心圆心 | 拖拽圆心, handle 调半径 |
| 质量中心 | 白色十字 + 外圈 | 拖拽改变 center |
| 碰撞边界 | 绿色多边形 | 拖拽顶点, 点边插入点 |

### 侧边栏 10 个区块
1. 船体属性 2. 贴图(文件上传) 3. 质量中心 4. 护盾发生器
5. 武器插槽 6. 引擎 7. 碰撞边界 8. 内置武器 9. 内置船插 10. 内置联队

---

## 五、通用化 — 去除硬编码 (2026-05-11)

### 改动
- **server.py**: 阵营从 `.faction` 文件自动发现（读取 id, displayName, color）
- **server.py**: mod 名称从 `mod_info.json` 读取
- **app.html**: 阵营按钮动态生成，标题动态设置
- **server.py**: 新增 `availableSprites` API，扫描 `graphics/ships/*.png`
- **table.js**: 表格列不再硬编码，从 CSV 表头动态生成（优先列靠前，其余追加）

### 效果
将 `Tool/` 文件夹复制到任意 mod 目录下即可使用，无需修改任何配置。

---

## 六、新建/删除行 + 从零建船 (2026-05-11)

### 新增 API
| 端点 | 功能 |
|------|------|
| `POST /api/add_csv_row` | 向 CSV 追加行 |
| `POST /api/delete_csv_row` | 从 CSV 删除行 (按 id 匹配) |
| `POST /api/delete_ship` | 删除 .ship 文件 |
| `POST /api/upload_sprite` | 上传 PNG 到 graphics/ships/ (支持覆盖确认) |

### 新建舰船流程
1. 点击"+ 新建" → 输入 ID
2. 自动在 CSV 追加行 + 创建默认 .ship 文件
3. 打开编辑器 → 上传贴图 → 自动设置 width/height/center
4. 添加武器槽/引擎/边界 → 保存

### 贴图上传流程
1. 点击"选择本地图片..." → 系统文件选择器
2. 选择 PNG → base64 上传到服务器
3. 服务器保存到 `graphics/ships/` + 同名检查
4. 自动应用到当前舰船 + 设置尺寸/中心

---

## 七、模块化重构 (2026-05-11)

### 背景
单文件 `app.html` 已达 1745 行，难以维护和 AI 协作。

### 新架构
```
Tool/
├── server.py              # API 服务器 + 静态文件服务
├── index.html             # 入口 (纯 HTML 骨架)
├── css/
│   └── style.css          # 全局样式
└── js/
    ├── utils.js           # 常量 + 工具函数
    ├── api.js             # 所有服务器通信
    ├── app.js             # 初始化 + 全局状态
    ├── table.js           # Excel式表格
    └── ship-editor.js     # 舰船编辑器
```

### 设计原则
- 纯全局函数，无 ES Module，`<script>` 按依赖顺序加载
- 每个文件职责单一，上下文小，利于 AI 单文件修改
- server.py 新增 `/css/*` 和 `/js/*` 静态文件路由

---

## 八、坐标系统修正 (2026-05-11)

### Starsector .ship 坐标系
- 贴图: 船朝 **上** (bow = 图片顶部)
- `center`: `[距左边距, 距上边距]` (像素)
- `locations[0]` = x+ = **前方** = 图片上方 = canvas -Y
- `locations[1]` = y+ = **左舷** = 图片左方 = canvas -X

### Canvas 映射公式
```javascript
canvasX = centerPixelX - loc[1] * scale   // y+ = 左 = -canvasX
canvasY = centerPixelY - loc[0] * scale   // x+ = 前 = -canvasY
```

### 武器弧度角度
- angle 0 = 前方 = 上 = canvas -π/2
- 正角度 = 逆时针 (ship space), 由于坐标镜像需要特殊处理

---

## 九、Debug 日志系统 (2026-05-12)

### 实现
```javascript
const DEBUG = true;
function dlog(...args) { if (DEBUG) console.log('[ShipEditor]', ...args); }
```

### 覆盖范围
- 编辑器打开: 打印 hullId, center, shieldCenter, shieldRadius
- 鼠标点击: 打印坐标 + 命中检测结果
- 拖拽: 打印目标值变化
- 操作: 打印新增/删除的元素

### 使用
浏览器 F12 → Console 查看。不需要时改 `DEBUG = false`。

---

## 十、质量中心/护盾拖拽修复 (2026-05-12)

### 问题
- 质量中心拖拽只移动画布平移，不改变 `center` 值
- 护盾中心点击区域 10px，太小
- 无视觉提示

### 修复
| 元素 | 视觉 | 点击区域 | 拖拽效果 |
|------|------|---------|---------|
| 质量中心 | 白色十字+外圈+"质量中心"标签 | 14px | 修改 `center[0/1]`, 贴图相应移动 |
| 护盾中心 | 青色实心大圆(8px)+"护盾中心"标签 | 14px | 修改 `shieldCenter[0/1]` |
| 护盾半径 | 白色方块 handle | 12px | 拖拽缩放 `shieldRadius` |

---

## 十一、武器编辑器 + 弹道编辑器 + 弹道预览 (2026-05-12)

### Starsector 武器三文件架构
```
weapon_data.csv (数值) → .wpn (外观/发射点) → .proj (弹道/导弹物理)
```

### 新增文件
| 文件 | 行数 | 功能 |
|------|------|------|
| `js/weapon-editor.js` | 834 | 武器 .wpn 可视化编辑 |
| `js/projectile-editor.js` | 375 | 弹道 .proj 属性编辑 |
| `js/ballistic-preview.js` | 751 | 弹道实时 Canvas 动画预览 |

### 新增 API
| 端点 | 功能 |
|------|------|
| `GET /api/wpn/{id}` | 读取 .wpn 文件 |
| `GET /api/proj/{id}` | 读取 .proj (mod 优先, 再查 starsector-core) |
| `POST /api/save_wpn` | 保存 .wpn 文件 |
| `POST /api/save_proj` | 保存 .proj 文件 |
| `GET /api/proj_list` | 列出所有弹道 ID (mod + core) |
| `GET /api/weapon_sprites` | 列出武器贴图路径 |

### starsector-core 自动检测
```python
STARSECTOR_ROOT = MOD_ROOT.parent.parent  # Tool/../../../
CORE_DIR = STARSECTOR_ROOT / "starsector-core"
```

### 武器编辑器功能
- Canvas 显示武器贴图 + 发射点标记 (可拖拽)
- 炮台/固定视图切换
- 侧边栏: 基础属性、贴图(8个)、发射点(增删炮管)、动画、弹道、光束(RGBA颜色)、音效
- 无 .wpn 文件的武器自动创建默认模板
- Undo/Redo + 直接保存

### 弹道编辑器功能
- 弹丸模式: 外观/颜色/碰撞
- 导弹模式: 物理参数(加速/转向) + 引擎槽位 + 爆炸效果
- 直接保存 .proj 文件

### 弹道预览功能
- **弹道武器**: 弹丸从发射点飞向射程标记，模拟连射/散布
- **光束武器**: 双层颜色光束 + 充能动画 + 纹理滚动
- **导弹武器**: 物理模拟轨迹 + 引擎尾焰 + 爆炸
- 控制: 暂停/播放、速度 0.25x~4x、重置

### 数据覆盖情况
| 数据 | 数量 | 来源 |
|------|------|------|
| CSV 武器 | 122 | weapon_data.csv |
| .wpn 文件 | 19 | mod data/weapons/ |
| .proj 文件 | 71 | mod 15 + core 56 |
| 武器贴图 | 186 | mod graphics/ |

---

## 十二、端口占用问题修复 (2026-05-12)

### 问题
旧 server.py 进程未退出占用 8266 端口，新进程静默绑定失败，浏览器连到旧进程。

### 修复
```python
# 启动时检测端口占用
sock.bind(("127.0.0.1", PORT))  # 失败则报错退出
```
打印明确错误信息 + kill 命令提示。

---

## 最终文件结构 (2026-05-12)

```
Tool/
├── server.py              (649行) API 服务器
├── index.html             (139行) 入口 + 4 个 Modal
├── css/
│   └── style.css          (128行) 全局样式
├── js/
│   ├── utils.js            (54行) 常量 + 工具函数
│   ├── api.js             (306行) 全部 API 通信
│   ├── app.js              (83行) 初始化 + 全局状态
│   ├── table.js           (148行) Excel式表格
│   ├── ship-editor.js     (970行) 舰船编辑器
│   ├── weapon-editor.js   (834行) 武器编辑器
│   ├── projectile-editor.js(375行) 弹道编辑器
│   └── ballistic-preview.js(751行) 弹道预览
└── md/
    └── changelog.md        本文档
```

**总计: ~4437 行代码, 12 个源文件**
