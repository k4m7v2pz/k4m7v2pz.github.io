<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Bevy 0.14 光标踩坑全记录

> **环境：** Bevy 0.14.2 + macOS Retina

本项目（rust-bevy-mighty-rodent）光标系统开发过程中踩的坑，按发现时序整理，供日后维护和他项目复刻参考。

## 坑 1：系统光标藏不掉

**现象：** 自绘 sprite 光标渲染了，但 macOS 默认黑边白光标仍可见，两个光标叠一起。

**根因：** Bevy 0.14 的 `CursorIcon` 枚举**没有 `None` 变体**——不能通过设 `Cursor::icon` 藏掉系统光标。旧认知以为只能靠自绘 sprite z=100 盖住，但 UI 层独立渲染会盖住 sprite（见坑 4）。

**解法：** Bevy 0.14 的 `Cursor` struct 有个 `visible: bool` 字段，设 `false` 就藏掉系统光标。

```rust
// ✅ 正确：Cursor.visible=false 藏系统光标
cursor: Cursor {
    visible: false,
    icon: CursorIcon::Default,  // CursorIcon 无 None 变体，这行只是占位
    ..default()
},
```

```rust
// ❌ 错误：CursorIcon 没有 None 变体
cursor: Cursor { icon: CursorIcon::None, ..default() }  // 编译不过
```

## 坑 2：光标 sprite 渲染了但看不见

**现象：** `spawn_cursor_sprite` spawn 了 `SpriteBundle`（z=100），日志确认 sprite 跟鼠标走，但游戏窗口里看不见光标。按钮高亮能触发说明鼠标坐标是真有值的。

**根因：** **Bevy UI 渲染层独立盖在所有 2D sprite 之上**。`SpriteBundle` z=100 在 2D sprite 层最高，但 UI 层（菜单框、面板等 `NodeBundle`）独立渲染盖住所有 sprite。主菜单的 `MenuRoot` 是 `NodeBundle` 占 100%×100%，正好盖住整个光标 sprite。

**解法：** 光标也用 UI 节点（`ImageBundle`），与菜单同在 UI 渲染层，靠 `ZIndex::Global(999)` 盖住其他 UI 节点。

```rust
// ✅ 正确：UI 节点同渲染层，ZIndex::Global 盖住菜单
commands.spawn((
    ImageBundle {
        style: Style {
            position_type: PositionType::Absolute,
            width: Val::Px(64.0),
            height: Val::Px(64.0),
            ..default()
        },
        image: UiImage::new(cursor_handle),
        z_index: ZIndex::Global(999),  // 确保在 UI 最上层
        ..default()
    },
    CursorSprite,  // 自定义标记组件
));
```

## 坑 3：光标位置更新用 `EventReader<CursorMoved>` 在 UI 层不工作

**现象：** 用 `CursorMoved` 事件更新光标位置，但在游戏场景中光标不动。

**根因：** `CursorMoved` 事件只在窗口层面上报鼠标位置，但如果你在 UI 层用 `ImageBundle` 渲染光标，需要同时更新 `Style.left` 和 `Style.top`。

**解法：** 使用 `CursorMoved` 事件读取坐标，然后更新 UI 节点的 `Style`：

```rust
fn update_cursor(
    mut cursor_query: Query<&mut Style, With<CursorSprite>>,
    mut cursor_events: EventReader<CursorMoved>,
) {
    for event in cursor_events.read() {
        if let Ok(mut style) = cursor_query.get_single_mut() {
            style.left = Val::Px(event.position.x);
            style.top = Val::Px(event.position.y);
        }
    }
}
```

## 坑 4：macOS Retina 的像素比例

**现象：** 光标位置在 macOS Retina 屏幕上偏了，鼠标在屏幕左上角时光标在左上角，但移到右下角时光标只能到屏幕中心位置。

**根因：** `CursorMoved` 事件返回的是**物理像素坐标**，而 UI 节点的 `Val::Px` 使用的是**逻辑像素坐标**。macOS Retina 的缩放比例是 2.0（`scale_factor`）。

**解法：** 在更新光标位置时，除以窗口的缩放比例：

```rust
fn update_cursor(
    mut cursor_query: Query<&mut Style, With<CursorSprite>>,
    mut cursor_events: EventReader<CursorMoved>,
    windows: Query<&Window>,
) {
    let window = windows.single();
    let scale = window.scale_factor();
    for event in cursor_events.read() {
        if let Ok(mut style) = cursor_query.get_single_mut() {
            style.left = Val::Px(event.position.x / scale);
            style.top = Val::Px(event.position.y / scale);
        }
    }
}
```

## 坑 5：光标在游戏场景中消失

**现象：** 从主菜单进入游戏场景后，之前 spawn 的光标实体还在，但看不见了。

**根因：** 光标实体是在主菜单场景中 spawn 的，进入游戏场景后，主菜单场景的实体被 despawn。光标实体需要跨场景保留。

**解法：** 使用 Bevy 的 State 模式，将光标实体放在全局（不依赖场景的）系统组中，或者在场景切换时重新 spawn 光标。

## 总结

| 坑 | 现象 | 根因 | 修复 |
|----|------|------|------|
| 1 | 两个光标叠一起 | `CursorIcon` 无 `None` 变体 | 用 `Cursor.visible=false` |
| 2 | 光标 sprite 看不见 | UI 层盖住 2D sprite | 改用 `ImageBundle` + `ZIndex::Global` |
| 3 | 光标位置不动 | 用了 `CursorMoved` 但没更新 UI Style | 更新 `Style.left` / `Style.top` |
| 4 | Retina 上位置偏移 | 物理像素 vs 逻辑像素 | 除以 `scale_factor` |
| 5 | 切场景后光标消失 | 场景 despawn 实体 | 跨场景保留或重新 spawn |
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/bevy-0.14-cursor-pitfalls.html
