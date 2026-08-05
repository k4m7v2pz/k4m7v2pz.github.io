# Bevy 0.14 Rendering Full Pipeline on the R36S

> Date: 2026-08-05

### 🚨 Important Reminder

This article is a sequel to "Porting a Bevy 0.14 Game to the R36S Handheld: Wrestling with a Windowless System."

The previous article ended at pit 8: the Mali-G31 driver lacks `VERTEX_STORAGE`, and Bevy 0.14's rendering pipeline hit a wall. The conclusion at the time was "it's a GPU driver capability issue, not something code can work around—you need to change the renderer or switch to an SDL2 solution."

**This article announces: that conclusion has been overturned.** No need to modify Bevy source code, and no need for SDL2—the truth is that wgpu-hal's driver capability determination is lying, and Bevy's GPU preprocessing "judgment is loose." With one patch and one line of application-side configuration each, the full Bevy 0.14 rendering pipeline on the R36S is now working.

### One. The Flaw: Why Do PortMaster's SDL2 Games Run, But Not Bevy?

The previous article's inference was "Bevy's WebGPU abstraction demands too much from downlevel devices." This was only half right.

Out of suspicion, I first wrote a C probe program (dlopen directly testing libmali, without going through any framework). The on-device test results:

```c
GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS   = 0
GL_MAX_FRAGMENT_SHADER_STORAGE_BLOCKS = 0
GL_MAX_SHADER_STORAGE_BLOCK_SIZE      = 0
```

**libmali r13p0 isn't "the vertex stage doesn't support SSBO"—it's that no stage has any storage buffer at all (zero SSBO).**

More thorough than expected. This raises a key suspicion: since all stages have zero SSBO, how does Bevy 0.14 run 3D normally on WebGL2 (= GLES 3.0, also zero SSBO)? — This means Bevy must have a complete zero-SSBO fallback path, it just wasn't triggered on our device. The problem lies in the **trigger condition**.

### Two. Root Cause Refinement: VERTEX_STORAGE Is Only Required When "Storage Is Exposed to the Vertex Stage"

wgpu-core's validation code for bind group layouts has only one place that requires `VERTEX_STORAGE`:

```rust
// wgpu-core device/resource.rs (same logic in 0.21 and 24)
if entry.visibility.contains(ShaderStages::VERTEX) {
    if let Buffer { ty: BufferBindingType::Storage, .. } = entry.ty {
        required_downlevel_flags |= DownlevelFlags::VERTEX_STORAGE;
    }
}
```

That is: it requires this flag only when **a storage buffer binding is exposed to the vertex shader stage**; uniform buffers never trigger it.

So the question becomes: why does Bevy choose storage for vertex-visible data? Look at how wgpu-hal's GLES adapter computes the limit:

```rust
// wgpu-hal gles/adapter.rs (original)
let max_storage_buffers_per_shader_stage = if vertex_ssbo == 0 {
    fragment_ssbo          // ← vertex is 0, so use fragment's count to fill in
} else {
    min(vertex, fragment)
};
```

And Bevy 0.14 **decides the binding type entirely based on this limit**:

```rust
// bevy_render GpuArrayBuffer (mesh2d / mesh per-object data)
if limits.max_storage_buffers_per_shader_stage == 0 { Uniform fallback } else { Storage }
// bevy_render get_supported_read_only_binding_type (visibility ranges / cluster data)
if limits.max_storage_buffers_per_shader_stage >= needed count { Storage } else { Uniform }
```

