---
title: Rust Bevy 0.13 to 0.14 Upgrade Guide
date: 2026-07-08
tags: [bevy, rust, game-development, upgrade-migration, macOS]
description: A complete guide to upgrading a Bevy 0.13 2D pixel game to 0.14, covering State API extraction, geometry primitive migration, Color access changes, and other breaking changes
categories: programming
---

> This article documents the complete process of upgrading a Bevy 0.13 2D pixel game to version 0.14. Version 0.14 is the most stable version on macOS (higher versions have black screen issues), so we're locking to this version. After the upgrade, two modules migrated from Python prototypes (debug console and script system) were also rewritten and integrated.

## 1. Why 0.14

- **macOS compatibility**: Versions 0.15+ have black screen issues on macOS; 0.14 is the most stable choice.
- **Breaking changes**: 0.13 → 0.14 has breaking API changes — you can't just bump the version number in Cargo.toml.

## 2. Three Changes in Cargo.toml

### 2.1 Version Number

```toml
# before
bevy = { version = "0.13", default-features = false, features = [...] }
after
bevy = { version = "0.14", default-features = false, features = [...] }
```

### 2.2 Feature Names Changed to Snake Case

```toml
# 0.13 used hyphen-case
"multi-threaded",
0.14 changed to snake_case
"multi_threaded",
```

Running `cargo fetch` will immediately error:

```
package depends on `bevy` with feature `multi-threaded`
but `bevy` does not have that feature.
help: there is a feature `multi_threaded` with a similar name
```

Just follow the hint and fix it.

### 2.3 Diagnostic Plugin Feature Renamed

```toml
# 0.13
"bevy_diagnostic",   # ❌ doesn't exist in 0.14
0.14
"bevy_dev_tools",    # ✅ FrameTimeDiagnosticsPlugin comes with this
```

The error output lists all available features — pick from there.

### 2.4 Explicit bevy_state / bevy_app Dependencies

This is a pain point specific to projects using `default-features = false` — see the next section.

## 3. State API: The Biggest Pitfall

### Symptoms

After upgrading, compilation floods with errors:

```
error: cannot find derive macro `States` in this scope
error[E0425]: cannot find type `NextState` in this scope
error[E0425]: cannot find function `in_state` in this scope
error[E0425]: cannot find `OnEnter` / `OnExit`
error[E0599]: no method named `init_state` found for `&mut App`
error[E0599]: no method named `enable_state` found for `&mut App`
```

### Root Cause

0.14 moved the state system **out of `bevy::prelude`** into a separate crate `bevy_state`. `bevy` re-exports it via `bevy_internal`:

```rust
// bevy_internal/src/lib.rs
#[cfg(feature = "bevy_state")]
pub use bevy_state as state;
```

So `bevy::state` **theoretically still exists**, but requires the `bevy_state` feature to be enabled. Since we used `default-features = false`, the default feature set is stripped — in 0.13 state came with prelude, in 0.14 it must be explicitly enabled.

### Solution (3 Steps)

**Step 1: Enable feature + add dependencies in Cargo.toml**

```toml
bevy = { version = "0.14", default-features = false, features = [
    ...,
    "bevy_state",   # activate bevy::state re-export
] }
Enabling just bevy_state isn't enough — AppExtStates (containing init_state) lives in bevy_state::app,
which uses bevy_app::{App, ...}. So bevy_app must also be in the dependency graph.
bevy_state = "0.14"
bevy_app = "0.14"
```

**Step 2: Update all imports to use `bevy_state`**

```rust
// ❌ 0.13: auto-available from prelude
#[derive(States, Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum GameState { ... }
.add_systems(OnEnter(GameState::Playing), ...)
.add_systems(Update, foo.run_if(in_state(GameState::Playing)))
.next_state.set(GameState::GameOver);
```

```rust
// ✅ 0.14: all explicit imports
use bevy_state::app::AppExtStates;          // contains init_state
use bevy_state::state::{OnEnter, OnExit, States, NextState};
use bevy_state::condition::in_state;
```

Every file using `NextState` needs:

```rust
use bevy_state::state::NextState;
```

**Step 3: Remove `enable_state` calls**

```rust
// ❌ 0.13 style
.init_state::<>()
.enable_state::<>()   // removed in 0.14
```

```rust
// ✅ 0.14: init_state alone is sufficient (transitions are set up internally)
.init_state::<>()
```

#### Minimal Verification Test

I created a small cargo project in `/tmp` to verify imports, then went back to the main project:

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

Run `cargo check` to verify, then apply changes to the main project — much faster than trial-and-error in the main project.

#### AppExtStates Available Methods (0.14)

After `enable_state` was removed, I checked the full method table of `bevy_state::app::AppExtStates`:

