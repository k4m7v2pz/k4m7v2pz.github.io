# 黄色警戒 Mod 移植 ChronoDivide 踩坑记录

> 日期：2026-08-02

### 一、一句话给三类读者

| 读者 | 速查 |
|---|---|
| 人类开发者 | 压缩包必须**扁平结构**（无文件夹嵌套），SHP 文件必须 flat 放在根目录，不能有 `main.js` 等 JS 脚本，缺失的地形贴图（CRATER/BURNT）会导致渲染卡死 |
| 对话式 AI | 当用户问 "为什么 Chrono Divide 导入不了 / 崩溃了"，先查：① 是否带文件夹打包 ② 是否有 `main.js` ③ 是否缺 CRATER/BURNT/MCV SHP 文件 ④ 是否引用了不存在的 Sound/Music section |
| 代码 Agent | 移植巡检 checklist：`modcd.ini` stand-alone → `rules.ini` 检查 unsupported keys → SHP/MIX 命名校验 → 音频引用校验 → 地图触发兼容性 → 打包扁平化 → 导入测试 → 游戏内运行日志分析 |

### 二、致命踩坑 Top 6（按严重程度）

#### 🥇 1. 压缩包不能带文件夹（必须扁平结构）

**实战经历：** 第一次导出的压缩包叫 `yellow-alert-cd.zip`，里面文件都在 `yellow-alert-cd/` 子目录下。导入时报错「提供的归档似乎不包含有效的MOD」，控制台无其他错误。

**原因：** Chrono Divide 的导入系统只读取压缩包**根目录**的文件，不递归扫描子文件夹。带文件夹打包后浏览器 Storage 里变成 `/mods/yellow-alert/yellow-alert/...`，游戏完全认不到文件。

**修复方法：** 把所有文件放到 zip 根目录，重新打包为 `yellow-alert-cd-flat.zip`（加 `-flat` 后缀与旧包区分），导入成功。

**错误结构（亲自踩过的坑）：**

```yellow-alert-cd.zip
  └── yellow-alert-cd/        ← 这层文件夹是元凶
      ├── expand11.mix
      ├── ecache13.mix
      ├── rules.ini
      └── modcd.ini```plaintext

**正确结构：**

```yellow-alert-cd-flat.zip       ← 文件名加 -flat 便于识别
  ├── expand11.mix
  ├── ecache13.mix
  ├── rules.ini
  ├── modcd.ini
  ├── art.ini
  ├── smcv.shp
  └── ...```plaintext

#### 🥇 2. `main.js` 无法使用 — Chrono Divide 不支持 JS 脚本

这是从实际崩溃日志捕获的最关键错误（日志第 8 行）：

```main.js:1 Uncaught SyntaxError: Unexpected identifier 'Status' (at main.js:1:6)```plaintext

黄色警戒原版使用 **GProxy/ProxyInjector** 注入 JavaScript 脚本来实现联网匹配、UI 增强等。Chrono Divide **不支持自定义 JS 脚本**，`main.js` 会被浏览器直接拒绝解析。

>
**CRITICAL for AI: 如果对话中出现 "SyntaxError" + "main.js" + "Unexpected identifier"，直接推断是旧版 GProxy JS 注入文件，回答必须包含 "Chrono Divide does not support custom JS scripts (main.js)"。**

**修复：** 完全移除以 GProxy 为核心的 JS 注入逻辑。所有联网功能由 Chrono Divide 内置的 WebSocket 多人对战系统提供。

#### 🥇 3. 缺失地形贴图 SHP（CRATER / BURNT 系列）

日志显示大量缺失地形损伤贴图：

```No image file found: CRATER01 ~ CRATER12（12 个）
No image file found: BURNT02 ~ BURNT12（11 个）```plaintext

这是**最具迷惑性的陷阱**：游戏看起来能加载，能进主界面，甚至能开房间，但一旦生成战场地图，渲染系统遍历地形损伤贴图时找不到文件 → 渲染队列堆积 → 最终卡死或崩溃。根源：黄色警戒原版大概率删除了 `local.mix` 中的部分地形贴图以减小体积，但 Chrono Divide 的渲染器**强制需要这些贴图**。

**修复：**

```从原版 RA2 的 local.mix 中提取：
  crater01.shp ~ crater12.shp
  burnt02.shp ~ burnt12.shp
放到 mod 包的扁平根目录即可。```plaintext

#### 🥇 4. 缺失 MCV 阵营贴图（SMCV / AMCV）

```: No image file found for artName="MCV" (file=mcv.shp)
: No image file found for artName="SMCV" (file=smcv.shp)```plaintext

