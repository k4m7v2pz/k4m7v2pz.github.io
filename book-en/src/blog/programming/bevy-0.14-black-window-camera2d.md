# Bevy 0.14 Black Window Troubleshooting: Camera2d Is Just a Marker Component, spawn Camera2d Won't Create a Camera

> Date: 2026-08-05

### One. Problem Phenomenon: Window Is Pure Black but the Program Runs Normally

When developing a 2D physics demo with Bevy 0.14.2 + avian2d 0.1.2, you may encounter a confusing phenomenon:

- **After the window pops up, the entire screen is pure black**, not even the configured dark gray background `ClearColor(Color::srgb(0.10, 0.10, 0.12))` is shown
- Mashing the keyboard and clicking the mouse randomly has no effect on the screen
- But the program **doesn't crash, doesn't report errors**, and ECS logic runs normally
- Entities are generated normally (e.g., the emote entity adds 24 new ones every 2 seconds)
- Physics simulation is normal (y coordinate drops from -200 to -326, piling up at the bottom)
- Resource loading is normal (sprite textures queried via `AssetServer::get_load_state` all return `Loaded`)

This is the most deceiving part: **logic, physics, and resource loading are all normal, but the screen is black**.

### Two. Root Cause: Bevy 0.14's Camera2d Is Just a Marker Component

A large number of online tutorials (especially articles from the 0.13 / 0.15 era) claim:

> "Starting from Bevy 0.13, Bundles are deprecated; just `spawn(Camera2d)` directly."

This statement **only holds for Bevy 0.15 and later**.

#### Version Difference Comparison

| Bevy version | `Camera2d` component behavior | How to create a camera |
|---|---|---|
| 0.13 and before | Bundle form: `Camera2dBundle` | `commands.spawn(Camera2dBundle::default())` |
| **0.14** | **Plain marker component**, no required components | `spawn(Camera2d)` produces a **shell entity** |
| 0.15 and later | Auto-completed via `#[require(Camera, Transform, ...)]` | `spawn(Camera2d)` works normally |

In **Bevy 0.14, `Camera2d` is just a plain marker component**:

```rust
// Camera2d definition in Bevy 0.14
#[derive(Component, Default, Debug, Clone, Copy)]
pub struct Camera2d;
```

`spawn(Camera2d)` only produces a shell entity with an isolated `Camera2d` marker, **without a `Camera` component, without a `Transform`, without a projection**. There's no real camera in the world, so no view executes clear and draw——the output buffer stays all black.

Root cause in one sentence: **0.14 has no required components; the component won't "grow" into a camera on its own.**

### Three. Source Code Verification: Three Layers of Evidence Lock Down the Root Cause

#### Evidence 1: All Official Examples Use Bundles

The camera spawn writing in Bevy 0.14.2's official examples (2D directory):

```bash
grep -rn 'spawn(Camera2d\|Camera2dBundle' bevy-0.14.2/examples/2d/*.rs
```

Result: `2d_shapes.rs`, `mesh2d_manual.rs`, `bounding_2d.rs`, and over a dozen other examples are **without exception**:

```rust
commands.spawn(Camera2dBundle::default());
```

Not a single example uses `spawn(Camera2d)`.

#### Evidence 2: Camera2d Has No Required Components in 0.14 Source

```bash
grep -rn 'pub struct Camera2d' bevy_camera-0.14*/src/
```

No output. The 0.14 `Camera2d` component definition has no `#[require(...)]` (that mechanism only landed in 0.15).

#### Evidence 3: Decisive Experiment——Screenshot Pixels 100% Pure Black

Using Bevy 0.14's `ScreenshotManager` to capture a frame and save it to disk (note that 0.14 doesn't have `Image::save_to_disk`; you need `ScreenshotManager::save_screenshot_to_disk(window_entity, path)`):

```rust
// Capture a frame at 2 seconds
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

Obtained a 2560×1440 (Retina 2x) screenshot and parsed all pixels with Python:

- Total pixels 3,686,400;
- The background color should be dark gray (26,26,31), but the statistical result was **100% pure black (0,0,0)**, not even a single background pixel.

#### Threshold Rules

- **No camera in the world = no view = no one executes clear = the render buffer stays all black**; the ClearColor resource existing doesn't take effect either, because clear is executed by the camera's view;
- ECS logic scheduling (Update / FixedUpdate) and the render pipeline's extract-draw are **completely decoupled**; logic running normally doesn't mean rendering is drawing anything;
- A texture being `Loaded` only means the resource loaded successfully, unrelated to whether the screen has content.

#### Fix

```rust
// Change this line
commands.spawn(Camera2d);
// To
commands.spawn(Camera2dBundle::default());
```

One change, and the screen immediately works normally (background + sprites all visible, physics piling up as usual).

### Three. Solution: Manually Complete the Camera Component Tree

For Bevy 0.14, you need to manually create a complete camera entity:

#### Option 1: Use Camera2dBundle (Recommended)

```rust
use bevy::prelude::*;

fn setup_camera(mut commands: Commands) {
    commands.spawn(Camera2dBundle::default());
}
```

#### Option 2: Manually Assemble All Necessary Components

```rust
use bevy::prelude::*;

fn setup_camera(mut commands: Commands) {
    commands.spawn((
        Camera2d,
        Camera {
            // Set camera render order, etc.
            order: 0,
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
        GlobalTransform::default(),
        // 2D camera projection
        OrthographicProjection {
            scale: 1.0,
            near: -1000.0,
            far: 1000.0,
            ..default()
        },
        // Viewport configuration
        CameraRenderGraph::new(bevy::core_pipeline::core_2d::graph::NAME),
        Frustum::default(),
        Visibility::default(),
        ComputedVisibility::default(),
    ));
}
```

#### Option 3: Create a Custom Camera Spawning Function

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

### Four. Verify the Camera Is Working Properly

Add the following system to verify whether the camera was created correctly:

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

If the system outputs camera information, the camera was created successfully; if there's no output at all, the camera entity is still missing.

### Five. Common Pitfalls and Notes

- **Version confusion**: Make sure the tutorial you're referencing matches your Bevy version
- **Multiple cameras**: If you have multiple cameras, make sure their `Camera::order` is set correctly
- **Camera hierarchy**: Cameras can be attached to other entities, inheriting the parent entity's transform
- **Render graph**: 2D cameras use the `core_2d` render graph, 3D cameras use `core_3d`

### Six. Notes on Upgrading to Bevy 0.15+

If you plan to upgrade to Bevy 0.15 or higher:

1. `Camera2dBundle` is still available and recommended
2. `spawn(Camera2d)` now works normally (thanks to required components)
3. Watch out for API changes: `OrthographicProjection`'s default values may differ
4. Check your `Cargo.toml` dependency versions

### Seven. Summary

The root cause of the Bevy 0.14 pure-black window problem is: `Camera2d` is just a marker component, and `spawn(Camera2d)` won't automatically create a complete camera entity. The solution is to use `Camera2dBundle::default()` or manually assemble all necessary camera components.

Remember: in the Bevy ecosystem, **always check whether the version you're using matches the tutorial's version**—this is the key to avoiding these kinds of "mysterious bugs."

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/bevy-0.14-black-window-camera2d.html
