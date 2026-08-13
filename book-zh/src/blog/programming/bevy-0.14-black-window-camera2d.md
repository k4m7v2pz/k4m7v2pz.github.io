<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Bevy 0.14 窗口纯黑问题排查：Camera2d 只是标记组件，spawn Camera2d 不会创建相机

> 日期：2026-08-05

### 一、问题现象：窗口纯黑但程序正常运行

在使用 Bevy 0.14.2 + avian2d 0.1.2 开发 2D 物理演示时，你可能会遇到一个令人困惑的现象：

- **窗口弹出后整个画面纯黑**，连设置好的深灰背景 `ClearColor(Color::srgb(0.10, 0.10, 0.12))` 都没有显示
- 乱按键盘、乱点鼠标，画面毫无变化
- 但程序**没有崩溃、没有报错**，ECS 逻辑照常运行
- 实体正常生成（如表情实体每 2 秒新增 24 个）
- 物理模拟正常（y 坐标从 -200 降到 -326 堆在底部）
- 资源加载正常（精灵纹理经 `AssetServer::get_load_state` 查询全部返回 `Loaded`）

这就是最迷惑人的地方：**逻辑、物理、资源加载全正常，唯独画面是黑的**。

### 二、根本原因：Bevy 0.14 的 Camera2d 只是一个标记组件

网上大量教程（尤其是 0.13 / 0.15 时代的文章）宣称：

> "Bevy 0.13 起 Bundle 已废弃，直接 `spawn(Camera2d)` 就行。"

这个说法**只对 Bevy 0.15 及以后成立**。

#### 版本差异对比

| Bevy 版本 | `Camera2d` 组件行为 | 创建相机的方式 |
|---|---|---|
| 0.13 及之前 | Bundle 形式：`Camera2dBundle` | `commands.spawn(Camera2dBundle::default())` |
| **0.14** | **普通标记组件**，没有 required components | `spawn(Camera2d)` 会生成**空壳实体** |
| 0.15 及以后 | 通过 `#[require(Camera, Transform, ...)]` 自动补全 | `spawn(Camera2d)` 可以正常工作 |

在 **Bevy 0.14 里，`Camera2d` 只是一个普通标记组件**：

```rust
// Bevy 0.14 中的 Camera2d 定义
#[derive(Component, Default, Debug, Clone, Copy)]
pub struct Camera2d;
```

`spawn(Camera2d)` 只会生成一个带孤立 `Camera2d` 标记的空壳实体，**没有 `Camera` 组件、没有 `Transform`、没有投影**。世界里没有任何真正的相机，也就没有任何视图执行 clear 与绘制——输出缓冲保持全黑。

一句话根因：**0.14 没有 required components，组件不会自己"长"成相机。**

### 三、源码验证：三层证据锁定根因

#### 证据 1：官方示例全部用 Bundle

Bevy 0.14.2 官方 examples（2D 目录）中相机的 spawn 写法：

```bash
grep -rn 'spawn(Camera2d\|Camera2dBundle' bevy-0.14.2/examples/2d/*.rs
```

结果：`2d_shapes.rs`、`mesh2d_manual.rs`、`bounding_2d.rs` 等十余个示例**无一例外**都是：

```rust
commands.spawn(Camera2dBundle::default());
```

没有任何一个示例用 `spawn(Camera2d)`。

#### 证据 2：0.14 源码里 Camera2d 没有 required components

```bash
grep -rn 'pub struct Camera2d' bevy_camera-0.14*/src/
```

无输出。0.14 的 `Camera2d` 组件定义上没有任何 `#[require(...)]`（该机制 0.15 才落地）。

#### 证据 3：决定性实验——截图像素 100% 纯黑

用 Bevy 0.14 的 `ScreenshotManager` 截一帧存盘（注意 0.14 没有 `Image::save_to_disk`，要用 `ScreenshotManager::save_screenshot_to_disk(window_entity, path)`）：

```rust
// 截一帧 at 2 seconds
fn debug_screenshot(
    time: Res<Time>,
    mut armed: Local<bool>,
    mut mgr: ResMut<ScreenshotManager>,
    window: Query<Entity, With<Window>>,
) {
    if !*armed && time.elapsed_seconds() >= 2.0 {
        *armed = true;
        let win = window.single(); // 0.14's single() directly returns Entity
        let _ = mgr.save_screenshot_to_disk(win, "/tmp/emote_shot.png");
    }
}
```

