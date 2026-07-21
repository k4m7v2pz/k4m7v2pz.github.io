# Bevy 0.14 FPS Camera Pitfalls: From Black Screen to Pointer Lock to Child Entity Camera

> This article documents the real debugging chain of "cursor won't move, camera won't turn" when porting a Three.js FPS game to macOS with Rust + Bevy 0.14.

## Pitfall Chain Overview

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| ① | Black screen in game | No 3D camera | Spawn `Camera3dBundle` |
| ② | UI stacked at top-left | No parent-child nesting | Use `with_children` |
| ③ | Panic `index out of bounds` | Empty Vec in `InputState` | Initialize `vec![false; 256]` |
| ④ | Cursor won't move, camera won't turn | **`CursorMoved` stops firing after pointer lock** | Use `MouseMotion` events |
| ⑤ | yaw/pitch updates but screen doesn't rotate | Camera is a separate entity | Spawn camera as child of player |
| ⑥ | Buttons unresponsive | `Changed<Interaction>` filter misses events | Remove `Changed`, poll every frame |

## ④ Core Pitfall: CursorMoved Stops After Pointer Lock

**Symptom:** After entering the game scene with `CursorGrabMode::Locked`, mouse movement produces no camera rotation. Logs show no `MouseMotion` or `CursorMoved` events.

**Root cause:** When the pointer is locked, **`CursorMoved` events stop firing** because the OS no longer reports absolute cursor positions.

**Fix:** Use `MouseMotion` (DeviceEvent-level) which reports **relative mouse displacement** and is unaffected by pointer lock:

```rust
fn player_look(
    mut mouse_motion: EventReader<MouseMotion>,
    mut player_query: Query<&mut Player, With<PlayerFlag>>,
) {
    for motion in mouse_motion.read() {
        if let Ok(mut player) = player_query.get_single_mut() {
            player.yaw -= motion.delta.x * 0.003;
            player.pitch = (player.pitch - motion.delta.y * 0.003)
                .clamp(-1.54, 1.54);
        }
    }
}
```

## ⑤ Camera as Child Entity

**Fix:** Spawn the camera as a child of the player entity:

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
            transform: Transform::from_xyz(0.0, 1.6, 0.0),
            ..default()
        });
    });
}
```

## ⑥ Button Click Not Responding

**Fix:** Remove `Changed<Interaction>` filter, poll every frame:

```rust
fn button_handler(
    query: Query<(&Interaction, &Btn)>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    for (interaction, btn) in query.iter() {
        if *interaction == Interaction::Clicked {
            match btn {
                Btn::Start => next_state.set(GameState::Deploy),
                // ...
            }
        }
    }
}
```