# 把红警引擎改成我的形状：OpenYRWeb 现代化改造全景

> 日期：2026-08-07

### 1. 为什么改一个浏览器里的老引擎

OpenYRWeb 是红警2 / 尤里的复仇的开源浏览器移植引擎（Apache-2.0），跑在浏览器里，数据从 OPFS 注入。它的上游已近乎停摆，因此本仓库就是事实上的活跃分支——引擎 bug 自己修，格式自己改。

改造的总目标是：让这个 2000 年代的引擎，贴合「个人格式审美」和「Agent 协作」两套标准：

- **贴合个人审美**：素材用 PNG（图块/建筑）和 WAV（语音），不用 mix/SHP 调色板格式；
- **贴合 Agent**：配置用 JSON + JSON Schema（可校验、可枚举、可生成），不用纯 ini。

### 2. 改造的四个层面

#### 2.1 数据注入层

原版游戏数据（9 个 mix）通过浏览器 OPFS 注入，MOD 文件同样走 OPFS。为此实现了注入页面 `inject.html`（带进度条、结果回传后端 `/api/inject-report`）和 playwright 自动化注入脚本。

#### 2.2 图块层（PNG tileset）

自制图块集 `yuanbao` 以 PNG 提供（256×128 / @2x），`meta.json` 描述 tile 编号与 subTile。引擎新增 `PngTileset` 加载器，把 PNG 解码后与地形图块系统对接。

#### 2.3 建筑渲染层（PNG 直色）

建筑本体原本只吃 SHP（8-bit 调色板索引）。新增 `PngShpFile` 把 RGBA 包装成 ShpFile 兼容对象，ImageFinder 支持 `.shp` 缺失时回退同名 `.png`，ShpBuilder 支持 RGBAFormat 直色材质。这条路踩了六层坑，详见《为什么报错不崩的问题最难修》。

#### 2.4 规则配置层（JSON Schema）

原创建筑/科技树/经济以 `design/*.json` 描述，JSON Schema 锁死结构（事件枚举、字段必填、additionalProperties:false），构建脚本 `build-json-rules.mjs` 生成 flat INI 段。语音配置 `design/voice/*.json` 同理，事件键对齐引擎实际触发的 EVA 事件枚举。

### 3. 改造后的形态

| 层面 | 原版 | 改造后 |
|---|---|---|
| 图块 | mix 内 .tem | PNG + meta.json（含 @2x） |
| 建筑 | artmd Image → .shp | Image → .png（ImageFinder 回退） |
| 语音 | mix 内 ceva/csof wav | OPFS 内 TTS 生成 wav（中英双语） |
| 规则 | rulesmd.ini 手写 | design JSON → 生成 ini |
| 校验 | 无 | JSON Schema（IDE 实时校验） |
| 验证 | 手动 | playwright 进遭遇战实测 |

### 4. 改造的代价

- 引擎源码改了十几个文件（渲染管线、打包清单、art 解析），每次 repack 后必须硬刷新浏览器；
- PNG 直色与 SHP 调色板是两套渲染管线，需要同时维护；
- 新增引擎文件必须手工注册 `_module-map.json`，否则 SystemJS 404；
- 任何渲染链改动都要回归验证「能玩」：点选、框选、展开、攻击。

### 5. 结论

把老引擎改成「我的形状」，本质是在四层（数据注入、图块、建筑渲染、规则配置）各自做格式现代化。收益是可复现、可校验、Agent 友好；成本是引擎渲染管线的深度适配。这套改造全部记录在 `docs/PORTING.md`，后续 MOD 直接复用。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-modernization-overview.html
