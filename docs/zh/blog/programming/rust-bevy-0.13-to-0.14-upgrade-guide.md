---
title: Rust Bevy 0.13 到 0.14 升级踩坑指南
date: 2026-07-08
tags: [bevy, rust, game-development, upgrade-migration, macOS]
description: 记录将 Bevy 0.13 的 2D 像素游戏升级到 0.14 版本的全过程踩坑记录，包括 State API 抽离、几何图元迁移、Color 访问变更等破坏性变更的详细解法
categories: programming
---

> 本文记录将一个 Bevy 0.13 的 2D 像素游戏升级到 0.14 版本的全过程踩坑记录。0.14 是作者在 macOS 上运行最稳定的版本（更高版本会出现黑屏问题），因此锁定此版本。升级后，还顺手将项目中从 Python 迁移过来的两个模块（调试控制台和剧本系统）进行了补充。

## 一、为什么是 0.14

- **macOS 兼容性**：0.15 及以上版本在 macOS 上存在黑屏问题，0.14 是目前最稳定的选择。
- **破坏性变更**：0.13 → 0.14 存在破坏性 API 变更，不能仅仅修改 Cargo.toml 中的版本号。

## 二、Cargo.toml 的三处改动

### 1. 版本号

```toml
# before
bevy = { version = "0.13", default-features = false, features = [...] }
after
bevy = { version = "0.14", default-features = false, features = [...] }
```

### 2. feature 名改了下划线大小写

```toml
# 0.13 用 hyphen-case
"multi-threaded",
0.14 改成 snake_case
"multi_threaded",
```

运行 `cargo fetch` 会直接报错：

```
package depends on `bevy` with feature `multi-threaded`
but `bevy` does not have that feature.
help: there is a feature `multi_threaded` with a similar name
```

按照提示修改即可。

### 3. 诊断插件 feature 改了名

```toml
# 0.13
"bevy_diagnostic",   # ❌ 0.14 没这个 feature
0.14
"bevy_dev_tools",    # ✅ FrameTimeDiagnosticsPlugin 跟着这个来
```

报错会列出全部可用 feature，从里面挑选即可。

### 4. 显式加 bevy_state / bevy_app 依赖

这是 `default-features = false` 项目的专属坑——详见下一节。

## 三、State API：最大的坑

### 症状

升级后一编译就刷出一屏幕错误：

```
error: cannot find derive macro `States` in this scope
error[E0425]: cannot find type `NextState` in this scope
error[E0425]: cannot find function `in_state` in this scope
error[E0425]: cannot find `OnEnter` / `OnExit`
error[E0599]: no method named `init_state` found for `&mut App`
error[E0599]: no method named `enable_state` found for `&mut App`
```

### 根因

0.14 把 state 系统**移出了 `bevy::prelude`**，迁移到了独立的 crate `bevy_state`。`bevy` 通过 `bevy_internal` 重命名 re-export：

```rust
// bevy_internal/src/lib.rs
#[cfg(feature = "bevy_state")]
pub use bevy_state as state;
```

所以 `bevy::state` 这条路径**理论上还在**，但需要开启 `bevy_state` feature。而我们使用了 `default-features = false`，默认的 feature 集被砍掉了——0.13 时 state 跟着 prelude 走，0.14 必须显式开启。

### 解法（三步）

**第一步：Cargo.toml 开 feature + 加依赖**

```toml
bevy = { version = "0.14", default-features = false, features = [
    ...,
    "bevy_state",   # 激活 bevy::state re-export
] }
单开 bevy_state feature 还不够，AppExtStates（含 init_state）在 bevy_state::app 里，
它 use bevy_app::{App, ...}。所以要把 bevy_app 也拉进依赖图。
bevy_state = "0.14"
bevy_app = "0.14"
```

**第二步：import 路径全部改走 `bevy_state`**

```rust
// ❌ 0.13：靠 prelude 自动可用
#[derive(States, Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum GameState { ... }
.add_systems(OnEnter(GameState::Playing), ...)
.add_systems(Update, foo.run_if(in_state(GameState::Playing)))
.next_state.set(GameState::GameOver);
```

