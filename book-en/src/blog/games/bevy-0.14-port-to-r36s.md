# Porting a Bevy 0.14 Game to the R36S Handheld

> Date: 2026-08-05

### One. Project Background: Why the R36S

I have a side-scrolling shooter game rewritten in Rust + Bevy 0.14 (Mighty Rodent, a heavy-weapons rat, originally a 2006 Blitz3D game). The target platform isn't desktop, but an R36S handheld: RK3326 quad-core A35 processor, Mali-G31 GPU, 3.5-inch 640×480 screen, running EmuELEC 4.7 (aarch64 stripped-down Linux). This machine's screen resolution happens to be the game's native resolution, making it look like the perfect载体. Only when I actually got my hands dirty did I realize this was a battle of stepping into pitfalls layer by layer, from the toolchain to the rendering layer.

### Two. Hurdle One: Cross-Compilation Toolchain (macOS → aarch64-linux)

**Pit 1: The native libraries in Bevy's dependency chain don't have aarch64 development packages.**

The game's audio goes through bevy_audio→rodio→cpal→alsa-sys, and the gamepad goes through gilrs→libudev-sys. During cross-compilation, they all require ALSA and udev development libraries for the target architecture, which simply don't exist on macOS. The solution is to use zig for cross-compiling from source: alsa-lib 1.2.11 and eudev 3.2.14, using `zig cc -target aarch64-linux-gnu` as the compiler, installing them into a custom sysroot, and then pointing `PKG_CONFIG_SYSROOT_DIR` at it.

**Pit 2: The libtool + zig combination "skips" the actual linking, leaving only broken-link symbols.**

During compilation, make reports success, but `.libs/libasound.so` is a broken link pointing to a non-existent entity, and `make install` reports "No such file or directory." After investigating for ages, I found it was a compatibility issue between libtool and zig. The solution is to bypass libtool, manually link the dynamic library with zig cc, and the sub-libraries must have `-Wl,--whole-archive` added——otherwise symbols pulled in on demand like `namehint.o` won't come in, and the linker will report `snd_device_name_hint` as undefined.

**Pit 3: lld rejects the symbol table of a stripped blob.**

Using the system's libmali.so directly as a link library reports "invalid local symbol," so you can only switch to dlopen for dynamic loading. The final artifact is 31MB, dynamically depending on libasound.so.2 and libudev.so.1——the good news is that the EmuELEC system comes with both of these libraries, and the glibc version is far higher than the artifact's requirement of 2.30.

### Three. Hurdle Two: EmuELEC Is a "Windowless System"

The cross-compiled artifact was copied to the SD card's EEROMS partition, the Ports launch script was written, and I plugged in the handheld full of anticipation——the moment it launched, the screen went black and flashed back to the menu. Reading the log at `/storage/logs/mighty-rodent.log`, the truth was:

```plaintext
panicked at bevy_winit-0.14.2/src/lib.rs:132:
Failed to build event loop:
neither WAYLAND_DISPLAY nor WAYLAND_SOCKET nor DISPLAY is set.
```

**Pit 4: Bevy 0.14's window layer (winit 0.30) on Linux has only X11 and Wayland backends, and EmuELEC has neither.** It's a stripped-down embedded system: no Xorg, no wayland libraries, not even Mesa software rendering. Emulators all rely on SDL2's KMSDRM driver to output directly to DRM. A framework like Bevy that strongly depends on a window system can't even take the first step on this type of device——this isn't a configuration problem, it's an architecture mismatch.

### Four. Hurdle Three: The Asset Case-Sensitivity Trap Behind the Black-Screen Flash-Back

After fixing the window problem, it still went black and flashed back. This time the log showed the asset pre-check interception:

```plaintext
缺少素材，拒绝进入游戏。共缺 11 项
- gfx/menu/barH.bmp
- sound/AutoGun.ogg
```

**Pit 5: manifest.json has mixed-case paths, but the disk has all-lowercase filenames.** When developing on macOS (APFS is case-insensitive by default), validation always passed, masking the inconsistency; but the handheld's SD card's vfat mount matches case-sensitively, so all 11 uppercase-initial paths failed to match. The troubleshooting method: write a script to do a case-sensitive comparison between manifest paths and disk filenames, and change them back to lowercase one by one. Lesson learned: in cross-platform projects, resource path casing must be strictly consistent from day one.