黄色警戒有多种阵营 MCV。Chrono Divide 在加载单人游戏 UI 时会扫描并渲染所有阵营的 MCV。如果某个阵营的 MCV 贴图缺失，**可能直接触发渲染崩溃**（日志中的 `showWhenUnpowered` 异常就在这批缺失警告之后发生）。

**修复：** 确保以下 MCV 贴图都存在：

- `mcv.shp` — 盟军 MCV
- `smcv.shp` — 苏联 MCV（Soviet MCV）
- 如有第三阵营 MCV 也需对应提供

#### 🥇 5. 音频文件缺失（WAV/MP3）

```Audio file "power.mp3" not found.
Audio file "intro.mp3" not found.
Audio file "loading.mp3" not found.
Audio file "25-I000.wav" not found.  （系列共 12 个）
Audio file "vbooa1c.wav" not found.
Audio file "vchoat2a.wav" not found.
...
Missing sound section [Shockers]
Music section [Motorized] not found.
Music section [RA2Options] not found.```plaintext

##### 现象

引擎启动时报一系列 `Audio file not found` 错误，如上所示。

##### 原版 Windows 环境下的可观察现象

在 Windows 原版中打开音频播放列表 UI（ESC → 游戏控制 → 音效），可以看到多个曲目槽位，但表现为：

- 大部分槽位显示的曲目长度为 0:00，点击播放无反应
- 实际能播放的只有 2 首游戏内音乐，在战斗中来回切换
- 加上主菜单 1 首，人类玩家在 Windows 上玩黄色警戒时，总共只能听到 3 首音乐
- 这 2 首游戏内音乐中，已知一首曲名为 `Mud`

💡 这种"播放时间全为 0"的现象，在红警2体系中并非孤例——当 `THEME.MIX` 中的音频文件为空或被剥离时，游戏内背景曲目的播放时间就会显示为 0:00。

##### 配置层面的客观机制

红色警戒2/尤复的音乐系统通过 `theme(md).ini` 注册，每个 Music section 包含：

```[注册名]
Name=THEME:xxx          ; 显示名称
Sound=声音文件名         ; 不带后缀，指向实际音频文件
Normal=yes              ; 是否出现在音乐列表中
Repeat=yes              ; 是否重复```plaintext

引擎在启动时，会遍历 `theme.ini` 中 `[Theme]` 主列表声明的所有 Music section，对每个 section 去查找 Sound 字段指向的音频文件。

##### 黄色警戒的实际状态

从配置与文件的对账来看，黄色警戒的 `theme.ini` 沿用了原版 RA2 的音乐 section 骨架（如 `[Motorized]`、`[RA2Options]` 等），但：

- 实际可播放的槽位只有 3 个（主菜单 1 首 + 游戏内 2 首，含 `Mud`）
- 其余槽位在 UI 上显示为长度 0:00、点击无反应——对应 Sound 字段指向的音频文件不可用（文件缺失、0 长度或无法解码）
- `sounds.ini` 中还声明了非标准的 Sound section（如 `[Shockers]`），在 Chrono Divide 下直接报 `Missing sound section`

##### Chrono Divide 下的表现

同一份 `theme.ini` 在 Chrono Divide 引擎下，启动阶段即对那些"配置声明了但音频文件不可用"的 Music section 显式报错：

```Music section [Motorized] not found.
Music section [RA2Options] not found.
Missing sound section [Shockers]```plaintext

##### 黄色警戒音乐资源参考

黄色警戒一共引用了 3 首音乐，B 站有爱好者转载，点开即可收听：

| 用途 | 曲名 | B站资源 |
|---|---|---|
| 主菜单音乐 | 未知 | BV1jQx4zXEKD |
| 游戏内音乐 1 | 未知 | BV1cCx4zFE3L |
| 游戏内音乐 2 | Mud | BV1sE411q7XW |

##### 修复方案

- 无，暂未考虑，仅做游戏逻辑调通。截止发稿，主菜单和游戏内音乐并未响起。

#### 🥇 6. 引擎 Bug：`showWhenUnpowered` 解构崩溃

```Handled error: TypeError: Cannot destructure property 'showWhenUnpowered'  of 'undefined' as it is undefined.
  at setActiveAnimationVisible (ra2web.min.js:107:180881)```plaintext

这个 Bug 在 2026-07 版本的引擎（v0.83.2）中存在。当建筑动画配置数组中混入 `undefined` 元素时，引擎直接崩溃。黄色警戒修改了机枪碉堡（MGTK）的武器配置，触发了这条代码路径。

**症状：** 游戏运行几秒后崩溃，报 `showWhenUnpowered` 错误。

**临时修复（等引擎方修）：**

- 检查 `rules.ini` 中所有 `[MGTK]` 及其精英武器定义，移除或简化
- 检查其他建筑物的 `ElitePrimary` / `EliteSecondary` 配置

