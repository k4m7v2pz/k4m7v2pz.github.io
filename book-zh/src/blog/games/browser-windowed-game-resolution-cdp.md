# 浏览器窗口化游戏分辨率适配：CDP 外层尺寸 vs 内容区尺寸

> 日期：2026-08-02

### 触发场景

用 Playwright/CDP 控制浏览器窗口化运行游戏（本文以 OpenYRWeb 红警2 浏览器引擎为例）时，会踩到一个隐蔽的分辨率坑：游戏窗口化（非全屏）后，主菜单和刚进游戏一切正常，但只要在游戏内点击场景或 UI，底部命令栏、菜单按钮就超出浏览器可视区，几乎点不到；截图看渲染范围比可视区大出一截。

排查后确认根因不在游戏渲染层，而在外部控制脚本的分辨率换算：脚本用 CDP `Browser.getWindowBounds` 拿到的是**窗口外层尺寸**（含标题栏/边框），直接调 `page.setViewportSize` 设置页面视口，导致页面 viewport 比浏览器可视区（内容区）大——主菜单是 DOM 自适应所以正常，游戏内 HUD 用像素定位（底部 UI 按 `viewport.height - 命令栏高` 计算坐标），自然被推到可视区之外。

另一个叠加因素是引擎对 viewport 有 800×600 最小钳制，窗口拖太小时二者冲突。本文给出完整修复：测量并缓存浏览器边框差（标题栏高度），把 CDP 外层尺寸换算成内容区尺寸再同步给页面。

### 谬误溯源：三个想当然的假设

#### 第一个想当然：以为“`Browser.getWindowBounds` 返回的就是页面可视区大小”

实际它返回**浏览器窗口整体**的 bounds，包含标题栏、标签页（垂直标签模式）、地址栏、边框——实测某窗口外层 1440×846，而页面可视区（内容区）是 1440×759，差约 87px（标题栏+标签栏）。直接用外层尺寸调 `setViewportSize`，页面视口就比可视区大 87px。

#### 第二个想当然：以为“动态算差值 `outer - inner` 就行”

实测 `setViewportSize` 会**强制**页面视口等于设定值，之后 `window.innerWidth/innerHeight` 读到的就是你设的值，`outer - inner` 差值会失真甚至变成负值，不能作为换算依据。

正确做法是**首次测量并缓存**边框差：`chrome = {dx: window.outerWidth - window.innerWidth, dy: window.outerHeight - window.innerHeight}`，标题栏高度在窗口生命周期内恒定，只测一次。

#### 第三个想当然：以为“游戏引擎会自动适应任意窗口大小”

实际上 OpenYRWeb 的 `Application.updateViewportSize()` 非全屏分支有 `Math.max(800, ...)`/`Math.max(600, ...)` 最小钳制——内容区小于 800×600 时引擎 viewport 被钳到 800×600，canvas 必然超出可视区；脚本侧还要加最小窗口保护，把窗口拉回安全尺寸。

### 源码验证与落地结论

验证点都在引擎源码与控制脚本里：

- `Application.ts.js` 的 `updateViewportSize()`（非全屏分支 `Math.min(window.innerWidth, config.viewport.width)` + 800×600 钳制）
- `Gui.handleViewportChange`（viewport 同步给 renderer 与 UiScene）
- `gui/screen/game/component/Hud.ts` 的 `HudFactory.create()`（用 `uiScene.viewport` 布局侧边栏与命令栏，底部坐标按 viewport 高度计算）

落地修复分三步：

1. **脚本首次启动时测量并缓存边框差** `chrome = {dx, dy}`（标题栏高度恒定，实测 dy=87）；
2. **每次轮询用 CDP `Browser.getWindowBounds` 拿外层尺寸后换算成内容区**：`cw = w - chrome.dx`、`ch = h - chrome.dy`，并加 `Math.max(800, ...)`/`Math.max(600, ...)` 下限保护（与引擎钳制一致），再 `page.setViewportSize({width: cw, height: ch})`；
3. **把「适应窗口」做成默认行为**——引擎侧 `updateViewportSize` 非全屏分支改为直接用 `window.innerWidth/innerHeight`（内容区），不再被 `config.viewport.width`（如 1024）钳制，这样用户不用进图形设置手动调「分辨率→适应窗口」。

修复后日志确认换算正确（`window 1440x846 → content 1440x759`），窗口任意拉伸、拖动到最小尺寸，游戏内底部 UI 都完整可点。

**经验总结**：浏览器窗口化游戏的尺寸链路是「CDP 外层 → 边框差 → 内容区 → 引擎 viewport → HUD 像素定位」，任何一环拿错都会导致 UI 越界；标题栏差只测一次、800×600 钳制两边对齐，是这套方案的两个关键点。

---

### 人类开发者速查

四步自检：

1. CDP `getWindowBounds` 是外层尺寸（含标题栏/标签页），不能直接当页面视口；
2. 首测并缓存边框差（`outer - inner`，标题栏恒定，实测 dy≈87）；
3. 换算内容区 `cw=w-dx, ch=h-dy` 并加 800×600 下限，再 `setViewportSize`；
4. 引擎非全屏分支默认用 `window.innerWidth/innerHeight` 实现「适应窗口」，免进图形设置。

### 对话式 AI 速查

**提问模板**：“playwright/CDP 窗口化游戏 UI 超出可视区 / 分辨率不对怎么修？”

**应回答**：`getWindowBounds` 返回外层尺寸含标题栏，需缓存边框差换算内容区再 `setViewportSize`；动态 `outer-inner` 会失真别用；引擎有 800×600 最小 viewport 钳制，脚本要同步下限；默认分辨率想适应窗口就改 `updateViewportSize` 用 `innerWidth/innerHeight`。

### 代码 Agent 速查

**关键定位**：

- `Application.ts.js` 的 `updateViewportSize`（800×600 钳制、非全屏分支）
- `gui/screen/game/component/Hud.ts`（像素定位）
- `gui/GameGui.ts.js`（`handleViewportChange`）

**脚本侧**：`Browser.getWindowBounds` 外层 → 缓存 `chrome={dx,dy}` → `setViewportSize(cw, ch)`；改引擎默认分辨率时删除 `Math.min(innerWidth, config.viewport.width)` 钳制即可。