```rust
// ✅ 0.14：全部 explicit import
use bevy_state::app::AppExtStates;          // 含 init_state
use bevy_state::state::{OnEnter, OnExit, States, NextState};
use bevy_state::condition::in_state;
```

每个用到 `NextState` 的文件都要加一行：

```rust
use bevy_state::state::NextState;
```

**第三步：删掉 `enable_state` 调用**

```rust
// ❌ 0.13 写法
.init_state::<>()
.enable_state::<>()   // 0.14 砍了这方法
```

```rust
// ✅ 0.14：init_state 单独够用（内部已 setup transitions）
.init_state::<>()
```

#### 验证路径是否正确的最小用例

升级时我先在 `/tmp` 里创建一个小的 cargo 项目验证 import 路径，再回主项目修改：

```rust
use bevy::prelude::*;
use bevy_state::app::AppExtStates;
use bevy_state::state::{OnEnter, OnExit, States, NextState};
use bevy_state::condition::in_state;
#[derive(States, Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum S { #[default] A, B }
fn main() {
    App::new()
        .init_state::<S>()
        .add_systems(OnEnter(S::A), || {})
        .add_systems(OnExit(S::A), || {})
        .add_systems(Update, (|| {}).run_if(in_state(S::A)))
        .run();
}
```

运行 `cargo check` 通过后再回主项目批量修改——比直接在主项目里试错快得多。

#### AppExtStates 的可用方法（0.14）

`enable_state` 被砍掉之后，我查阅了 `bevy_state::app::AppExtStates` 的完整方法表，确认 0.14 只剩这些：

| 方法 | 用途 |
|---|---|
| `init_state::<S>()` | 初始化一个 State（取代 0.13 的 init_state + enable_state 组合）|
| `insert_state::<S>(state)` | 初始化并设初值 |
| `add_computed_state::<S>()` | 计算状态 |
| `add_sub_state::<S>()` | 子状态 |
| `enable_state_scoped_entities::<S>()` | state scoped entity 自动清理 |

## 四、Mesh::from(shape::Circle) 的 shape 模块消失

### 症状

```
error[E0433]: cannot find module or crate `shape` in this scope
```

### 根因

0.13 的 `bevy::sprite::shape::Circle { radius, vertices }` 在 0.14 被移走了。0.14 把几何图元迁移到了 `bevy_math::primitives`，且 `Circle` 结构体**砍掉了 `vertices` 字段**，只剩 `radius`：

```rust
// bevy_math 0.14
pub struct Circle {
    pub radius: f32,
}
```

### 解法

```rust
// ❌ 0.13
use bevy::prelude::*;  // shape 跟着 prelude 走
let mesh = meshes.add(Mesh::from(shape::Circle { radius: 32.0, vertices: 32 }));
// ✅ 0.14：显式 import + 去掉 vertices 字段
use bevy::math::primitives::Circle;
let mesh = meshes.add(Mesh::from(Circle { radius: 32.0 }));
// From for Mesh 仍存在，默认 32 分辨率
```

如果想要自定义分辨率，用 builder 链：

```rust
use bevy::math::primitives::Circle;
use bevy::render::mesh::primitives::Meshable;  // trait .mesh()
let mesh = meshes.add(Circle { radius: 32.0 }.mesh().resolution(64).build());
```

## 五、Color 分量访问：.r() .g() .b() .a() 全砍

### 症状

```
error[E0599]: no method named `r` found for struct `Color` in the current scope
error[E0599]: no method named `g` found for struct `Color` in the current scope
error[E0599]: no method named `b` found for struct `Color` in the current scope
error[E0599]: no method named `a` found for struct `Color` in the current scope
```

### 根因

0.13 的 `Color` 提供了 `.r()`, `.g()`, `.b()`, `.a()` 等 getter 方法。0.14 将这些方法全部移除，改为直接访问结构体字段。

### 解法

```rust
// ❌ 0.13
let color = Color::rgb(0.5, 0.2, 0.8);
let red = color.r();
let alpha = color.a();
// ✅ 0.14：直接访问字段
let color = Color::rgb(0.5, 0.2, 0.8);
let red = color.r;
let alpha = color.a;
```

