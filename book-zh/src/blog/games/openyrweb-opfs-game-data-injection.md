# 浏览器 OPFS 注入游戏数据方案

> 日期：2026-08-02

### 触发场景

OpenYRWeb 把《红色警戒2》/《尤里的复仇》以及 MOD 的全部游戏数据放在浏览器端读取，而不是服务器文件系统。这就带来一个工程问题：mix 归档（`ra2.mix` 约 200MB+，超过 git 100MB 单文件上限，走 Git LFS）和 MOD 文件（`rulesmd.ini`/`artmd.ini`/`ra2md.csf`/`*.mmx`）怎么进入浏览器？手动打开游戏会弹出「请定位你的红警2游戏文件」对话框，需要选择文件夹/压缩包，或者点「一键下载并解压」从外部拉取——对开发者来说既慢又困惑。

更麻烦的是：重新 `npm run build` 会清空 `build/` 目录，之前放好的注入数据全丢；Playwright 无头测试每次也要走一遍注入。

本文给出两条互补路径：**Playwright OPFS 持久注入**（自动化/测试用）与 **启动画面「读取项目目录资源」按钮**（人工/演示用），核心都是把 9 个必需 mix + MOD 文件 + 音乐写入浏览器 OPFS（Origin Private File System）。

### 谬误溯源：三个想当然的假设

**第一个想当然**：以为"把 mix 放服务器 build 目录，浏览器 fetch 一下就行"。实际 OpenYRWeb 的数据层走 OPFS：`Engine.initRfs()` 用 `navigator.storage.getDirectory()` 拿根目录，`lookForGameFiles()` 检查根目录是否同时存在 `language.mix`/`langmd.mix`/`multi.mix`/`multimd.mix`/`ra2.mix`/`ra2md.mix` 这 6 个必需文件（加上 `theme`/`thememd`/`expandmd01` 共 9 个），检测到才跳过定位对话框。所以注入目标是 **OPFS 根目录**，不是服务器路径。

**第二个想当然**：以为"注入脚本每次把 base64 从仓库读到内存再写 OPFS 就行"。这是对的，但要注意：Playwright 的 `launchPersistentContext` 会锁定 profile 目录（`/tmp/pw-openyrweb-profile`），第二个进程启动会报 `Failed to create a ProcessSingleton`；脚本要保证幂等（重复执行只覆盖同名文件），并且大文件（`ra2.mix` 269MB）不要整文件读进内存——用 `fetch + createWritable + stream` 流式写入。

**第三个想当然**：以为"给用户加个按钮点『一键下载』就够了"。实际开发场景用户本地已经有全部文件，只是不在浏览器里；更好的做法是加一个「读取项目目录资源」按钮：点击后从 `/_inject/gamedata/`（或 URL 参数 `?gamedata=` 指定的路径）拉取 9 个 mix、23 个 MOD 文件、3 首 BGM，流式写入 OPFS，然后 `location.reload()` 自动进入主菜单——零手工选择、零外部下载。

### 源码验证与落地结论

验证点都在引擎源码与注入脚本里：`engine/gameRes/GameRes.ts.js` 的 `lookForGameFiles`（9 文件清单）、`getBrowserFsHandle("native")`/`initRfs`（OPFS 根目录）、`GameResBoxApi.ts.js` 的 `promptForGameRes` 弹窗（按钮回调）；`scripts/inject-persist.mjs`（本地 base64 注入：`mods/yellow-alert/*` → OPFS `mods/yellow-alert/`，音乐 → OPFS `music/`）。

落地分三步：

1. **注入脚本**——用 `launchPersistentContext` 打开持久 profile，`evaluate` 里 `navigator.storage.getDirectory()` 拿根目录，`getFileHandle(name, {create:true})` + `createWritable()` 写入 base64 解码后的字节（或流式 fetch）；音乐必须放 OPFS 根 `music/` 目录（引擎 `rfs.findDirectory("music")` 读取），MOD 文件放 `mods/yellow-alert/`（standalone 覆盖）。
2. **启动画面按钮**——在 `GameResForm` 加「读取项目目录资源」按钮，回调返回 `{projectDir:true}`；`GameRes.ts.js` 收到后按 `?gamedata=` 参数或 `/_inject/gamedata/` 拉取 9 个 mix 写入 OPFS 根，再拉 `/_inject/mod/yellow-alert/` 到 `mods/yellow-alert/`、`/_inject/music/` 到 `music/`，全部成功后 `location.reload()`。
3. **`_inject` 目录准备**——在 serve 的 `build/_inject/` 下放 gamedata/mod/music 三个子目录，用 symlink 指向仓库对应目录（`gamedata/*.mix`、`mods/yellow-alert/*`、`mods/yellow-alert/music/*`）；注意 `npm run build` 会清空 `build/`，symlink 必须在 build **之后**重放（写成一个 `prepare-inject` 命令循环 ln -sf 即可）。

验证：空浏览器 profile 打开首页 → 弹出简体启动画面 → 点「读取项目目录资源」→ OPFS 出现 9 个 mix + 23 个 mod 文件 + 3 首 mp3 → 自动 reload 进入简体主选单，全程无文件选择器、无外部下载。

---

**【人类开发者速查】** 四步自检：① OPFS 根目录必须有 9 个 mix（ra2/ra2md/language/langmd/multi/multimd/theme/thememd/expandmd01），否则弹定位框；② MOD 文件放 `mods/yellow-alert/`，音乐放根 `music/`；③ `npm run build` 会清空 `build/`，symlink 要在 build 后重放；④ 第二个 Playwright 进程会因 profile 被锁失败，先杀旧进程。

**【对话式 AI 速查】** 提问模板："OpenYRWeb 怎么把游戏文件给浏览器 / 启动画面一直弹定位框？" 应回答：数据走浏览器 OPFS（`navigator.storage.getDirectory()`），9 个必需 mix 必须在 OPFS 根；自动化用 Playwright 持久 profile 注入，人工用启动画面「读取项目目录资源」按钮从 `/_inject/` 拉取；build 会清空 _inject 需重放 symlink。

**【代码 Agent 速查】** 关键定位：`engine/gameRes/GameRes.ts.js`（lookForGameFiles 清单、projectDir 分支）、`gui/component/GameResBoxApi.ts.js`（onLoadProjectDir 回调）、`scripts/inject-persist.mjs`（base64 注入参考）。注入用 `getFileHandle(create:true)+createWritable` 流式写；启动画面按钮路径 `/_inject/{gamedata,mod/yellow-alert,music}/`，支持 `?gamedata=` 参数覆盖。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-opfs-game-data-injection.html
