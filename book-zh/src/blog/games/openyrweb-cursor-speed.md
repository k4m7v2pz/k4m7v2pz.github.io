# OpenYRWeb 战场光标速度异常排查记录

> 日期：2026-08-05

### 触发场景

项目为 OpenYRWeb（红警2 / 尤里的复仇 浏览器移植引擎，自托管），问题出现在战场内自绘光标上。现象是战场中光标移动速度异常——初始约桌面速度的 10%（慢 10 倍）；修复一轮后反而约桌面 10 倍（快 10 倍）。环境为 Vivaldi（Chromium 150）、macOS、本地 `node server/index.mjs 8081`、MOD 数据注入浏览器 OPFS。决定性线索是退出 pointer lock 后光标恢复正常速度（与桌面完全一致），说明差异只在 lock 模式的坐标路径。

### 谬误溯源

### 源码验证（实测）

下面结合源码确认光标坐标链路与根因。

#### 光标坐标链路（src/gui/Pointer.ts.js）

- 非 lock 模式：`position = pageX - canvasMetrics.x`（绝对坐标，1:1 正常）。
- lock 模式：`position += e.movementX/movementY`（增量累积，速度取决于浏览器提供的 movementX）。
- 战场进入时主动 lock（GameScreen.ts.js `this.pointer.lock()`）。

#### 根因

引擎请求 pointer lock 时带 `{ unadjustedMovement: !mouseAcceleration.value }`；"鼠标加速"设置默认关闭 → `unadjustedMovement: true`。Chromium 150（Vivaldi）在 macOS 上启用 unadjustedMovement 时，movementX/Y 约为真实位移的 0.1 倍 → 光标慢 10 倍。

#### 修复

恒禁用 unadjustedMovement（三处 `request({ unadjustedMovement: !1 })`）→ movementX 走系统指针路径，与桌面光标 1:1，无加速度。实测验证：修复前游戏内=0.1×桌面；误加 ×10 补偿后=10×桌面；移除补偿、仅保留禁用后=1×桌面（正确）。

#### 缓存坑（验证必须硬刷新）

build 是全量（`rmSync(BUILD)` 清空重建）且 serve 返回 `Cache-Control: no-cache`，但浏览器仍可能缓存 dist JS；第一次"还是慢"实为旧 build，必须 `Cmd+Shift+R` 硬刷新后验证。

排查过程中先后踩过三个误区，逐一记录如下。

#### 1. 误区「canvas 尺寸/DPR 问题」

实测主菜单 canvas 缓冲与 CSS 显示一致（1280x720 1:1）、引擎未调用 `setPixelRatio`，光标映射与 DPR 无关，排除。

#### 2. 误区「unadjustedMovement 是根因」

禁用它后仍慢——实际是浏览器缓存了旧 JS（build 全量重建但浏览器未硬刷新），验证结果失真，误导了后续判断。

#### 3. 误区「movementX 慢就乘补偿因子」

根据"慢 10 倍"加 ×10 补偿，结果光标快 10 倍——补偿只在输入确实失真时可用，且必须先排除缓存等干扰再动补偿。

### 落地结论

方案是 pointer lock 请求恒禁用 unadjustedMovement，movementX 走系统指针路径，光标与桌面 1:1、无加速度（用户"没开加速"时即线性）。要点是改光标速度前先排除浏览器缓存（硬刷新）；不要凭一次观察就加缩放补偿，补偿极易过度；对比基准（桌面 vs 游戏内）要明确。适用范围为 Chromium 系浏览器（Chrome/Edge/Vivaldi）在 macOS 上的 pointer lock 光标速度问题；同样思路可用于 FPS 类 Web 游戏。

### 人类开发者

自查：战场中 F12 console 执行 `document.addEventListener("mousemove",e=>console.log(e.movementX))`，移动鼠标对比实际位移。验证：`Cmd+Shift+R` 硬刷新后再测；可用 curl 确认 serve 返回的新 JS 内容。

### 对话式 AI

一句话问法：「Chromium 150 下 pointer lock 光标移动慢 10 倍，怎么修？」回答要点：检查 unadjustedMovement——macOS 上 true 会使 movementX 缩水约 0.1 倍，禁用（false）走系统路径即可 1:1；排除浏览器缓存后再做缩放补偿。

### 代码 Agent

可执行流程：grep pointer lock 请求点 → 把 unadjustedMovement 恒置 false → 全量 build → 确认产物 → 提示用户硬刷新验证（不要直接加 movementX 缩放补偿）。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-cursor-speed.html
