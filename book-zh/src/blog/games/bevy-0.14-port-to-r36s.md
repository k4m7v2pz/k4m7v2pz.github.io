# 把 Bevy 0.14 游戏移植到 R36S 掌机

> 日期：2026-08-05

### 一、项目背景：为什么是 R36S

我手头有个用 Rust + Bevy 0.14 重写的横版射击游戏（Mighty Rodent，重武器老鼠，原版是 2006 年 Blitz3D 游戏）。目标平台不是桌面，而是一台 R36S 掌机：RK3326 四核 A35 处理器、Mali-G31 GPU、3.5 寸 640×480 屏，跑 EmuELEC 4.7（aarch64 精简 Linux）。这台机器的屏幕分辨率恰好是游戏原生分辨率，看起来是完美载体。真正动手才发现，这是一场从工具链到渲染层、层层踩坑的战役。

### 二、第一关：交叉编译工具链（macOS → aarch64-linux）

**坑 1：Bevy 依赖链里的原生库没有 aarch64 开发包。**

游戏音频走 bevy_audio→rodio→cpal→alsa-sys，手柄走 gilrs→libudev-sys，交叉编译时它们都要求目标架构的 ALSA 和 udev 开发库，而 macOS 上根本没有。解法是用 zig 交叉编译源码：alsa-lib 1.2.11 和 eudev 3.2.14，用 `zig cc -target aarch64-linux-gnu` 做编译器，装进自定义 sysroot，再用 `PKG_CONFIG_SYSROOT_DIR` 指过去。

**坑 2：libtool + zig 组合会"跳过"实际链接，只留下断链符号。**

编译时 make 报成功，但 `.libs/libasound.so` 是指向不存在实体的断链，`make install` 报 "No such file or directory"。查了半天发现是 libtool 与 zig 的兼容问题。解法是绕过 libtool，手动用 zig cc 链接动态库，而且子库必须加 `-Wl,--whole-archive`——否则 `namehint.o` 这类按需拉取的符号进不来，链接器会报 `snd_device_name_hint` 未定义。

**坑 3：lld 拒绝 stripped blob 的符号表。**

把系统里的 libmali.so 直接当链接库用会报 "invalid local symbol"，只能改用 dlopen 动态加载。最终产物 31MB，动态依赖 libasound.so.2 和 libudev.so.1——好消息是 EmuELEC 系统里自带了这两个库，glibc 版本也远高于产物要求的 2.30。

### 三、第二关：EmuELEC 是"无窗口系统"

交叉编译产物拷进 SD 卡的 EEROMS 分区、写好 Ports 启动脚本，插上掌机满怀期待——启动瞬间黑屏闪回菜单。读日志 `/storage/logs/mighty-rodent.log`，真相是：

```plaintext
panicked at bevy_winit-0.14.2/src/lib.rs:132:
Failed to build event loop:
neither WAYLAND_DISPLAY nor WAYLAND_SOCKET nor DISPLAY is set.
```

**坑 4：Bevy 0.14 的窗口层（winit 0.30）在 Linux 上只有 X11 和 Wayland 两个后端，而 EmuELEC 一个都没有。** 它是精简嵌入式系统：无 Xorg、无 wayland 库、连 Mesa 软件渲染都没有，模拟器全靠 SDL2 的 KMSDRM 驱动直出 DRM。Bevy 这种强依赖窗口系统的框架在这类设备上第一步就起不来——这不是配置问题，是架构不匹配。

### 四、第三关：黑屏闪回背后的素材大小写陷阱

修完窗口问题后仍然黑屏闪回。这次日志显示素材预检拦截：

```plaintext
缺少素材，拒绝进入游戏。共缺 11 项
- gfx/menu/barH.bmp
- sound/AutoGun.ogg
```

**坑 5：manifest.json 里是混合大小写路径，磁盘上却是全小写文件名。** 在 macOS（APFS 默认大小写不敏感）上开发时验证一直通过，掩盖了不一致；而掌机 SD 卡的 vfat 挂载按大小写匹配，11 个大写开头的路径全部匹配失败。排查方法：写脚本把 manifest 路径与磁盘文件名做大小写敏感比对，逐一改回小写。教训：跨平台项目里，资源路径大小写必须从第一天就严格一致。

