# OpenYRWeb 移植红警 MOD 实战：BGM 挂载与 UI 越界修复

> 日期：2026-08-02

### 触发场景与谬误溯源

把《红色警戒2》扩展 MOD「黄色警戒」移植进 OpenYRWeb 浏览器引擎时，遇到两个隐蔽问题。

**其一：**MOD 自带 3 首 BGM（主菜单 1 首、游戏内 2 首，其中一首是 Frank Klepacki 的《Mud》），但原版数据里只有 `art.ini`/`rules.ini`（RA2 非 md 命名），引擎是 YR-only，只读 `artmd.ini`/`rulesmd.ini`/`thememd.ini`——音乐文件虽然放进去了，主菜单和游戏内却听不到任何声音；即使能听到，音乐选择列表里显示的是 `01 - THEME:YellowBattle1` 这种原始键名，而不是「黄色警戒 - 游戏内」。

**其二：**窗口化（非全屏）游玩时，主菜单和刚进游戏一切正常，但只要在游戏内点击场景或 UI，底部命令栏、菜单按钮就会超出浏览器可视区，几乎点不到。

两个问题在真机上都能稳定复现，排查后都指向“数据格式与引擎预期不一致”这一条主线。

### 源码验证与落地结论

#### 音乐问题：链路缺失与编码错位

最初以为“把 mp3 放进浏览器文件系统就能播”，实际上 OpenYRWeb 的音乐播放有完整链路：

1. **主题规格（`MusicSpecs`）**从 `thememd.ini` 的 `[Themes]` 段读取，每个主题包含 `Sound`、`Normal`、`Repeat`。
2. 播放时 `Music.getMp3File()` 会拼接 `sound 小写 + ".mp3"`，从浏览器 OPFS 根目录的 `music/` 文件夹加载。

MOD 是 RA2 原版平台的，它的 art 定义在 `art.ini`（307KB 增量表，在 `expand11.mix` 里），引擎只读 `artmd.ini`，两者对不上，所以专属单位的渲染全崩、音乐也静音。

第二个想当然：以为直接往 `thememd.ini` 写中文 Name 就行，结果引擎 `readString` 默认按 ASCII 逐字节解码，UTF-8 中文被拆成乱码（`é»è²è­¦æ`）；而且音乐列表 UI（`MusicJukebox`）显示的是 `i.get(e.name)`，即把 Name 当 CSF 翻译键去查表，不存在的键返回原字符串。

#### 分辨率问题：viewport 基准错位

以为是引擎渲染 bug，实测发现是外部 Playwright 脚本用 CDP `Browser.getWindowBounds` 拿到的窗口外层尺寸（含标题栏，实测 1440×846 vs 可视区 1440×759，差约 87px）直接调 `page.setViewportSize`，导致页面 viewport 比浏览器可视区大；主菜单是 DOM 自适应所以正常，游戏内 HUD 用像素定位（`x = viewport.width - 侧边栏宽`、`N = viewport.height - 命令栏高`），底部 UI 自然被推到可视区之外。

验证点都在引擎源码里：

- `Application.updateViewportSize()` 非全屏分支有 `Math.min(window.innerWidth, config.viewport.width)` 和 `Math.max(800, ...)`/`Math.max(600, ...)` 的最小钳制。
- `Gui.handleViewportChange` 会把 viewport 同步给 renderer 与 UiScene。
- `HudFactory.create()` 用 `uiScene.viewport` 布局侧边栏与命令栏。

### 三层修复方案

#### 1. 数据合并与注册

把 MOD 的 art 表合并进 `artmd.ini`（原版 1581 段 + MOD 1705 段），并给 `rulesmd.ini` 的 `[Animations]` 段补注册所有被引用的动画（注意剥离 `;%` 注释后扫描，别漏 `NATorpedoT_A` 这类键）。

#### 2. 音乐完整链路

自定义 `thememd.ini`（示例）：

```[YellowBattle1]
Sound=YellowBattle1
Normal=yes
Repeat=yes

[YellowBattle2]
Sound=YellowBattle2
Normal=yes
Repeat=yes

[YellowMenu]
Sound=YellowMenu
Normal=yes
Repeat=yes```ini

打包成 `yellowmusic.mmx` 让引擎自动挂载覆盖原版主题表。mp3 以 22050Hz/96k 转码注入 OPFS `music/` 目录。

显示名则改走 CSF 翻译：Name 保留 `THEME:YellowBattle1` 键，把「黄色警戒 - 游戏内」「Frank Klepacki - Mud」写进 `ra2md.csf`（按引擎 CsfFile 同款格式：条目 = `' LBL' | flags | nameLen | name | ' RTS' | charCount | UTF-16LE 取反字节`）。

#### 3. 分辨率脚本修正

改为先测量并缓存浏览器边框差（标题栏高度恒定，实测 dy=87），每次轮询把 CDP 外层尺寸换算成内容区尺寸（`cw = w - dx`，并保持 800×600 下限）再同步给页面。

### 修复效果与经验总结

三处修复后，主菜单与游戏内 BGM 正常、列表显示中文曲名、窗口任意拉伸底部 UI 都完整可点。

**经验总结：**移植跨平台引擎时，“文件名变体（md）、ini 段注册、CSF 键翻译、像素定位基准”这四类差异是最高频的坑，排查顺序应先对源码格式再改数据，别先怀疑渲染层。

### 三类读者速查

#### 人类开发者：四步自检

1. 引擎只读 md 变体（rulesmd/artmd/thememd），RA2 原版数据需改名或合并。
2. 音乐文件必须在 OPFS 根 `music/` 下、命名=主题 Sound 小写+.mp3，主题表在 `thememd.ini` 的 `[Themes]` 段。
3. 游戏内 UI 底部越界=viewport 比可视区大，检查外层/内容区换算（标题栏差），并留意引擎 800×600 最小钳制。
4. 列表显示键名=CSF 缺翻译，往 `ra2md.csf` 补键值。

#### 对话式 AI：提问模板

- “OpenYRWeb 音乐不播/显示 THEME:xxx，怎么修？” 应回答：主题表在 thememd.ini [Themes] 段、mp3 在 OPFS music/、显示名走 CSF 键翻译。
- “窗口化 UI 超出可视区” 应回答：CDP 拿的是外层尺寸需减标题栏、引擎有 800×600 最小 viewport。

#### 代码 Agent：关键定位

- `engine/sound/MusicSpecs.ts`（主题解析）
- `engine/sound/Music.ts`（getMp3File 拼名）
- `gui/screen/options/component/MusicJukebox.ts`（i.get 显示）
- `Application.ts` updateViewportSize（钳制）
- `gui/screen/game/component/Hud.ts`（像素定位）

改完重跑 `bun run scripts/inject-persist.mjs` 注入 OPFS 后刷新页面。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-ra2-bgm-and-ui-fixes.html
