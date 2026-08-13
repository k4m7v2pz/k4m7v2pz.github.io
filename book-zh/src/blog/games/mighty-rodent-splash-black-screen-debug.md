
# Mighty Rodent Splash 黑屏踩坑记录

> 日期：2026-07-09
> 项目：rust-bevy-mighty-rodent（Bevy 0.14 重写 Mighty Rodent）
> 现象：`cargo run` 后游戏窗口显示约 2 秒黑色，然后直接进主菜单，看不到 splash 两张图（`jaggedlogo.jpg` / `mainpic.jpg`）

## 一、症状

- 窗口出现 → 黑屏约 2 秒 → 直接 MainMenu。
- 期望：jaggedlogo.jpg 全显 1.5s → 淡到黑 0.8s → mainpic.jpg 从黑变亮 + 蓝色进度条 2.0s → 持亮 0.5s → MainMenu。

## 二、诊断走过的弯路（按发生顺序）

### 弯路 1：以为是 splash 系统没执行

- `src/splash.rs` 是 `git status` 里的 `??` 未跟踪文件，怀疑没被编进 binary。
- 验证：`cargo check` 通过，`main.rs:4` 有 `mod splash;`，`main.rs:105` 注册了 `splash::SplashPlugin`——代码确实编进去了。
- **结论：不是没编进。**

### 弯路 2：以为是 `OnEnter(默认状态)` 不触发

- `AppState::SplashLogo` 是 `#[default]` 初始态，`show_splash_logo` 原挂在 `OnEnter(SplashLogo)`。
- 怀疑 Bevy 0.14 对"程序一开始就在的默认态"不触发 `OnEnter`。
- 改法：把 `show_splash_logo` 从 `OnEnter` 改挂 `Startup`。
- 验证：重跑 → 还是黑屏。
- **结论：改挂 Startup 是对的（保留），但不是黑屏根因。**

### 弯路 3：被日志诊断误导

- 想靠 `info!("Splash: Jaggedblade logo")` 确认系统执行没。日志里这条 **0 次出现**。
- 推断："splash 系统没执行"——**这个推断是错的**。
- 真相：`main.rs:93` `.disable::<LogPlugin>()` 禁了 Bevy 自带 logger，但 `src/splash.rs` 里 `info!` 是 `bevy::prelude::*` 的（走 Bevy logger），被禁后**全沉默**。而 `main.rs:120` 那条 `log::info!("Bevy app starting")` 走的是 `log` crate（simplelog 接的是这个），所以打得出来。
- **坑：`bevy::prelude::*` 的 `info!` ≠ `log::info!`。`disable::<LogPlugin>()` 后前者沉默，后者照常。诊断 splash 这类用 `info!` 的系统，要换 `log::info!`。**
- 验证：把 splash 里 4 处 `info!` 全换成 `log::info!` → 日志真能打出来了。
- **结论：是诊断手段失灵，不是 splash 没执行。**

### 弯路 4：在 Bevy 源码里查 `Camera2dBundle` 默认 transform

- 想确认相机默认 z 是不是正值（导致 z=0 的图在相机后面）。
- 在 `~/.cargo/registry/src/.../bevy-0.14.2/crates/` 里 grep `Camera2dBundle` —— 无输出。
- 绕了两轮没找到，按 STOP WHEN STUCK 放弃。
- **结论：别在 Bevy 源码里硬找 API，直接诊断系统打 transform 值。**

## 三、根因（诊断系统钉死）

在 `SplashPlugin::build` 里临时加 `splash_diag_system`（Update，一次性 Local flag），用 `log::info!` 打相机数、splash 实体数、transform、custom_size、texture handle path：

```
DIAG: cameras=1, splash_entities=2, splash_images=1
DIAG cam0: translation=Vec3(0.0, 0.0, 0.0) (z=0.00)
DIAG img0: translation=Vec3(0.0, 0.0, 0.0) (z=0.00) custom_size=Some(Vec2(800.0, 600.0)) path=gfx/jaggedlogo.jpg
Splash: Jaggedblade logo (Startup)
Splash: Main title picture (loading)
```