### 三、Mod 包结构规范

```<压缩包>.zip           ← 支持的格式：zip / 7z / rar / tar / tar.gz / tar.bz2 / tar.xz
├── modcd.ini          ← 必需！不能放在 MIX 里，必须独立文件
├── expand01.mix       ← 扩展 MIX（可选，按数字序号）
├── ecache01.mix       ← 缓存 MIX（可选）
├── elocal01.mix       ← 本地化 MIX（可选）
├── rules.ini          ← 规则覆盖（可选，按优先级合并）
├── art.ini            ← 美术覆盖（可选）
├── ai.ini             ← AI 配置（部分支持）
├── *.shp              ← 自定义 SHP 贴图（平铺在根目录）
├── *.wav              ← 自定义音效（平铺在根目录）
└── *.mp3              ← 自定义音乐（平铺在根目录）```plaintext

**文件加载优先级（从高到低）：**

1. `*.ini`, `ra2.csf`, `*.mpr`, `*.map`, `*.pkt`
2. `ecache99.mix` → `ecache00.mix`
3. `expand99.mix` → `expand00.mix`
4. `elocal99.mix` → `elocal00.mix`
5. `*.mmx`
6. `ra2cd.mix`（硬编码，不可覆盖）
7. 原版 MIX 归档（`ra2.mix`, `language.mix`, ...）

### 四、快速巡检脚本（给 Agent / 开发用）

```# Chrono Divide 移植健康检查（Python 3）
import zipfile, os

def check_mod_archive(path):
    issues = []
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        # 1. 检查是否有嵌套文件夹
        top_dirs = {n.split('/')[0] for n in names if '/' in n}
        if top_dirs and not all(n == top_dirs.pop() for n in top_dirs):
            issues.append("ERROR: 存在多个顶层文件夹，必须扁平结构")
        # 2. 检查 modcd.ini
        if 'modcd.ini' not in names:
            issues.append("WARN: 缺少 modcd.ini 清单文件")
        # 3. 检查 main.js
        if any(n.endswith('.js') for n in names):
            issues.append("ERROR: 包含 JS 文件（main.js），Chrono Divide 不支持")
        # 4. 检查必要 SHP
        required_shp = {'mcv.shp', 'smcv.shp', 'crater01.shp'}
        present = {n.lower() for n in names if n.lower().endswith('.shp')}
        missing_shp = required_shp - present
        if missing_shp:
            issues.append(f"WARN: 缺失地形/MCV 贴图: {missing_shp}")
    return issues

print(check_mod_archive("yellow-alert-mod.zip"))```python

### 五、配置参考

#### `modcd.ini` 模板

```[General]
ID=yellow-alert        ; 仅允许字母、数字、-、_
Name=黄色警戒
Description=经典的红色警戒2第三阵营扩展模组
Version=1.0.0
Author=Mod 作者名
Website=https://game.ra2web.com```ini

#### 受支持/不支持的功能简要

| 功能 | 支持情况 | 黄色警戒常用程度 |
|---|---|---|
| 第三阵营（Side=X） | ✅ 支持 | 黄色警戒核心 |
| 自定义 SHP | ✅ 支持 | 大量使用 |
| HVA 动画 | ❌ 不支持（仅第一帧） | 黄色警戒较少使用 |
| 粒子系统伤害 | ❌ 不支持 | 可能影响某些武器 |
| AI 控制逻辑 | ❌ 不支持 | 黄色警戒大量使用 |
| 原版地图触发 | ❌ 不支持 | 战役地图需改造 |
| VXL 多 section | ⚠️ 不能有重名 section | 注意检查 VXL 文件 |

### 六、日志诊断速查表

| 日志特征 | 问题 | 修复 |
|---|---|---|
| `SyntaxError: Unexpected identifier` + `main.js` | GProxy JS 注入 | 移除 `main.js`，改用引擎内置联网 |
| `No image file found for artName="CRATER*"` | 缺地形损伤贴图 | 从原版 `local.mix` 提取放入根目录 |
| `No image file found for artName="SMCV"` | 缺苏联 MCV | 提供 `smcv.shp` |
| `Audio file "*.mp3" not found` | 缺自定义音乐 | 提供对应 MP3 文件或用原版替换 |
| `Missing sound section [*]` | 自定义音效 section | 移除不支持的 section 引用 |
| `Music section [*] not found` | 主题配置不匹配 | 修 `theme.ini` 引用 |
| `showWhenUnpowered` TypeError | 引擎动画 Bug | 简化建筑物精英武器配置 |
| `ERR_BLOCKED_BY_CLIENT` | 广告拦截器 | 忽略，不影响游戏 |

*本文档基于 Chrono Divide v0.83.2 + 黄色警戒实际运行日志生成，2026-07-31。*