注意：`Color` 的字段是公开的，可以直接读写。

## 六、其他常见变更与修复

### 1. 输入系统：KeyCode 枚举成员重命名

部分 `KeyCode` 枚举成员在 0.14 中被重命名，以符合更标准的命名约定。

```rust
// ❌ 0.13
KeyCode::LControl
KeyCode::RControl
// ✅ 0.14
KeyCode::ControlLeft
KeyCode::ControlRight
```

类似的重命名也适用于其他修饰键（Shift, Alt, Meta/Command）。编译器会给出明确的错误提示，按照提示修改即可。

### 2. 精灵图集（TextureAtlas）布局 API 变更

创建 `TextureAtlas` 的 API 有所调整。

```rust
// ❌ 0.13
let atlas = TextureAtlas::from_grid(
    texture_handle,
    Vec2::new(16.0, 16.0),
    4,
    4,
    None,
    None,
);
// ✅ 0.14
let atlas = TextureAtlas::from_grid(
    texture_handle,
    Vec2::new(16.0, 16.0),
    4,
    4,
    None,
    None,
    false, // 新增参数：是否填充空白区域
);
```

### 3. 相机投影（CameraProjection）相关变更

如果使用了自定义相机投影，可能需要更新 trait 实现。

```rust
// ❌ 0.13
impl CameraProjection for MyProjection {
    fn get_projection_matrix(&self) -> Mat4 { ... }
    fn update(&mut self, width: f32, height: f32) { ... }
    fn far(&self) -> f32 { ... }
    // ...
}
// ✅ 0.14
impl CameraProjection for MyProjection {
    fn get_projection_matrix(&self) -> Mat4 { ... }
    fn update(&mut self, width: f32, height: f32) { ... }
    // far 等方法可能已被移除或移至其他 trait，请查阅最新文档。
}
```

## 七、升级后补充模块：调试控制台与剧本系统

在成功升级到 Bevy 0.14 后，我顺手将项目中从 Python 原型迁移过来的两个核心模块进行了 Rust 重写和集成。

### 1. 调试控制台（Debug Console）

一个简单的内嵌式命令行界面，用于在游戏运行时执行命令、修改变量、打印状态。

```rust
// 主要功能
// - 按 ` 键呼出/隐藏控制台
// - 支持基本命令：spawn, teleport, godmode, fps
// - 命令历史与自动补全
// - 输出日志滚动显示
```

### 2. 剧本系统（Script System）

一个基于事件的轻量级叙事与任务系统，用于驱动游戏剧情和角色对话。

```rust
// 核心组件
#[derive(Component)]
pub struct Script {
    pub id: String,
    pub triggers: Vec<Trigger>,
    pub actions: Vec<Action>,
}
// 事件驱动
pub struct ScriptEvent {
    pub script_id: String,
    pub params: HashMap<String, String>,
}
```

这两个模块的加入显著提升了项目的可调试性和内容创作灵活性。

## 八、总结

从 Bevy 0.13 升级到 0.14 主要挑战在于 State API 的抽离和一系列破坏性命名变更。关键步骤总结如下：

1. **修改 Cargo.toml**：更新版本号，修正 feature 名称（如 `multi_threaded`），并显式添加 `bevy_state` 和 `bevy_app` 依赖。
2. **重构 State 相关代码**：将所有 `States`, `NextState`, `OnEnter`, `OnExit`, `in_state` 的导入路径改为 `bevy_state::*`，并移除 `enable_state` 调用。
3. **更新几何图元**：将 `shape::Circle` 等替换为 `bevy::math::primitives::Circle`，注意字段变化。
4. **修正 Color 访问**：将 `.r()` 等方法调用改为直接字段访问 `.r`。
5. **处理其他 API 变更**：如 `KeyCode` 重命名、`TextureAtlas` API 变更等。

升级过程虽然繁琐，但 0.14 在 macOS 上的稳定性提升是值得的。建议在升级前，在一个独立的小项目中验证关键变更，再回到主项目进行系统性的修改。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/rust-bevy-0.13-to-0.14-upgrade-guide.html
