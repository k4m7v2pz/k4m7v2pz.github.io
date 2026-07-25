# Bevy 0.14 Cursor Pitfalls: Complete Log

> **Environment:** Bevy 0.14.2 + macOS Retina

Cursor system pitfalls encountered during development of the rust-bevy-mighty-rodent project, logged by discovery order.

## Pitfall 1: System Cursor Won't Hide

**Symptom:** Custom sprite cursor renders, but the macOS default cursor is still visible — two cursors overlap.

**Root cause:** Bevy 0.14's `CursorIcon` enum has **no `None` variant**. You can't hide the system cursor via `Cursor::icon`.

**Fix:** Set `Cursor.visible = false`:

```rust
cursor: Cursor {
    visible: false,
    icon: CursorIcon::Default,
    ..default()
},
```

## Pitfall 2: Cursor Sprite Renders but Is Invisible

**Symptom:** The cursor sprite spawns (z=100) and logs confirm it follows the mouse, but it's not visible in the game window.

**Root cause:** **Bevy's UI layer renders independently on top of all 2D sprites.** A `SpriteBundle` at z=100 sits within the 2D sprite layer, but the UI layer (`NodeBundle` menus) covers everything.

**Fix:** Use `ImageBundle` (UI node) with `ZIndex::Global(999)`:

```rust
commands.spawn((
    ImageBundle {
        style: Style {
            position_type: PositionType::Absolute,
            width: Val::Px(64.0),
            height: Val::Px(64.0),
            ..default()
        },
        image: UiImage::new(cursor_handle),
        z_index: ZIndex::Global(999),
        ..default()
    },
    CursorSprite,
));
```

## Pitfall 3: CursorMoved Doesn't Update UI Position

**Fix:** Update `Style.left` and `Style.top` from `CursorMoved` events.

## Pitfall 4: macOS Retina Pixel Ratio

**Symptom:** Cursor position is off on Retina displays — the cursor reaches only half the screen.

**Root cause:** `CursorMoved` returns **physical pixels**, but UI `Val::Px` uses **logical pixels**. Divide by `scale_factor`:

```rust
let scale = window.scale_factor();
style.left = Val::Px(event.position.x / scale);
style.top = Val::Px(event.position.y / scale);
```

## Pitfall 5: Cursor Disappears on Scene Transition

**Fix:** Use global entities (not scene-scoped) or re-spawn the cursor on scene entry.

## Summary

| Pitfall | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| 1 | Two cursors | `CursorIcon` has no `None` | `Cursor.visible=false` |
| 2 | Sprite invisible | UI layer covers sprites | `ImageBundle` + `ZIndex::Global` |
| 3 | Position stuck | Not updating UI Style | Update `Style.left`/`top` |
| 4 | Retina offset | Physical vs logical pixels | Divide by `scale_factor` |
| 5 | Lost on scene switch | Scene despawns entities | Re-spawn or keep global |

---
<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/bevy-0.14-cursor-pitfalls.html