### Five. Hurdle Four: Layer-by-Layer Breakthrough in Headless Rendering

Since the window system can't be bypassed, go around it——Bevy supports windowless rendering (headless).

**Pit 6: Just adding ScheduleRunnerPlugin isn't enough; you must explicitly disable WinitPlugin.** Bevy's WinitPlugin initializes the event loop during the plugin build phase (checking for X11/Wayland). ScheduleRunnerPlugin only replaces the runner and can't block it. The correct approach:

```rust
DefaultPlugins
    .set(WindowPlugin {
        primary_window: None,
        ..default()
    })
    .disable::<WinitPlugin>()  // Key
    .add_plugins(ScheduleRunnerPlugin::run_loop(..))
```

**Pit 7: wgpu-hal 0.21.1 has no GBM platform support, but libmali must go through GBM.** After disabling the window, it gets stuck at EGL display initialization: libmali's client extensions only have `EGL_KHR_platform_gbm` (no `EGL_MESA_platform_surfaceless`), and wgpu falls into the `eglGetDisplay(EGL_DEFAULT_DISPLAY)` fallback branch, returning NULL and panicking. The solution is to patch wgpu-hal: `/dev/dri/card0` → gbm_create_device → `eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR)`, using libloading to dynamically load gbm symbols (directly linking the stripped libmali would be rejected by lld). After the patch, the log showed `AdapterInfo { name: "Mali-G31" }`——the GPU really was connected.

**Pit 8: The Mali-G31 driver lacks VERTEX_STORAGE, and Bevy 0.14's rendering pipeline hits a wall.** The final hard limitation: wgpu reports `DownlevelFlags(VERTEX_STORAGE) are required but not supported`. The libmali r13p0 driver's `GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS` returns 0 (the vertex stage doesn't support SSBO), and Bevy 0.14's mesh rendering uses storage buffers to store vertex data—neither 2D nor 3D can escape this. This is a GPU driver capability issue, not something code can work around——PortMaster games can run because they use SDL2 + traditional GLES (no SSBO in the vertex stage), which happens to avoid this entirely.

### Six. Quick Reference for Three Reader Types

**For human developers**: The complete pitfall chain for porting Bevy 0.14 to windowless embedded Linux (EmuELEC/similar retro handhelds)——① cross-compilation requires zig for cross-compiling alsa/udev and manual linking (libtool skips linking); ② winit only has X11/Wayland backends, so windowless systems must go headless; ③ resource path casing must match vfat; ④ headless must disable WinitPlugin; ⑤ wgpu-hal needs a GBM platform branch patch; ⑥ ultimately limited by Mali-G31 lacking VERTEX_STORAGE, Bevy 0.14's modern pipeline is incompatible, requiring a renderer change or switching to an SDL2 solution.

**For conversational AI (ChatGPT/Doubao/etc.)**: This article discusses porting Bevy 0.14 to an RK3326/EmuELEC embedded device. Core conclusion: Bevy 0.14 (winit 0.30 + wgpu 0.21) depends on X11/Wayland window systems and VERTEX_STORAGE capability, while EmuELEC is a windowless system and the Mali-G31 driver has no vertex SSBO—both constitute hard limitations. The workaround path is windowless headless rendering (disable WinitPlugin + GBM platform patch), but ultimately it still gets stuck on the rendering pipeline's driver capability requirements.

**For code agents (Copilot/Trae/AtomCode/etc.)**: Key reusable snippets——aarch64 cross-compilation uses `cargo zigbuild --release --target aarch64-unknown-linux-gnu` + `PKG_CONFIG_SYSROOT_DIR`; windowless Bevy uses `disable::<WinitPlugin>()` + `ScheduleRunnerPlugin`; the GBM platform patch modifies `wgpu-hal/src/gles/egl.rs`'s platform selection chain (`eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR)` + libloading to load gbm); troubleshooting logs are at `/storage/logs/*.log`. The full code is in the r36s-mighty-rodent repository's dev branch.

---

<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/bevy-0.14-port-to-r36s.html