**事实：**
- splash 系统执行了（两段都跑了）。
- 相机 spawn 了，位于原点 z=0，看向 -Z（Camera2dBundle 默认）。
- splash 图 spawn 了，texture handle 路径对（`gfx/jaggedlogo.jpg`），custom_size 对（800×600）。
- **图 z=0，与相机平面重合。**

**根因：** Bevy 2D 相机近平面在 z=0 前一小段，**z=0 的 sprite 与相机平面重合，2D 渲染管线不绘制** → 黑屏。所有可见 sprite 的 z 必须为**负**（在相机前方），且 z 越小越远。

原代码 z 值全错：

| sprite | 原 z | 问题 |
|---|---|---|
| 黑背景 | -1.0 | OK（一直在相机前）|
| splash 图（logo + mainpic）| 0.0 | 与相机平面重合，不绘制 → 黑屏 |
| loading bar 背景 | 0.5 | 正值，在相机后面，不可见 |
| loading bar 填充 | 1.0 | 同上 |

## 四、修复

`src/splash.rs`，把所有 splash sprite 的 z 改成负值，按层序从远到近：

| sprite | 新 z | 层序 |
|---|---|---|
| 黑背景 | -1.0（不变）| 最远 |
| splash 图 | -0.5 | 背景前 |
| loading bar 背景 | -0.4 | 图前 |
| loading bar 填充 | -0.3 | 最前 |

代码锚点：
- `spawn_splash` 里 splash 图的 `Transform::from_xyz(0.0, 0.0, -0.5)`（原 0.0）
- `show_splash_main` 里 loading bar 背景 `Transform::from_xyz(0.0, -280.0, -0.4)`（原 0.5）
- `show_splash_main` 里 loading bar 填充 `Transform::from_xyz(-200.0, -280.0, -0.3)`（原 1.0）

## 五、次要改动

1. **`show_splash_logo` 改挂 `Startup`**（绕开 Bevy 0.14 `OnEnter(默认态)` 不触发问题）——保留，与时序一致。
2. **splash 里 4 处 `info!` 改 `log::info!`**——保留，让诊断信息真能打到 simplelog。
3. **诊断系统 `splash_diag_system`**——已删除，它已完成使命。
4. **进度条颜色改成绿色**：`Color::srgb(0.0, 0.8, 0.0)`（原 `Color::srgb(0.0, 0.8, 1.0)` 蓝色）。

## 六、经验沉淀

| 坑 | 教训 |
|---|---|
| `bevy::prelude::*` 的 `info!` 在 `disable::<LogPlugin>()` 后沉默 | 诊断 Bevy 系统执行情况，用 `log::info!`（走 simplelog），不要用 `info!` |
| Bevy 2D 相机看 -Z，近平面在 0 前 | **2D sprite 的 z 必须为负**才可见；z=0 与相机平面重合不绘制；正值在相机后面不可见 |
| `OnEnter(默认状态)` 在 Bevy 0.14 不触发 | 默认态的初始化系统挂 `Startup`，不要挂 `OnEnter` |
| 在 Bevy 源码里硬找 API | 别绕源码，直接诊断系统打运行时值 |
| 凭"日志没打"推断"系统没执行" | 先确认日志路由对不对（logger 是哪套），再推断执行情况 |

## 七、验证

```
cargo check  → 通过（只剩先前 14 个无关 warning）
cargo run    → jaggedlogo.jpg 全显 → 淡到黑 → mainpic.jpg 变亮 + 绿色进度条填满 → MainMenu ✅
```

---

Co-Authored-By: AtomCode (GLM-5.2) <noreply@atomgit.com>


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/mighty-rodent-splash-black-screen-debug.html