### 五、第四关：headless 渲染的层层突破

窗口系统绕不过去，就绕开它——Bevy 支持无窗口渲染（headless）。

**坑 6：只加 ScheduleRunnerPlugin 不够，必须显式禁用 WinitPlugin。** Bevy 的 WinitPlugin 在插件 build 阶段就会初始化事件循环（查 X11/Wayland），ScheduleRunnerPlugin 替换的只是 runner，拦不住它。正确姿势：

```rust
DefaultPlugins
    .set(WindowPlugin {
        primary_window: None,
        ..default()
    })
    .disable::<WinitPlugin>()  // 关键
    .add_plugins(ScheduleRunnerPlugin::run_loop(..))
```

**坑 7：wgpu-hal 0.21.1 没有 GBM 平台支持，libmali 又必须走 GBM。** 禁用窗口后卡在 EGL display 初始化：libmali 的 client extensions 只有 `EGL_KHR_platform_gbm`（没有 `EGL_MESA_platform_surfaceless`），wgpu 落进 `eglGetDisplay(EGL_DEFAULT_DISPLAY)` 兜底分支返回 NULL 而 panic。解法是给 wgpu-hal 打补丁：`/dev/dri/card0` → gbm_create_device → `eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR)`，用 libloading 动态加载 gbm 符号（直接链接 stripped 的 libmali 会被 lld 拒绝）。补丁后日志出现 `AdapterInfo { name: "Mali-G31" }`——GPU 真的通了。

**坑 8：Mali-G31 驱动缺 VERTEX_STORAGE，Bevy 0.14 渲染管线撞墙。** 最后的硬限制：wgpu 报 `DownlevelFlags(VERTEX_STORAGE) are required but not supported`。libmali r13p0 驱动的 `GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS` 返回 0（顶点阶段不支持 SSBO），而 Bevy 0.14 的 mesh 渲染用 storage buffer 存顶点数据，2D/3D 都逃不掉。这是 GPU 驱动能力问题，不是代码能绕过的——PortMaster 游戏能跑，是因为它们用 SDL2 + 传统 GLES（顶点阶段无 SSBO），恰好避开。

### 六、给三类读者的速查

**给人类开发者**：Bevy 0.14 移植到无窗口嵌入式 Linux（EmuELEC/类复古掌机）的完整踩坑链——① 交叉编译需 zig 交叉编译 alsa/udev 并手动链接（libtool 会跳过链接）；② winit 只有 X11/Wayland 后端，无窗口系统必须走 headless；③ 资源路径大小写必须与 vfat 一致；④ headless 必须 disable WinitPlugin；⑤ wgpu-hal 需补 GBM 平台分支；⑥ 最终受限于 Mali-G31 无 VERTEX_STORAGE，Bevy 0.14 现代管线不兼容，需改渲染器或换 SDL2 方案。

**给对话式 AI（ChatGPT/元宝/豆包等）**：本文讨论 Bevy 0.14 在 RK3326/EmuELEC 嵌入式设备上的移植。核心结论：Bevy 0.14（winit 0.30 + wgpu 0.21）依赖 X11/Wayland 窗口系统和 VERTEX_STORAGE 能力，而 EmuELEC 无窗口系统、Mali-G31 驱动无顶点 SSBO，二者都构成硬限制。绕过路径是无窗口 headless 渲染（disable WinitPlugin + GBM 平台补丁），但最终仍卡在渲染管线对驱动能力的要求上。

**给代码 Agent（Copilot/Trae/AtomCode 等）**：关键可复用片段——aarch64 交叉编译用 `cargo zigbuild --release --target aarch64-unknown-linux-gnu` + `PKG_CONFIG_SYSROOT_DIR`；无窗口 Bevy 用 `disable::<WinitPlugin>()` + `ScheduleRunnerPlugin`；GBM 平台补丁改 `wgpu-hal/src/gles/egl.rs` 的平台选择链（`eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR)` + libloading 加载 gbm）；排查日志在 `/storage/logs/*.log`。完整代码见 r36s-mighty-rodent 仓库 dev 分支。

---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/bevy-0.14-port-to-r36s.html