得到 2560×1440（Retina 2x）截图，用 Python 解析全部像素：

- 总像素 3,686,400；
- 背景色应为深灰 (26,26,31)，但统计结果 **100% 是纯黑 (0,0,0)**，连一个背景像素都没有。

#### 阈值规则

- 世界中**没有相机 = 没有视图 = 没有人执行 clear = 渲染缓冲保持全黑**；ClearColor 资源存在也不生效，因为 clear 由相机的视图执行；
- ECS 逻辑调度（Update / FixedUpdate）与渲染管线的提取-绘制**完全解耦**，逻辑照跑不代表渲染在画东西；
- 纹理 `Loaded` 只说明资源加载成功，与画面是否有内容无关。

#### 修复

```rust
// 把这一行
commands.spawn(Camera2d);
// 改成
commands.spawn(Camera2dBundle::default());
```

一处改动，画面立即正常（背景 + 精灵全部可见，物理堆积照常）。

### 三、解决方案：手动补全相机组件树

针对 Bevy 0.14，你需要手动创建完整的相机实体：

#### 方案 1：使用 Camera2dBundle（推荐）

```rust
use bevy::prelude::*;

fn setup_camera(mut commands: Commands) {
    commands.spawn(Camera2dBundle::default());
}
```

#### 方案 2：手动组装所有必要组件

```rust
use bevy::prelude::*;

fn setup_camera(mut commands: Commands) {
    commands.spawn((
        Camera2d,
        Camera {
            // 设置相机渲染顺序等
            order: 0,
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
        GlobalTransform::default(),
        // 2D 相机投影
        OrthographicProjection {
            scale: 1.0,
            near: -1000.0,
            far: 1000.0,
            ..default()
        },
        // 视口配置
        CameraRenderGraph::new(bevy::core_pipeline::core_2d::graph::NAME),
        Frustum::default(),
        Visibility::default(),
        ComputedVisibility::default(),
    ));
}
```

#### 方案 3：创建自定义相机生成函数

```rust
use bevy::prelude::*;

fn spawn_2d_camera(commands: &mut Commands, position: Vec3) -> Entity {
    commands
        .spawn((
            Camera2d,
            Camera::default(),
            Transform::from_translation(position),
            GlobalTransform::default(),
            OrthographicProjection::default_2d(),
            CameraRenderGraph::new(bevy::core_pipeline::core_2d::graph::NAME),
            Frustum::default(),
            Visibility::default(),
            ComputedVisibility::default(),
        ))
        .id()
}
```

### 四、验证相机是否正常工作

添加以下系统来验证相机是否正确创建：

```rust
use bevy::prelude::*;

fn debug_camera(query: Query<(&Camera, &Transform, &Camera2d)>) {
    for (camera, transform, _) in query.iter() {
        println!(
            "Camera found: order={}, position={:?}",
            camera.order, transform.translation
        );
    }
}
```

如果系统输出相机信息，说明相机创建成功；如果没有任何输出，说明相机实体仍然缺失。

### 五、常见陷阱与注意事项

- **版本混淆**：确保你参考的教程与你的 Bevy 版本匹配
- **多个相机**：如果有多个相机，确保它们的 `Camera::order` 设置正确
- **相机层级**：相机可以附加到其他实体上，继承父实体的变换
- **渲染图**：2D 相机使用 `core_2d` 渲染图，3D 相机使用 `core_3d`

### 六、升级到 Bevy 0.15+ 的注意事项

如果你计划升级到 Bevy 0.15 或更高版本：

1. `Camera2dBundle` 仍然可用且推荐使用
2. `spawn(Camera2d)` 现在可以正常工作（得益于 required components）
3. 注意 API 变化：`OrthographicProjection` 的默认值可能不同
4. 检查你的 `Cargo.toml` 依赖版本

### 七、总结

Bevy 0.14 窗口纯黑问题的根本原因是：`Camera2d` 只是一个标记组件，`spawn(Camera2d)` 不会自动创建完整的相机实体。解决方案是使用 `Camera2dBundle::default()` 或手动组装所有必要的相机组件。

记住：在 Bevy 生态中，**始终检查你使用的版本与教程的版本是否匹配**，这是避免这类"神秘 bug"的关键。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/bevy-0.14-black-window-camera2d.html