| Method | Purpose |
|---|---|
| `init_state::<S>()` | Initialize a State (replaces 0.13's init_state + enable_state combo) |
| `insert_state::<S>(state)` | Initialize with an initial value |
| `add_computed_state::<S>()` | Computed states |
| `add_sub_state::<S>()` | Sub-states |
| `enable_state_scoped_entities::<S>()` | Auto-cleanup of state-scoped entities |

## 4. Mesh::from(shape::Circle) — shape Module Disappeared

### Symptoms

```
error[E0433]: cannot find module or crate `shape` in this scope
```

### Root Cause

0.13's `bevy::sprite::shape::Circle { radius, vertices }` was removed in 0.14. Geometry primitives moved to `bevy_math::primitives`, and `Circle` **dropped the `vertices` field**, leaving only `radius`:

```rust
// bevy_math 0.14
pub struct Circle {
    pub radius: f32,
}
```

### Solution

```rust
// ❌ 0.13
use bevy::prelude::*;  // shape came with prelude
let mesh = meshes.add(Mesh::from(shape::Circle { radius: 32.0, vertices: 32 }));
// ✅ 0.14: explicit import + remove vertices field
use bevy::math::primitives::Circle;
let mesh = meshes.add(Mesh::from(Circle { radius: 32.0 }));
// From for Mesh still exists, default 32 resolution
```

For custom resolution, use the builder chain:

```rust
use bevy::math::primitives::Circle;
use bevy::render::mesh::primitives::Meshable;  // trait .mesh()
let mesh = meshes.add(Circle { radius: 32.0 }.mesh().resolution(64).build());
```

## 5. Color Component Access: .r() .g() .b() .a() All Removed

### Symptoms

```
error[E0599]: no method named `r` found for struct `Color` in the current scope
error[E0599]: no method named `g` found for struct `Color` in the current scope
error[E0599]: no method named `b` found for struct `Color` in the current scope
error[E0599]: no method named `a` found for struct `Color` in the current scope
```

### Root Cause

0.13's `Color` had `.r()`, `.g()`, `.b()`, `.a()` getter methods. 0.14 removed them all in favor of direct struct field access.

### Solution

```rust
// ❌ 0.13
let color = Color::rgb(0.5, 0.2, 0.8);
let red = color.r();
let alpha = color.a();
// ✅ 0.14: direct field access
let color = Color::rgb(0.5, 0.2, 0.8);
let red = color.r;
let alpha = color.a;
```

Note: `Color`'s fields are public and can be read/written directly.

## 6. Other Common Changes

### 6.1 Input System: KeyCode Enum Variants Renamed

Some `KeyCode` enum variants were renamed in 0.14 to comply with more standard naming conventions.

```rust
// ❌ 0.13
KeyCode::LControl
KeyCode::RControl
// ✅ 0.14
KeyCode::ControlLeft
KeyCode::ControlRight
```

Similar renames apply to other modifier keys (Shift, Alt, Meta/Command). The compiler gives clear error messages — just follow them.

### 6.2 TextureAtlas Layout API Changed

The API for creating `TextureAtlas` was adjusted.

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
    false, // new parameter: whether to fill blank areas
);
```

### 6.3 CameraProjection Changes

If using custom camera projection, the trait implementation may need updating.

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
    // far and other methods may be removed or moved to another trait
}
```

## 7. Post-Upgrade Modules: Debug Console & Script System

After successfully upgrading to Bevy 0.14, I rewrote and integrated two core modules that were originally Python prototypes.

### 7.1 Debug Console

A simple embedded command-line interface for executing commands, modifying variables, and printing state at runtime.

```rust
// Key features
// - Press ` key to show/hide console
// - Basic commands: spawn, teleport, godmode, fps
// - Command history and auto-completion
// - Scrollable output log
```

### 7.2 Script System

An event-driven lightweight narrative and quest system for driving game story and character dialogue.

```rust
// Core component
#[derive(Component)]
pub struct Script {
    pub id: String,
    pub triggers: Vec<Trigger>,
    pub actions: Vec<Action>,
}
// Event-driven
pub struct ScriptEvent {
    pub script_id: String,
    pub params: HashMap<String, String>,
}
```

These two modules significantly improved the project's debuggability and content creation flexibility.

## 8. Summary

The main challenges in upgrading from Bevy 0.13 to 0.14 are the extraction of the State API and a series of breaking naming changes. Key steps:

1. **Modify Cargo.toml**: Update version number, fix feature names (e.g. `multi_threaded`), and explicitly add `bevy_state` and `bevy_app` dependencies.
2. **Refactor State code**: Change all imports of `States`, `NextState`, `OnEnter`, `OnExit`, `in_state` to `bevy_state::*` and remove `enable_state` calls.
3. **Update geometry primitives**: Replace `shape::Circle` etc. with `bevy::math::primitives::Circle`, noting field changes.
4. **Fix Color access**: Change method calls like `.r()` to direct field access `.r`.
5. **Handle other API changes**: Such as `KeyCode` renames, `TextureAtlas` API changes, etc.

The upgrade process is tedious, but the stability improvement on macOS with 0.14 is worth it. It's recommended to verify key changes in a small isolated project first, then apply systematic changes to the main project.

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/rust-bevy-0.13-to-0.14-upgrade-guide.html
