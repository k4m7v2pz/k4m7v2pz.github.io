# Bevy 0.14 第一人称转视角踩坑全记：从黑屏到指针锁定到子实体相机

> 本文记录用 Rust + Bevy 0.14 移植一个 Three.js FPS 游戏到 macOS 时，"光标动不了、视角也不转"这一连串问题的真实排查链。每个坑都附最小复现代码与根因。

## 项目背景

原作是一个 Electron + Three.js 的 12v12 AI 对战 FPS（B 站 BV13UKP6mEdz，Kimi K3 生成战地游戏）。用 Rust + Bevy 0.14 重写，目标是 macOS 上能 `cargo run` 出一个能部署、走路、射击、AI 对战的 demo。骨架代码完成后，游戏能跑、主菜单能显示、点 START 能进入部署界面、选兵种点 DEPLOY 能进入游戏场景。但进了游戏就出现——**光标动不了，视角也不转**。

## 踩坑链条总览

| 坑号 | 现象 | 根因 | 修复 |
|------|------|------|------|
| ① | 进游戏全黑屏 | 没有 3D 相机渲染世界 | `Startup` 里 spawn `Camera3dBundle` |
| ② | UI 全叠在左上角 | UI 元素没有父子层级嵌套，都默认绝对定位到原点 | 改用 `with_children` 嵌套 |
| ③ | 进游戏 panic `index out of bounds` | `InputState` 的 Vec 用 `Default` 是空，`clear()` 后索引越界 | 初始化 `vec![false; 256]` |
| ④ | 光标动不了，视角也不转 | **指针锁定后 `CursorMoved` 事件不再触发** | 改用 `MouseMotion` 读取位移 |
| ⑤ | 视角 yaw/pitch 更新了但画面没转 | 3D 相机是独立实体，和玩家没关联 | 把相机作为玩家子实体 spawn |
| ⑥ | 按钮点击不响应 | `Changed<Interaction>` 过滤器在按钮切状态时漏事件 | 去掉 `Changed`，每帧轮询 |

## 坑 ①：进游戏全黑屏

**症状：** `cargo run` 后窗口弹出，主菜单能看到（说明 UI 相机在），但点 START → DEPLOY 进入游戏后画面全黑，只剩 UI 元素悬在黑色背景上。

**根因：** 游戏场景中没有 3D 相机。主菜单场景有 UI 相机（`Camera2dBundle`），但游戏场景需要 3D 相机来渲染 3D 世界。

**修复：** 在进入游戏场景时 spawn `Camera3dBundle`：

```rust
fn spawn_game_camera(mut commands: Commands) {
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 2.0, 5.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });
}
```

## 坑 ②：UI 全叠在左上角

**症状：** 进入游戏场景后，UI 元素（弹药显示、血量条等）全部挤在窗口左上角，没有任何布局。

**根因：** 所有 UI 元素都用 `PositionType::Absolute` 且没有设置 `left`/`top`，默认全部定位到原点 `(0, 0)`。

**修复：** 改用 `with_children` 实现父子层级嵌套，去掉绝对定位：

```rust
commands.spawn((
    NodeBundle {
        style: Style {
            width: Val::Percent(100.0),
            height: Val::Percent(100.0),
            flex_direction: FlexDirection::Column,
            ..default()
        },
        ..default()
    },
    GameUiRoot,
)).with_children(|parent| {
    parent.spawn((
        TextBundle::from_section("弹药: 30/30", TextStyle::default()),
        AmmoText,
    ));
    parent.spawn((
        TextBundle::from_section("HP: 100", TextStyle::default()),
        HpText,
    ));
});
```

## 坑 ③：进游戏 panic `index out of bounds`

**症状：** 点击 DEPLOY 按钮后，游戏直接崩溃，控制台输出 `index out of bounds`。

**根因：** `InputState` 的 `pressed_set: Vec<bool>` 用 `#[derive(Default)]` 初始化成一个空 Vec。在每帧更新时，`clear()` 后循环 `pressed_set[i] = false` 访问不存在的索引。

**修复：** 在 `Default` 实现中分配足够的容量：

```rust
#[derive(Resource)]
struct InputState {
    pressed_set: Vec<bool>,
    mouse_delta: Vec2,
}

impl Default for InputState {
    fn default() -> Self {
        Self {
            pressed_set: vec![false; 256],
            mouse_delta: Vec2::ZERO,
        }
    }
}
```

## 坑 ④：光标动不了，视角也不转（核心坑）

**症状：** 进入游戏场景后，鼠标移动时游戏画面没有任何反应。日志显示 `MouseMotion` 或 `CursorMoved` 事件没有被触发。

**根因：** 当使用 `CursorGrabMode::Locked` 锁定指针后，**`CursorMoved` 事件不再触发**。Bevy 0.14 在指针锁定模式下，操作系统不再报告光标的绝对位置变化，因此 `CursorMoved` 事件流停止。

**解法：** 改用 `MouseMotion` 事件（DeviceEvent 级），它读取的是鼠标的**相对位移**，不受指针锁定影响：

```rust
fn player_look(
    mut mouse_motion: EventReader<MouseMotion>,
    mut player_query: Query<&mut Player, With<PlayerFlag>>,
) {
    for motion in mouse_motion.read() {
        if let Ok(mut player) = player_query.get_single_mut() {
            player.yaw -= motion.delta.x * 0.003;
            player.pitch = (player.pitch - motion.delta.y * 0.003)
                .clamp(-1.54, 1.54);  // 限制俯仰角 ±90°
        }
    }
}
```

## 坑 ⑤：视角 yaw/pitch 更新了但画面没转

**症状：** 日志确认 `player.yaw` 和 `player.pitch` 在鼠标移动时更新了，但屏幕上的画面没有旋转。

**根因：** 3D 相机是在 `Startup` 系统里 spawn 的**独立实体**，和玩家实体没有任何关联。玩家实体的 `Transform` 旋转了，但相机的位置和朝向没变。

**修复：** 把相机作为玩家的子实体 spawn，这样相机自动跟随玩家的位置和旋转：

```rust
fn spawn_player(mut commands: Commands) {
    commands.spawn((
        PlayerFlag,
        SpatialBundle {
            transform: Transform::from_xyz(0.0, 0.0, 0.0),
            ..default()
        },
    )).with_children(|parent| {
        parent.spawn(Camera3dBundle {
            transform: Transform::from_xyz(0.0, 1.6, 0.0),  // 眼睛高度
            ..default()
        });
    });
}
```

## 坑 ⑥：按钮点击不响应

**症状：** SETTINGS 按钮、兵种卡片等点击后没有反应，但按钮样式确实有 hover 效果。

**根因：** 使用 `Query<(&Interaction, &Btn), Changed<Interaction>>` 时，`Changed` 过滤器在按钮从 `None` → `Hovered` 或 `Hovered` → `Clicked` 的状态转换中，由于实体 spawn/despawn 的时机问题，部分事件丢失。

**修复：** 去掉 `Changed<Interaction>` 过滤器，每帧轮询所有按钮的状态：

```rust
fn button_handler(
    query: Query<(&Interaction, &Btn)>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    for (interaction, btn) in query.iter() {
        if *interaction == Interaction::Clicked {
            match btn {
                Btn::Start => next_state.set(GameState::Deploy),
                Btn::Settings => next_state.set(GameState::Settings),
                // ...
            }
        }
    }
}
```
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/bevy-0.14-fps-camera-pitfalls.html
