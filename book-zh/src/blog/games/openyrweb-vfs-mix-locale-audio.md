# OpenYRWeb 浏览器引擎内幕：VFS-mix 加载、locale 检测与音频链路

> 日期：2026-08-02

### 触发场景

想搞清楚 OpenYRWeb（开源、可自托管的 RA2/YR 浏览器移植引擎）为什么“能跑”以及“怎么排障”时，需要理解它的几个关键机制：游戏数据（mix 归档、ini、csf）怎么进入浏览器？为什么引擎只认 `rulesmd.ini`/`artmd.ini`（md 变体）？界面语言是怎么自动变成简体中文的？BGM 和音效分别走什么链路？本文从源码层面拆解这四个机制，帮你建立对引擎的完整心智模型，遇到问题知道去哪查。

### 谬误溯源：三个想当然的假设

#### 第一个想当然：以为“引擎直接读服务器文件系统”

实际 OpenYRWeb 的数据层是 **VFS（VirtualFileSystem）+ 浏览器 OPFS**：`Engine.initRfs()` 用 `navigator.storage.getDirectory()` 拿 OPFS 根目录，`lookForGameFiles()` 检查 6 个必需 mix（language/langmd/multi/multimd/ra2/ra2md）是否存在；VFS 里 standalone 文件（如注入的 `mods/yellow-alert/rulesmd.ini`）优先级高于 mix 归档（ra2md.mix 内的同名文件），所以 MOD 数据能覆盖原版。

#### 第二个想当然：以为“把 MOD 的 rules.ini 改名成 rulesmd.ini 就完事”

引擎是 **YR-only**：`getFileNameVariant("rules.ini")` 返回 `rulesmd.ini`，`art.ini`→`artmd.ini`，`ra2.csf`→`ra2md.csf`，`theme.ini`→`thememd.ini`——RA2 非 md 文件根本不读。而且 `Engine.loadRules()` 里 `patchAudioVisualRules()` 会把 `[General]` 段的 35 个键同步到 `[AudioVisual]`，MOD 是 RA2 风格（键只在 `[AudioVisual]`）就会同步成空值触发初始化崩溃。

#### 第三个想当然：以为“语言是配置文件里的开关”

实际界面语言由 **CSF 内容自动检测**：`CsfFile.autoDetectLocale()` 看 `THEME:Intro` 的值——“開場”→ChineseTW、“开场”→ChineseCN，`getIsoLocale()` 返回 `zh-CN`，`Application` 再加载 `locale/zh-CN.json` 覆盖界面文本。所以“让界面变简体”本质是改 `ra2md.csf` 的 `THEME:Intro` 值，不是改任何配置开关。

### 源码验证与落地结论

验证点分布在引擎源码各模块：`data/vfs/VirtualFileSystem.ts.js`（standalone 优先级、`getFileNameVariant`）、`engine/Engine.ts.js`（`initRfs`/`loadRules`/`patchAudioVisualRules` 35 键同步/`getActiveMod`）、`data/CsfFile.ts.js`（parse/autoDetectLocale/getIsoLocale）、`Application.ts.js`（`loadTranslations(locale)` 加载 `locale/{lang}.json`、`updateViewportSize` 分辨率钳制）、`engine/sound/AudioSystem.ts.js`（`new AudioContext()` + `decodeAudioData` 播放，`createChannels` 按 ChannelType 建 Gain 节点）。

完整链路梳理：启动 → `loadConfig`（config.ini 的 `defaultLanguage`）→ `GameRes.init`（OPFS 检测 → 缺数据弹定位框）→ `Engine.initVfs`（挂 mix 归档 + standalone mod 文件）→ `loadRules`（rulesmd.ini 合并 + patchAudioVisualRules）→ CsfFile 检测语言 → 加载 locale json → 主菜单。

音频双链路：BGM 走 `Music.ts`（`getMp3File()` 拼 `sound小写+.mp3` 从 OPFS `music/` 读，主题表在 thememd.ini `[Themes]` 段）；音效走 `AudioBagFile`（audio.idx 解析条目 → buildWavData 生成 WAV → `decodeAudioData` 播放，ChannelType 分 Master/Effect/Ui 音量通道）。

排障顺序建议：数据问题先查 VFS（`vfs.fileExists("xxx")` 在控制台直接验）→ 配置问题查 merge 后 rules（`Engine.getRules()`）→ 语言问题查 CSF 的 THEME:Intro → 音频问题查 decodeAudioData 是否成功（失败会有 `EncodingError` 或 `Failed to decode wav file`）。

### 经验总结

OpenYRWeb 的四个关键词是 **OPFS、VFS、YR-only、CSF 自检语言**；记住“standalone 覆盖 mix、md 变体才是入口、THEME:Intro 决定语言、decodeAudioData 决定音效”，绝大多数问题都能在半小时内定位。

---

#### 【人类开发者速查】

四步自检：① 数据进浏览器靠 OPFS（`navigator.storage.getDirectory()`），VFS 里 standalone > mix 归档；② YR-only 引擎只读 md 变体（rulesmd/artmd/thememd/ra2md），RA2 非 md 文件不读；③ 界面语言由 `THEME:Intro` 值自动检测（“开场”→zh-CN），改 CSF 即可；④ 音效链路 `AudioBagFile → decodeAudioData`，失败会 `EncodingError`。

#### 【对话式 AI 速查】

提问模板：“OpenYRWeb 为什么只读 rulesmd.ini / 怎么改界面语言 / 音效没声音？” 应回答：YR-only 引擎 `getFileNameVariant` 强制 md 变体；语言由 `CsfFile.autoDetectLocale` 读 THEME:Intro（开场=简体）自动检测；音效走 OPFS audio bag + decodeAudioData，失败查控制台 EncodingError。

#### 【代码 Agent 速查】

关键定位：`data/vfs/VirtualFileSystem.ts.js`（standalone 优先级/getFileNameVariant）、`engine/Engine.ts.js`（initRfs/loadRules/patchAudioVisualRules）、`data/CsfFile.ts.js`（autoDetectLocale）、`engine/sound/AudioSystem.ts.js`（decodeAudioData/createChannels）。排障先用 `Engine.vfs.fileExists()` 验数据，再 `Engine.getRules()` 验配置，最后看 console 的音频解码错误。