**The lying chain**: libmali vertex SSBO=0 but fragment SSBO>0 (fragment hadn't yet been tested as also 0) → wgpu-hal substitutes fragment's count → limit reports >0 → Bevy chooses storage binding for vertex-visible data → wgpu-core requires VERTEX_STORAGE → device doesn't have it → bind group layout creation fails, black screen flash-back.

### Three. Why Bevy Must Have a Uniform Fallback (A Ready-Made Lifeline)

Bevy 0.14 officially supports **WebGL2 (GLES 3.0, zero SSBO)**, so all vertex-visible storage bindings in WGSL come with `#ifdef` uniform twins:

```wgsl
// bevy_sprite mesh2d_bindings.wgsl
#ifdef PER_OBJECT_BUFFER_BATCH_SIZE
@group(1) @binding(0) var<uniform> mesh: array<Mesh2d, #{PER_OBJECT_BUFFER_BATCH_SIZE}u>;
#else
@group(1) @binding(0) var<storage> mesh: array<Mesh2d>;
#endif
// bevy_pbr mesh_view_bindings.wgsl: cluster (binding 6/7/8) and visibility_ranges (binding 12)
#ifdef AVAILABLE_STORAGE_BUFFER_BINDINGS >= 3
... var<storage> ...
#else
... var<uniform> ...
#endif
```

The `AVAILABLE_STORAGE_BUFFER_BINDINGS` shader def is derived from the device limit (`pipeline_cache.rs`). **The fact that WebGL2 can run 3D scenes on 0.14 is ready-made proof that this uniform fallback full pipeline is complete.**

### Four. Solution One: wgpu-hal Limit Patch (5 Lines)——Let Bevy Take the Uniform Fallback

In the already-vendored wgpu-hal, change "when vertex SSBO is 0, use fragment to fill in" to "when the real vertex SSBO is missing, report 0" (preserving the RPI4 false-zero special case: RPI4 having vertex SSTO means vertex SSBO reporting 0 is fake):

```rust
// patches/wgpu-hal src/gles/adapter.rs
let max_storage_buffers_per_shader_stage = if vertex_shader_storage_blocks == 0 {
    if vertex_ssbo_false_zero {       // RPI4 false-zero special case preserves original logic
        fragment_shader_storage_blocks
    } else {
        0                             // R36S/libmali → triggers Bevy uniform fallback
    }
} else {
    vertex_shader_storage_blocks.min(fragment_shader_storage_blocks)
};
```

After the patch, the `VERTEX_STORAGE` error disappears—Bevy's `GpuArrayBuffer` and `get_supported_read_only_binding_type` all automatically fall to the uniform fallback. (A later probe actually tested fragment SSBO as also 0, so the original code would have computed 0 on this device anyway; but the patch logically removes the "lying fallback," making the behavior predictable and portable to other "vertex 0 but fragment>0" devices.)

### Five. Solution Two: GPU Preprocessing Self-Enable——limit=0 Still Missing One Last Step

The limit patch made the `VERTEX_STORAGE` error disappear, but on-device a new error immediately appeared:

```rust
In Device::create_bind_group_layout
  note: label = `build mesh uniforms direct bind group layout`
Too many bindings of type StorageBuffers in Stage ShaderStages(COMPUTE), limit is 0, count was 4.
Check the limit `max_storage_buffers_per_shader_stage` passed to `Adapter::request_device`
```

Bevy 0.14 has a **GPU preprocessing** module: it uses a compute shader to build the mesh uniform buffer on the GPU (part of GPU-driven rendering), and its compute bind group layout requires 4 storage buffers. The key is its self-enable judgment (`bevy_render/src/batching/gpu_preprocessing.rs`, `GpuPreprocessingSupport::from_world`):

```rust
if device.limits().max_compute_workgroup_size_x == 0 { GpuPreprocessingSupport::None }
else if !features.contains(INDIRECT_FIRST_INSTANCE) ... { PreprocessingOnly }
else { Culling }
```

**It only checks the compute workgroup size, completely ignoring the storage buffer limit!** libmali's `max_compute_workgroup_size_x = 128` (≠0), so GPU preprocessing enables as normal, taking 4 storage buffers to hit the limit=0 wall.

**Solution: Insert `GpuPreprocessingSupport::None` on the application side (zero Bevy source changes).**

`GpuPreprocessingSupport` is a FromWorld-generated Resource in the render world, a three-state enum `None / PreprocessingOnly / Culling`. The application inserts `None` directly into the render sub-world after `add_plugins` and before `run()` to override the default judgment:

```rust
fn main() {
    let mut app = App::new();
    app.add_plugins(DefaultPlugins /* headless trio */)
        .add_plugins(ImageCopyPlugin)
        .add_plugins(ScheduleRunnerPlugin::run_loop(Duration::from_secs_f64(1.0 / 60.0)))
        .add_systems(Startup, setup)
        .add_systems(Update, save_and_exit);
    // libmali zero SSBO: disable GPU preprocessing (compute stage needs 4 storage buffers),
    // take the CPU preprocessing fallback (same path as WebGL2)——application-side Resource insertion overrides the default judgment.
    if let Some(render_app) = app.get_sub_app_mut(bevy::render::RenderApp) {
        render_app.world_mut().insert_resource(
            bevy::render::batching::gpu_preprocessing::GpuPreprocessingSupport::None,
        );
    }
    app.run();
}
```

The `None` state makes Bevy take the CPU preprocessing fallback—the same path WebGL2 (GLES 3.0 without compute) uses, stable. Incidentally, Bevy 0.14's graceful degradation mechanism is quite mature; the log shows similar examples: `WARN bevy_pbr::ssao: ScreenSpaceAmbientOcclusionPlugin not loaded. GPU lacks support: R16FloatSTORAGE_BINDING.`——missing capability means automatic non-loading. GPU preprocessing is one of the few "loose judgment" escapees; patching it makes the behavior consistent with other degradations.

### Six. Test Matrix: 7 Minimal Ports Tested at Once (Batch Verification Methodology)

Single-point verification is too slow (compile + deploy + on-device, 20 minutes per round). Build 7 minimal ports at once, each running ~2 seconds before auto-exit; if the screen goes black and bounces back, test the next one. All logs are in `/storage/logs/<name>.log`:

| # | port | stack | render path | verification point |
|---|---|---|---|---|
| 1 | probe | C / dlopen | none (diagnostic) | fb0 format, EGL extensions, SSBO values, graphics lib scan, surfaceless self-check |
| 2 | fb0-cpu | C / pure CPU | /dev/fb0 direct write | fb0 screen-write link + screen format (16/32bpp) |
| 3 | egl-fb | C / dlopen EGL+GBM | surfaceless GLES → readback → fb0 | bare GLES on-screen without SDL2 (main route) |
| 4 | sdl2-gles | C / SDL2 | SDL renderer (KMSDRM) | PortMaster standard path control baseline |
| 5 | bevy3d | Rust / Bevy 0.14 3D | wgpu GLES → readback → fb0+PNG | 3D uniform fallback |
| 6 | bevy2d | Rust / Bevy 0.14 2D | wgpu GLES → readback → fb0+PNG | SpritePlugin recovery |
| 7 | wgpu-direct | Rust / wgpu 0.20 (no Bevy) | wgpu GLES → readback → PNG | isolate Bevy layer |

**On-device results (cumulative over three rounds)**:

- **egl-fb PASS (round two)**: Bare EGL + GBM + fb0 on-screen, 120 frames all pass——**the SDL2-free main route is established**.
- **fb0-cpu PASS (round two)**: fb0 screen-write + screen format confirmation (`640x480 bpp=32 stride=2560`), red/green/blue horizontal bars + moving white line animation.
- **probe PASS (round two)**: Nailed down libmali's zero SSBO (all three parameters 0), EGL client extensions only GBM.
- **sdl2-gles round three PASS**: `cp -f` fix took effect——`SDL_Init OK / SDL_CreateWindow OK / SDL_CreateRenderer OK (accelerated) / RESULT: PASS (120 frames)`, the screen shows "multiple colors flashing fast + gradient," which is the SDL2 hue cycle animation. **KMSDRM display path confirmed** (two independent links from fb0 screen-write, both working).
- **bevy3d round three gets past GPU preprocessing**: The error is no longer compute storage, but becomes `Resource requested by bevy_text::text2d::update_text2d_layout does not exist: Assets<TextureAtlasLayout>`——because SpritePlugin was initially disabled to bypass VERTEX_STORAGE, and bevy_text's text2d system needs the `Assets<TextureAtlasLayout>` asset type registered by SpritePlugin. After the limit patch, mesh2d already takes the uniform fallback; **restoring SpritePlugin is enough** (the original reason for disabling it to bypass VERTEX_STORAGE no longer exists).
- **bevy2d round three hangs**: Log stops at AdapterInfo + SSAO WARN, no panic——black screen for 10 seconds without exiting, select+start ineffective, long-press power to force reboot. Suspected render loop/wait (map_async/poll) stuck, pending debugging.
- **wgpu-direct**: Round two `LimitsExceeded` (workgroup y 256>128, already changed to `adapter.limits()`); round three log missing, pending retest.

**Layered location method (wgpu-family troubleshooting)**: probe first (fb format determines screen-write code, SSBO values verify driver diagnosis); wgpu-direct succeeds while Bevy fails → problem is in the Bevy renderer layer, otherwise in wgpu-hal/driver layer; sdl2-gles is the anchor (the PortMaster ecosystem proves SDL2 can go on-screen; if it succeeds while egl-fb fails → bare EGL detail problem).

### Seven. Deployment and TF Card Partition Experience (All Stepped on Through Real Testing)

#### Partition conventions (measured with lsblk on ThinkPad)

| partition | filesystem | device path | ThinkPad mount point |
|---|---|---|---|
| p1 EMUELEC | vfat | boot | /mnt/r36s/boot |
| p2 STORAGE | ext4 | **/storage on the device** (logs/saves here) | /mnt/r36s/storage |
| p3 EEROMS | vfat | **/storage/roms on the device** (ports/ here) | /mnt/r36s/eroms |

**Port deployment conventions** (EmuELEC's PortMaster-style structure): launcher script → `EEROMS/ports_scripts/<name>.sh` (**the menu scans this directory's .sh files**, so only ports with launchers are displayed); binary/resource directory → `EEROMS/ports/<name>/`; inside the launcher, `cd /storage/roms/ports/<name>` (device-side path). The menu display name defaults to the .sh filename; `gamelist.xml` can override it.

#### The Pitfall of Removing a Mounted Card

When a TF card is **removed while mounted** (pulled directly from the card reader), the mount becomes invalid:

```bash
Reading the directory directly gives Input/output error, but dumpe2fs shows Filesystem state: clean
```

Don't rush to fsck——this is usually an **invalidated mount** rather than filesystem corruption (dmesg will have `JBD2: I/O error when updating journal superblock`, which is the normal manifestation of journal abort when the card is pulled). `umount + re-mount` restores it. Safely unmount before pulling the card.

#### FAT32 Doesn't Support Symbolic Links

The port directory is on a vfat partition, so symlinks created with `ln -sf` will fail (the loader reports `cannot open shared object file`). For dynamic libraries that need local "renaming" (e.g., using `libSDL2-2.0.so.0` as `libSDL2.so.2`), use **`cp -f` to copy** rather than symlinking.

### Eight. Cross-Compilation Supplement (Test-Side Tricks Beyond the Previous Article)

The previous article covered zig cross-compilation of alsa/udev system libraries; here are three test-side supplements:

1. **C test program: zig cc direct output, zero dependencies, seconds-level build**, all using dlopen to dynamically load libmali (libEGL.so.1 / libGLESv2.so.2 / libgbm.so.1), 15-46KB after stripping:

```bash
zig cc -target aarch64-linux-gnu -O2 -Wall main.c egl_load.c fb.c -ldl -o probe
```

2. **Rust: multiple Bevy test crates consolidated into a Cargo workspace**——the `wgpu-hal` patch and `[profile.release]` are promoted to the root `Cargo.toml`, members share the target cache; `CARGO_TARGET_DIR` points to the old cache to avoid a full Bevy rebuild, with incremental builds taking 2-3 minutes:

```bash
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-<old target cache>}"
cargo zigbuild --release --target aarch64-unknown-linux-gnu --workspace
```

3. **Link-time stub trick**: When the host doesn't have the target library (e.g., SDL2), write an empty-implementation stub .so (same function signatures, returns 0), compile with `-Wl,-soname,libSDL2.so.2`; at link time provide the stub path, and DT_NEEDED records the SONAME; on the device, the launcher uses `cp -f` to copy the real library to the same name + `LD_LIBRARY_PATH`. Note: lld doesn't support GNU ld's `--unresolved-symbols=ignore-all`, so you must use "stub defines empty implementation" rather than "allow undefined symbols."

### Nine. Why "Upgrading Bevy" Doesn't Solve It (The Direction Is Backwards)

When encountering VERTEX_STORAGE, the most natural thought is "try a newer version of Bevy." The tested conclusion is **the higher you go, the worse it gets**:

| version | wgpu | conclusion |
|---|---|---|
| 0.15 | 23 | Same architecture, same failure (VERTEX_STORAGE judgment unchanged) |
| 0.16 | 24 | Same as above; and **WebGL2 renderer was removed** (web only has WebGPU left), GLES support is worse |
| 0.17 | 25/26 | **GLES downgraded to an optional feature** `bevy_render/gles` (PR #20793), officially stated as "untested, may break"; major renderer refactor |

The R36S only has a GLES driver (no Vulkan/Metal), and the higher the Bevy version, the more GLES is marginalized. **Staying on 0.14 + wgpu-hal patch + application-side configuration is the only path that neither touches Bevy source code nor requires SDL2.**

### Ten. Quick Reference for Three Reader Types (Updated: From "No Solution" to "Solvable")

#### For Human Developers (30-Second Conclusion)

The previous article's claim that VERTEX_STORAGE is unsolvable is **wrong**. The truth is that wgpu-hal's limit determination substitutes fragment for vertex, misleading Bevy into choosing storage for vertex-visible data; report `max_storage_buffers_per_shader_stage` as 0, and Bevy's WebGL2-equivalent uniform fallback automatically takes over; then insert `GpuPreprocessingSupport::None` into the render world to turn off GPU preprocessing (its judgment is loose—it only checks workgroup size, not storage limit). Display uses offscreen rendering → CPU readback → write to `/dev/fb0` (640×480 32bpp), no SDL2 needed.

#### For Conversational AI (Q&A Quick Reference)

- **How does Bevy run on embedded devices without X11/Wayland?** Disable WinitPlugin, set WindowPlugin to `primary_window: None`, use ScheduleRunnerPlugin to drive the main loop; use offscreen textures as render targets, read back and write to fb.
- **wgpu reports VERTEX_STORAGE downlevel flag missing?** This means a storage binding is exposed to the vertex stage. Check wgpu-hal GLES adapter's `max_storage_buffers_per_shader_stage`——when vertex SSBO=0, it may substitute fragment's count, misleading the upper layer into choosing storage. Report the limit as 0, and the upper layer takes the uniform fallback.
- **Reports "Too many bindings of type StorageBuffers in Stage ShaderStages(COMPUTE)"?** Bevy 0.14's GPU preprocessing self-enable judgment only checks compute workgroup size, not storage limit; insert `GpuPreprocessingSupport::None` into the render world on the application side to take the CPU preprocessing fallback.
- **EGL initialization fails (DEFAULT_DISPLAY returns NULL)?** The driver may be a GBM winsys: check `eglQueryString(EGL_NO_DISPLAY, EGL_EXTENSIONS)`, and if `EGL_KHR_platform_gbm` is present, use `eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR, gbm_device, NULL)`.
- **Can upgrading Bevy solve it?** No. 0.15/0.16 have the same architecture and same problem; 0.17 downgrades GLES to an untested optional feature.

#### For Code Agents (Executable Checklist)

```text
1. headless trio: WinitPlugin::disable + WindowPlugin{primary_window:None} + ScheduleRunnerPlugin
2. wgpu-hal vendor patch (src/gles/egl.rs): EGL_KHR_platform_gbm platform branch,
   dlopen libgbm → gbm_create_device(/dev/dri/card0) → eglGetPlatformDisplayEXT(GBM)
3. wgpu-hal vendor patch (src/gles/adapter.rs): GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS==0
   and not RPI4 false-zero → max_storage_buffers_per_shader_stage = 0 (triggers upper-layer uniform fallback)
4. application side (after add_plugins, before run):
   app.get_sub_app_mut(RenderApp).world_mut().insert_resource(GpuPreprocessingSupport::None)
5. display: offscreen texture → ImageCopyPlugin readback → convert per /sys/class/graphics/fb0/ bits_per_pixel
   (16=RGB565 / 32=XRGB8888) → pwrite /dev/fb0
6. deployment: launcher → EEROMS/ports_scripts/, binary directory → EEROMS/ports/<name>/;
   on FAT32, rename dynamic libraries with cp not ln -s; unmount before removing card
7. cross-compilation: C uses zig cc -target aarch64-linux-gnu; Rust uses cargo zigbuild
   (CARGO_TARGET_DIR reuses cache); missing target libraries use empty-implementation stub .so + DT_NEEDED
```

### Epilogue (Updated Through Round Three On-Device)

As of 2026-08-03, three rounds on-device: bare EGL on-screen (egl-fb), pure CPU screen-write (fb0-cpu), environment probe (probe), SDL2/KMSDRM anchor (sdl2-gles) all PASS——**both the fb0 and KMSDRM display links are working**.

On the Bevy side: 3D has cleared both the VERTEX_STORAGE and GPU preprocessing hurdles; round three exposed one last problem—the SpritePlugin disabled to bypass VERTEX_STORAGE caused bevy_text's `Assets<TextureAtlasLayout>` to be missing (after the limit patch, there's no need to disable it; just restore it); 2D hung in round three (no panic, suspected render loop/wait stuck, pending debugging); wgpu-direct's round three log is missing, pending retest. Patches and fixes have all been deployed to the card, pushing toward the final step.

The insight running throughout: **running Bevy on embedded devices isn't mysticism; what you need to find is "which link in the driver capability determination chain is lying"**——wgpu-hal's limit fallback substituting fragment for vertex, and Bevy preprocessing only checking workgroup size instead of storage limit, two places of "loose judgment" caused two false deaths. Once you ferret them out, what remains is the uniform fallback path paved since the WebGL2 era.

Empty-implementation stub .so + DT_NEEDED

---

<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/bevy-0.14-r36s-rendering.html
