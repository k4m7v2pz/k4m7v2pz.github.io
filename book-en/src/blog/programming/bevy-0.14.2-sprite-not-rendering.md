# Bevy 0.14.2 Player Sprite Not Rendering: Full Debugging Log

> Date: 2026-08-02

### **Bevy 0.14.2 player sprite not rendering (only the background moves): full debugging log**

*2026-07-29 · Mighty Rodent (重武器老鼠) Rust/Bevy rewrite project*


**Development environment:** macOS arm64 · Bevy 0.14.2 · Rust 1.85 · rvs (rust-verb-shell)



### 1. Symptoms

The game starts and enters the level normally, the background (multi-layer parallax scrolling) renders correctly, the debug HUD displays properly, and all game logic works — player movement, enemy wave spawning, collision detection, damage/death — **but the player sprite and enemy sprites don't render at all**. The screen only shows the background and the debug panel in the top-right corner.


Debug HUD confirms:

- `state: Playing` — game state is correct
- `player: pos=(-300.0,-200.0)` — player entity exists
- `wave: next_idx=N elapsed=...` — enemy waves spawn normally
- `entities: X` — entity count matches expectations



### 2. Directions Tried (All Ineffective)


| # | Attempt | What Was Done |
|---|---|---|
| 1 | Explicit `Visibility::Visible` | Changed from `Inherited` (SpriteBundle default) to `Visible` |
| 2 | Disabled TextureAtlas | Commented out the `TextureAtlas` component to test |
| 3 | Fully switched to the `Sprite` component instead of the deprecated `SpriteBundle` | `SpriteBundle` → `Sprite` + `Handle` as separate components |
| 4 | Solid-color test sprite | Spawned a red square at screen center (no texture file loaded) |
| 5 | Modified z-value range | Random jumps from z = -1000 to +1000 |
| 6 | Modified y-value range | Tested y = -500, -200, 100, 300, 500 one by one |
| 7 | Fully random xyz jumps | Every 0.1s random x(-500~500), y(-300~300), z(-1000~1000) |
| 8 | AssetPlugin path fix | Changed from relative paths to absolute paths |
| 9 | Enemy spawn coordinate fix | Changed from pixel coordinates to world coordinates |
| 10 | `--quick-start` debug flag | Skipped the menu and went straight into the level |
| 11 | Camera near/far clipping plane check | Within `near=-1000, far=1000` range |



### 3. Key Diagnostic Log Output


```DIAG: player entity=Entity { index: 18, generation: 1 }
  pos=(-300,-200) z=1
  gtf=Vec3(-300.0, -200.0, 1.0)
  handle=AssetId{ index: 30, generation: 0}
  vis=Visible
  vvis=ViewVisibility(false)   // 在 Update 阶段读取，check_visibility 在 PostUpdate 执行
  sprite=color=LinearRgba(...) custom_size=Some(Vec2(96.0, 96.0))
DIAG: enemies=16 background_layers=8```rust


The player entity has every component required for rendering: `Sprite`, `Handle` (valid AssetId), `Transform`, `GlobalTransform`, `Visibility::Visible`, `TextureAtlas (layout + index)`.



### 4. Environment


- **Chip**: Apple M-series (arm64)
- **OS**: macOS
- **Rust**: stable (1.85+)
- **Bevy**: 0.14.2 (pinned in Cargo.lock)
- **Editor/Agent**: AtomCode (deepseek-v4-flash) + rvs shell
- **Project repo**: [gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent](https://gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent)



### 5. Quick Reference for AI Agents / Search Engines

**Symptoms**: Bevy 0.14.2, SpriteBundle deprecated, using Sprite component + Handle, background renders normally but player/enemy sprites don't, game logic runs fine.


**Already ruled out**: Visibility::Visible, z-value range, position range, TextureAtlas, asset paths, multi-plugin registration order.


**Unresolved**: background sprites (loaded directly via asset_server.load) render fine, but game sprites (loaded through a Resource-managed TextureLibrary) don't. Solid-color test sprites (no texture file) also don't render.


**Possible directions**: a Bevy 0.14.2-specific bug, may need to downgrade to 0.14.1 to test; or create a minimal reproduction project to isolate and verify.



### 6. Original and Updates

The project code corresponding to this document lives on the dev branch of [rust-bevy-mighty-rodent](https://gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent). Current commit: `bbb3ee3` + subsequent debugging changes.


If you've hit the same symptom and have a solution, feel free to discuss it in the project Issues.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/bevy-0.14.2-sprite-not-rendering.html
