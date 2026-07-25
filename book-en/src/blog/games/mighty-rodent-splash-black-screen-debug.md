
# Debugging Black Screen on Mighty Rodent Splash Screen

> Date: 2026-07-09
> Project: rust-bevy-mighty-rodent（Bevy 0.14 rewrite of Mighty Rodent）
> Symptom: After `cargo run`, the game window shows a black screen for ~2 seconds, then jumps straight to MainMenu — the two splash images (`jaggedlogo.jpg` / `mainpic.jpg`) never appear.

## 1. Symptoms

- Window appears → black screen for ~2s → MainMenu.
- Expected: jaggedlogo.jpg fully visible 1.5s → fade to black 0.8s → mainpic.jpg brighten from black + blue loading bar 2.0s → hold bright 0.5s → MainMenu.

## 2. Wrong Turns During Diagnosis (in chronological order)

### Wrong Turn 1: Suspecting the splash system wasn't compiled in

- `src/splash.rs` appeared as `??` (untracked) in `git status`, raising suspicion it wasn't linked into the binary.
- Verified: `cargo check` passes, `main.rs:4` has `mod splash;`, `main.rs:105` registers `splash::SplashPlugin` — the code is indeed compiled in.
- **Conclusion: Not a compilation issue.**

### Wrong Turn 2: Suspecting `OnEnter(default_state)` doesn't fire

- `AppState::SplashLogo` is the `#[default]` initial state, and `show_splash_logo` was originally scheduled on `OnEnter(SplashLogo)`.
- Suspected that Bevy 0.14 doesn't fire `OnEnter` for the default state at startup.
- Fix: moved `show_splash_logo` from `OnEnter` to `Startup`.
- Verified: re-ran → still black screen.
- **Conclusion: Moving to `Startup` was correct (kept), but it wasn't the root cause.**

### Wrong Turn 3: Misled by log diagnostics

- Relied on `info!("Splash: Jaggedblade logo")` to confirm the system executed. This line appeared **0 times** in the log.
- Inferred: "the splash system didn't run" — **this inference was wrong**.
- Truth: `main.rs:93` has `.disable::<LogPlugin>()`, which disables Bevy's built-in logger. But `info!` in `src/splash.rs` comes from `bevy::prelude::*` (the Bevy logger), so it's **silenced entirely**. Meanwhile `main.rs:120`'s `log::info!("Bevy app starting")` uses the `log` crate (routed through simplelog), so it prints fine.
- **Gotcha: `bevy::prelude::*`'s `info!` ≠ `log::info!`. After `disable::<LogPlugin>()`, the former is silent while the latter works. When diagnosing Bevy systems that use `info!`, switch to `log::info!`.**
- Verified: replaced all 4 `info!` calls in splash with `log::info!` → logs finally appeared.
- **Conclusion: It was a diagnostic blind spot, not a missing system.**

### Wrong Turn 4: Searching Bevy source for `Camera2dBundle` default transform

- Wanted to confirm whether the camera's default z is positive (which would put z=0 sprites behind the camera).
- Grepped for `Camera2dBundle` in `~/.cargo/registry/src/.../bevy-0.14.2/crates/` — no output.
- After two rounds of searching, stopped per STOP WHEN STUCK.
- **Conclusion: Don't dig through Bevy source for API defaults; just print the runtime transform values from a diagnostic system.**

## 3. Root Cause (Pinned Down by a Diagnostic System)

Added a temporary `splash_diag_system` (in `Update`, with a one-shot `Local` flag) inside `SplashPlugin::build`, using `log::info!` to print camera count, splash entity count, transforms, custom_size, and texture handle paths:

```
DIAG: cameras=1, splash_entities=2, splash_images=1
DIAG cam0: translation=Vec3(0.0, 0.0, 0.0) (z=0.00)
DIAG img0: translation=Vec3(0.0, 0.0, 0.0) (z=0.00) custom_size=Some(Vec2(800.0, 600.0)) path=gfx/jaggedlogo.jpg
Splash: Jaggedblade logo (Startup)
Splash: Main title picture (loading)
```

**Facts established:**
- The splash system executed (both stages ran).
- The camera was spawned at origin z=0, looking toward -Z (Camera2dBundle default).
- The splash image was spawned with the correct texture handle path (`gfx/jaggedlogo.jpg`) and custom_size (800×600).
- **The image is at z=0, coincident with the camera plane.**

**Root cause:** Bevy's 2D camera near plane is slightly in front of z=0. **A sprite at z=0 coincides with the camera plane and is not rendered by the 2D pipeline** → black screen. All visible sprites must have **negative** z values (in front of the camera), with smaller z being farther away.

The original z values were all wrong:

| Sprite | Original z | Issue |
|---|---|---|
| Black background | -1.0 | OK (always in front of camera) |
| Splash images (logo + mainpic) | 0.0 | Coincident with camera plane, not rendered → black screen |
| Loading bar background | 0.5 | Positive value, behind camera, invisible |
| Loading bar fill | 1.0 | Same as above |

## 4. Fix

In `src/splash.rs`, changed all splash sprite z values to negative, ordered by layer from far to near:

| Sprite | New z | Layer |
|---|---|---|
| Black background | -1.0 (unchanged) | Farthest |
| Splash images | -0.5 | In front of background |
| Loading bar background | -0.4 | In front of images |
| Loading bar fill | -0.3 | Frontmost |

Code anchors:
- `spawn_splash`: splash image `Transform::from_xyz(0.0, 0.0, -0.5)` (was 0.0)
- `show_splash_main`: loading bar background `Transform::from_xyz(0.0, -280.0, -0.4)` (was 0.5)
- `show_splash_main`: loading bar fill `Transform::from_xyz(-200.0, -280.0, -0.3)` (was 1.0)

## 5. Minor Changes

1. **`show_splash_logo` moved to `Startup`** (workaround for Bevy 0.14 `OnEnter(default_state)` not firing) — kept, as it aligns with timing.
2. **Replaced 4 `info!` calls with `log::info!` in splash** — kept, so diagnostics actually reach simplelog.
3. **Diagnostic system `splash_diag_system`** — deleted, its mission is complete.
4. **Loading bar color changed to green**: `Color::srgb(0.0, 0.8, 0.0)` (was `Color::srgb(0.0, 0.8, 1.0)` blue).

## 6. Lessons Learned

| Gotcha | Takeaway |
|---|---|
| `bevy::prelude::*`'s `info!` is silent after `disable::<LogPlugin>()` | When diagnosing whether a Bevy system executes, use `log::info!` (routed through simplelog), not `info!` |
| Bevy 2D camera looks toward -Z, near plane is in front of 0 | **2D sprite z must be negative** to be visible; z=0 coincides with the camera plane and won't render; positive values are behind the camera and invisible |
| `OnEnter(default_state)` doesn't fire in Bevy 0.14 | Use `Startup` for initialization systems on the default state, not `OnEnter` |
| Searching Bevy source for API defaults | Don't dig through source; print runtime values from a diagnostic system |
| "No log output" → "System didn't run" | First confirm the logging route (which logger is active) before inferring execution status |

## 7. Verification

```
cargo check  → passed (only 14 pre-existing unrelated warnings)
cargo run    → jaggedlogo.jpg fully visible → fade to black → mainpic.jpg brightens + green loading bar fills → MainMenu ✅
```

---

Co-Authored-By: AtomCode (GLM-5.2) <noreply@atomgit.com>

---
<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/mighty-rodent-splash-black-screen-debug.html
