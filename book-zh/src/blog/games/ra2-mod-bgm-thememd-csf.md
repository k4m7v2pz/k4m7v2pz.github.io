# RA2 MOD 的 BGM 挂载与显示名翻译

> 日期：2026-08-02

### 触发场景

给《红色警戒2》扩展 MOD（本文以「黄色警戒」为例）配背景音乐时，会遇到两个问题：

1. MOD 自带 3 首 BGM（主菜单 1 首、游戏内 2 首，其中一首是 Frank Klepacki 的《Mud》），但放进浏览器后主菜单和游戏内都听不到声音；
2. 音乐能播了，但音乐选择列表里显示的是 `01 - THEME:YellowBattle1` 这种原始键名，而不是「黄色警戒 - 游戏内」。

两个问题都源于引擎的音乐链路：

- 主题规格（`MusicSpecs`）从 `thememd.ini` 的 `[Themes]` 段读取，每个主题包含 `Sound`/`Normal`/`Repeat`；
- 播放时 `Music.getMp3File()` 会把主题名小写化再拼 `.mp3`（如 `THEME:YellowBattle1` → `yellowbattle1.mp3`），从浏览器 OPFS 根目录的 `music/` 文件夹加载；
- 而音乐列表 UI（`MusicJukebox`）显示的是 `i.get(e.name)`——把主题名当 CSF 翻译键去查表，查不到就返回原字符串。

所以“听不到”和“显示键名”是两个独立但同源的机制问题。

### 谬误溯源：三个想当然的假设

#### 第一个想当然：以为“把 mp3 放进浏览器文件系统就能播”

实际 OpenYRWeb 的音乐播放有完整链路：

- 主题表必须在 `thememd.ini` 的 `[Themes]` 段声明（`[YellowBattle1] Sound=YellowBattle1 Normal=yes Repeat=yes`），引擎才认为存在这个主题；
- mp3 必须放在 OPFS 根 `music/` 目录且命名 = 主题 Sound 小写 + `.mp3`（`yellowbattle1.mp3`）。

MOD 是 RA2 原版平台的，它的音乐定义在原版 `theme.ini`/art 体系里（或根本没有 md 变体），引擎 YR-only 只读 `thememd.ini`，两者对不上就静音。

#### 第二个想当然：以为“直接往 thememd.ini 写中文 Name 就行”

结果列表显示乱码或键名——`MusicJukebox` 的显示走 `i.get(e.name)`（CSF 翻译键查询），不存在的键返回原字符串；而且 `readString` 默认按 ASCII 逐字节解码，UTF-8 中文会被拆坏。

正确做法是 Name 保留 `THEME:YellowBattle1` 这种键名，把「黄色警戒 - 游戏内」写进 `ra2md.csf` 的对应键值。

#### 第三个想当然：以为“mmx/mix 挂载很复杂”

实际上 MOD 的音乐主题表打包成 `yellowmusic.mmx`（一个 mmx 归档）放在 `mods/yellow-alert/` 即可，引擎加载 mod 时自动挂载并覆盖原版主题表——关键是文件要进 OPFS 的 `mods/yellow-alert/` 目录（standalone 覆盖 mix），不是随便找个地方放。

### 源码验证与落地结论

验证点都在引擎源码里：

- `engine/sound/MusicSpecs.ts.js`（解析 thememd.ini `[Themes]` 段，`Sound`/`Normal`/`Repeat` 字段）
- `engine/sound/Music.ts.js`（`getMp3File()` 拼 `sound小写 + ".mp3"`，从 `rfs.findDirectory("music")` 读取）
- `engine/sound/MusicJukebox.ts.js`（`i.get(e.name)` 显示翻译）
- `data/CsfFile.ts.js`（CSF 键值解析，`' LBL'` 魔数 + UTF-16LE 取反值）

#### 落地流程分四步

1. **自定义主题表**：创建 `thememd.ini`，在 `[Themes]` 段声明 3 个主题：


```[YellowMenu]
Sound=YellowMenu
Normal=yes
Repeat=no

[YellowBattle1]
Sound=YellowBattle1
Normal=yes
Repeat=yes

[YellowBattle2]
Sound=YellowBattle2
Normal=yes
Repeat=yes```ini

	打包成 `yellowmusic.mmx` 放进 `mods/yellow-alert/`。
2. **准备音频文件**：把 3 首 mp3 以 22050Hz/96k 转码后注入 OPFS `music/` 目录（主题 Sound 小写命名：`yellowmenu.mp3`/`yellowbattle1.mp3`/`yellowbattle2.mp3`）。
3. **添加中文显示名**：显示名走 CSF 翻译——`THEME:YellowBattle1` 键的值写「黄色警戒 - 游戏内」，`THEME:YellowBattle2` 写「Frank Klepacki - Mud」，注入 `ra2md.csf`（基于 cd-overrides 的完整 CSF，按引擎同款格式追加条目：`' LBL' | flags | nameLen | name | ' RTS' | charCount | UTF-16LE 取反字节`）。
4. **验证**：主菜单播放 `YellowMenu`、游戏内播放 `YellowBattle1`/`YellowBattle2`，音乐列表显示中文曲名。

**注意**：mod 的 `thememd.ini` 会整体覆盖原版主题表，如果想保留原版音乐需在自定义主题表里一并声明原版主题。

### 经验总结

BGM 三要素缺一不可——**thememd.ini 声明主题、music/ 目录放同名列名 mp3、CSF 提供显示名**；听不到先查前两个，显示键名查第三个，三者都是数据层问题，与引擎渲染无关。

---

#### 【人类开发者速查】四步自检

1. 主题表在 thememd.ini `[Themes]` 段（Sound/Normal/Repeat），打包成 mmx 放 `mods/yellow-alert/`；
2. mp3 在 OPFS 根 `music/`，命名 = 主题 Sound 小写 + `.mp3`（yellowbattle1.mp3）；
3. 显示名走 CSF：Name 保留 `THEME:xxx` 键，把中文写进 ra2md.csf 对应键值；
4. 推荐 22050Hz/96k 转码，与引擎读取兼容。

#### 【对话式 AI 速查】提问模板

“OpenYRWeb 红警2 MOD 音乐不播 / 音乐列表显示 THEME:xxx 怎么修？” 应回答：主题表在 thememd.ini [Themes] 段（打包 mmx 挂载），mp3 在 OPFS music/ 且命名=Sound 小写+.mp3；列表显示键名是 CSF 缺翻译，往 ra2md.csf 加 `THEME:xxx` 键值（' LBL' 格式、UTF-16LE 取反）。

#### 【代码 Agent 速查】关键定位

- `engine/sound/MusicSpecs.ts.js`（主题解析）
- `engine/sound/Music.ts.js`（getMp3File 拼名）
- `engine/sound/MusicJukebox.ts.js`（i.get 显示）
- `data/CsfFile.ts.js`（CSF 读写）

改完注入 OPFS 后刷新页面；音乐文件放根 `music/`，mod 文件放 `mods/yellow-alert/`。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/ra2-mod-bgm-thememd-csf.html
