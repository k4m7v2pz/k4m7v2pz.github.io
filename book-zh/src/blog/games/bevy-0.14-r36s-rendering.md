# Bevy 0.14 在 R36S 上渲染全链路打通

> 日期：2026-08-05

### 🚨 重要提醒

本文是《把 Bevy 0.14 游戏移植到 R36S 掌机：一场与"无窗口系统"的搏斗》的续篇。

上篇讲到坑 8：Mali-G31 驱动缺 `VERTEX_STORAGE`，Bevy 0.14 渲染管线撞墙，当时结论是"GPU 驱动能力问题，不是代码能绕过的——需改渲染器或换 SDL2 方案"。

**这篇要宣布：那个结论被推翻了。** 不需要改 Bevy 源码，也不需要 SDL2——真相是 wgpu-hal 的驱动能力判定在撒谎，以及 Bevy 的 GPU 预计算"判定不严"。各用一个补丁/一行应用侧配置，R36S 上的 Bevy 0.14 渲染全链路已经打通。

### 一、破绽：为什么 PortMaster 的 SDL2 游戏能跑，而 Bevy 不行？

上篇的推断是"Bevy 的 WebGPU 抽象对 downlevel 设备要求高"。这句话只说对了一半。

带着怀疑先写了个 C 探针程序（dlopen 直测 libmali，不经过任何框架），上机实测结果：

```c
GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS   = 0
GL_MAX_FRAGMENT_SHADER_STORAGE_BLOCKS = 0
GL_MAX_SHADER_STORAGE_BLOCK_SIZE      = 0
```

**libmali r13p0 不是"顶点阶段不支持 SSBO"，而是任何阶段都没有 storage buffer（零 SSBO）。**

比预想更彻底。这引出一个关键疑点：既然全阶段零 SSBO，Bevy 0.14 又是怎么在 WebGL2（= GLES 3.0，同样零 SSBO）上正常跑 3D 的？——说明 Bevy 一定有零 SSBO 的完整回退路径，只是在我们这台设备上没被触发。问题出在**触发条件**上。

### 二、根因精化：VERTEX_STORAGE 只在"storage 暴露给顶点阶段"才被要求

wgpu-core 对 bind group layout 的校验代码只有一处会要求 `VERTEX_STORAGE`：

```rust
// wgpu-core device/resource.rs（0.21 与 24 同款判定）
if entry.visibility.contains(ShaderStages::VERTEX) {
    if let Buffer { ty: BufferBindingType::Storage, .. } = entry.ty {
        required_downlevel_flags |= DownlevelFlags::VERTEX_STORAGE;
    }
}
```

即：**storage buffer 绑定暴露给顶点着色器阶段**时才要求该 flag；uniform buffer 永远不触发。

那么问题变成：为什么 Bevy 会给顶点可见的数据选 storage？看 wgpu-hal 的 GLES adapter 怎么算 limit：

```rust
// wgpu-hal gles/adapter.rs（原版）
let max_storage_buffers_per_shader_stage = if vertex_ssbo == 0 {
    fragment_ssbo          // ← 顶点为 0，就拿 fragment 的数量顶上
} else {
    min(vertex, fragment)
};
```

而 Bevy 0.14 完全是**按这个 limit 决定绑定类型**的：

```rust
// bevy_render GpuArrayBuffer（mesh2d / mesh 每对象数据）
if limits.max_storage_buffers_per_shader_stage == 0 { Uniform 回退 } else { Storage }
// bevy_render get_supported_read_only_binding_type（visibility ranges / cluster 数据）
if limits.max_storage_buffers_per_shader_stage >= 需要数 { Storage } else { Uniform }
```

**撒谎的链条**：libmali 顶点 SSBO=0 但 fragment SSBO>0（当时还没实测到 fragment 也是 0）→ wgpu-hal 用 fragment 数量顶替 → limit 报 >0 → Bevy 给顶点可见数据选 storage 绑定 → wgpu-core 要求 VERTEX_STORAGE → 设备没有 → 创建 bind group layout 失败、黑屏闪回。

### 三、为什么 Bevy 一定有 uniform 回退（现成的救命通道）

Bevy 0.14 官方支持 **WebGL2（GLES 3.0，零 SSBO）**，所以所有顶点可见的 storage 绑定在 WGSL 里都带 `#ifdef` uniform 双胞胎：

```wgsl
// bevy_sprite mesh2d_bindings.wgsl
#ifdef PER_OBJECT_BUFFER_BATCH_SIZE
@group(1) @binding(0) var<uniform> mesh: array<Mesh2d, #{PER_OBJECT_BUFFER_BATCH_SIZE}u>;
#else
@group(1) @binding(0) var<storage> mesh: array<Mesh2d>;
#endif
// bevy_pbr mesh_view_bindings.wgsl：cluster（binding 6/7/8）与 visibility_ranges（binding 12）
#ifdef AVAILABLE_STORAGE_BUFFER_BINDINGS >= 3
... var<storage> ...
#else
... var<uniform> ...
#endif
```

`AVAILABLE_STORAGE_BUFFER_BINDINGS` 这个 shader def 由 device limit 派生（`pipeline_cache.rs`）。**WebGL2 在 0.14 上能跑 3D 场景，就是这条 uniform 回退全链路完整的现成证据。**

### 四、解法一：wgpu-hal limit 补丁（5 行）——让 Bevy 走 uniform 回退

在已 vendor 的 wgpu-hal 里，把"顶点 SSBO 为 0 时用 fragment 顶上"改成"真实顶点 SSBO 缺失时报 0"（保留 RPI4 假零特例：RPI4 顶点 SSTO 存在说明顶点 SSBO 报 0 是假的）：

```rust
// patches/wgpu-hal src/gles/adapter.rs
let max_storage_buffers_per_shader_stage = if vertex_shader_storage_blocks == 0 {
    if vertex_ssbo_false_zero {       // RPI4 假零特例保留原逻辑
        fragment_shader_storage_blocks
    } else {
        0                             // R36S/libmali → 触发 Bevy uniform 回退
    }
} else {
    vertex_shader_storage_blocks.min(fragment_shader_storage_blocks)
};
```

补丁后 `VERTEX_STORAGE` 错误消失——Bevy 的 `GpuArrayBuffer` 与 `get_supported_read_only_binding_type` 全部自动落到 uniform 回退。（事后 probe 实测 fragment SSBO 也是 0，所以原版代码在这台设备上本来就会算出 0；但补丁把"撒谎的兜底"从逻辑上抹掉了，行为可预期、可移植到其他"顶点 0 但 fragment>0"的设备。）

### 五、解法二：GPU 预计算自启用——limit=0 还差最后一脚

limit 补丁让 `VERTEX_STORAGE` 错误消失，上机后立刻冒出新错误：

```rust
In Device::create_bind_group_layout
  note: label = `build mesh uniforms direct bind group layout`
Too many bindings of type StorageBuffers in Stage ShaderStages(COMPUTE), limit is 0, count was 4.
Check the limit `max_storage_buffers_per_shader_stage` passed to `Adapter::request_device`
```

Bevy 0.14 有个 **GPU 预计算（GPU preprocessing）** 模块：用 compute shader 在 GPU 上构建 mesh uniform 缓冲（GPU-driven 渲染的一部分），其 compute bind group layout 要 4 个 storage buffer。关键在它的自启用判定（`bevy_render/src/batching/gpu_preprocessing.rs`，`GpuPreprocessingSupport::from_world`）：

```rust
if device.limits().max_compute_workgroup_size_x == 0 { GpuPreprocessingSupport::None }
else if !features.contains(INDIRECT_FIRST_INSTANCE) ... { PreprocessingOnly }
else { Culling }
```

**它只查 compute workgroup size，完全不看 storage buffer limit！** libmali 的 `max_compute_workgroup_size_x = 128`（≠0），于是 GPU 预计算照常启用，拿着 4 个 storage buffer 去撞 limit=0 的墙。

**解法：应用侧插入 `GpuPreprocessingSupport::None`（零 Bevy 源码改动）。**

`GpuPreprocessingSupport` 是渲染世界里一个 FromWorld 生成的 Resource，枚举三态 `None / PreprocessingOnly / Culling`。应用在 `add_plugins` 之后、`run()` 之前，直接往渲染子世界插入 `None` 覆盖默认判定：

```rust
fn main() {
    let mut app = App::new();
    app.add_plugins(DefaultPlugins /* headless 三件套 */)
        .add_plugins(ImageCopyPlugin)
        .add_plugins(ScheduleRunnerPlugin::run_loop(Duration::from_secs_f64(1.0 / 60.0)))
        .add_systems(Startup, setup)
        .add_systems(Update, save_and_exit);
    // libmali 零 SSBO：禁用 GPU 预计算（compute 阶段要 4 个 storage buffer），
    // 走 CPU 预处理回退（WebGL2 同款路径）——应用侧插 Resource 覆盖默认判定。
    if let Some(render_app) = app.get_sub_app_mut(bevy::render::RenderApp) {
        render_app.world_mut().insert_resource(
            bevy::render::batching::gpu_preprocessing::GpuPreprocessingSupport::None,
        );
    }
    app.run();
}
```

`None` 状态让 Bevy 走 CPU 预处理回退——WebGL2（GLES 3.0 无 compute）上就是这条路径，稳。顺带一提，Bevy 0.14 的优雅降级机制很成熟，日志里能看到同类例子：`WARN bevy_pbr::ssao: ScreenSpaceAmbientOcclusionPlugin not loaded. GPU lacks support: R16FloatSTORAGE_BINDING.`——缺能力自动不加载。GPU 预计算是少数"判定不严"的漏网之鱼，补上之后行为与其他降级一致。

### 六、测试矩阵：7 个最小 port 一次测穿（批量验证方法论）

单点验证效率太低（编译+部署+上机一轮 20 分钟）。一次性做 7 个最小 port，每个跑 ~2 秒自动退出，黑屏弹回就测下一个，日志全在 `/storage/logs/<名>.log`：

| # | port | 栈 | 渲染路径 | 验证点 |
|---|---|---|---|---|
| 1 | probe | C / dlopen | 无（诊断） | fb0 格式、EGL 扩展、SSBO 数值、图形库扫描、surfaceless 自检 |
| 2 | fb0-cpu | C / 纯 CPU | /dev/fb0 直写 | fb0 写屏链路 + 屏幕格式（16/32bpp） |
| 3 | egl-fb | C / dlopen EGL+GBM | surfaceless GLES → 读回 → fb0 | 无 SDL2 裸 GLES 上屏（主路线） |
| 4 | sdl2-gles | C / SDL2 | SDL 渲染器（KMSDRM） | PortMaster 标准路径对照基线 |
| 5 | bevy3d | Rust / Bevy 0.14 3D | wgpu GLES → 读回 → fb0+PNG | 3D uniform 回退 |
| 6 | bevy2d | Rust / Bevy 0.14 2D | wgpu GLES → 读回 → fb0+PNG | SpritePlugin 恢复 |
| 7 | wgpu-direct | Rust / wgpu 0.20（无 Bevy） | wgpu GLES → 读回 → PNG | 隔离 Bevy 层 |

**上机结果（三轮累计）**：

- **egl-fb PASS（第二轮）**：裸 EGL + GBM + fb0 上屏 120 帧全通——**无 SDL2 主路线成立**。
- **fb0-cpu PASS（第二轮）**：fb0 写屏 + 屏幕格式确认（`640x480 bpp=32 stride=2560`），红绿蓝横条+移动白线动画。
- **probe PASS（第二轮）**：实锤 libmali 零 SSBO（三个参数全 0）、EGL 客户端扩展只有 GBM。
- **sdl2-gles 第三轮 PASS**：`cp -f` 修复生效——`SDL_Init OK / SDL_CreateWindow OK / SDL_CreateRenderer OK (accelerated) / RESULT: PASS (120 frames)`，屏幕上"多种颜色快闪+渐变" 即 SDL2 色相循环动画。**KMSDRM 显示路径确认**（与 fb0 写屏是两条独立链路，都已打通）。
- **bevy3d 第三轮越过 GPU 预计算**：错误不再是 compute storage，变成 `Resource requested by bevy_text::text2d::update_text2d_layout does not exist: Assets<TextureAtlasLayout>`——因为当初为了绕 VERTEX_STORAGE 禁用了 SpritePlugin，而 bevy_text 的 text2d 系统需要 SpritePlugin 注册的 `Assets<TextureAtlasLayout>` 资产类型。limit 补丁后 mesh2d 已走 uniform 回退，**恢复 SpritePlugin 即可**（当初禁用它绕 VERTEX_STORAGE 的理由已不存在）。
- **bevy2d 第三轮卡死**：日志停在 AdapterInfo + SSAO WARN、无 panic——黑屏 10 秒不退、select+start 无效、长按电源强制重启。疑似渲染循环/等待（map_async/poll）卡住，待调试。
- **wgpu-direct**：第二轮 `LimitsExceeded`（workgroup y 256>128，已改 `adapter.limits()`）；第三轮日志缺失，待复测。

**分层定位法（wgpu 系排障）**：probe 先行（fb 格式决定写屏代码、SSBO 数值验证驱动诊断）；wgpu-direct 成功而 Bevy 失败 → 问题在 Bevy 渲染器层，反之在 wgpu-hal/驱动层；sdl2-gles 是锚点（PortMaster 生态证明 SDL2 能上屏，它成功而 egl-fb 失败 → 裸 EGL 细节问题）。

### 七、部署与 TF 卡分区经验（全是实测踩出来的）

#### 分区约定（ThinkPad 上 lsblk 实测）

| 分区 | 文件系统 | 设备路径 | ThinkPad 挂载点 |
|---|---|---|---|
| p1 EMUELEC | vfat | boot | /mnt/r36s/boot |
| p2 STORAGE | ext4 | **设备上的 /storage**（logs/saves 在此） | /mnt/r36s/storage |
| p3 EEROMS | vfat | **设备上的 /storage/roms**（ports/ 在此） | /mnt/r36s/eroms |

**port 部署约定**（EmuELEC 的 PortMaster 式结构）：launcher 脚本 → `EEROMS/ports_scripts/<名>.sh`（**菜单就是扫这个目录的 .sh 文件**，所以只显示有 launcher 的 port）；二进制/资源目录 → `EEROMS/ports/<名>/`；launcher 里 `cd /storage/roms/ports/<名>`（设备侧路径）。菜单显示名默认取 .sh 文件名，`gamelist.xml` 可覆盖。

#### 挂载态拔卡的坑

TF 卡在**挂载状态下被拔出**（从读卡器直接拔），会导致挂载失效：

```bash
读取目录直接 Input/output error，但 dumpe2fs 显示 Filesystem state: clean
```

别急着 fsck——这通常是**失效挂载**而非文件系统损坏（dmesg 会有 `JBD2: I/O error when updating journal superblock`，那是拔卡时日志中止的正常表现）。`umount + 重新 mount` 即恢复。拔卡前先安全卸载。

#### FAT32 不支持符号链接

port 目录在 vfat 分区上，`ln -sf` 建的软链会失效（loader 报 `cannot open shared object file`）。需要本地"改名"的动态库（如把 `libSDL2-2.0.so.0` 当 `libSDL2.so.2` 用），用 **`cp -f` 复制**而不是软链。

### 八、交叉编译补充（上篇之外的测试侧技巧）

上篇讲了 zig 交叉编译 alsa/udev 系统库；这里补测试侧的三条：

1. **C 测试程序：zig cc 直出，零依赖、秒级构建**，全部 dlopen 动态加载 libmali（libEGL.so.1 / libGLESv2.so.2 / libgbm.so.1），stripped 后 15-46KB：

```bash
zig cc -target aarch64-linux-gnu -O2 -Wall main.c egl_load.c fb.c -ldl -o probe
```

2. **Rust：多个 Bevy 测试 crate 收成 Cargo workspace**——`wgpu-hal` 补丁和 `[profile.release]` 提到根 `Cargo.toml`，成员共享 target 缓存；`CARGO_TARGET_DIR` 指向旧缓存避免 Bevy 全量重编，增量构建 2-3 分钟：

```bash
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-<旧 target 缓存>}"
cargo zigbuild --release --target aarch64-unknown-linux-gnu --workspace
```

3. **链接期 stub 技巧**：本机没有目标库（如 SDL2）时，写一个空实现 stub .so（函数签名一致、返回 0），`-Wl,-soname,libSDL2.so.2` 编译；链接时给 stub 路径，DT_NEEDED 记录 SONAME；设备上 launcher 用 `cp -f` 把真库复制成同名文件 + `LD_LIBRARY_PATH`。注意：lld 不支持 GNU ld 的 `--unresolved-symbols=ignore-all`，所以必须用"stub 定义空实现"而不是"允许未定义符号"。

### 九、为什么"升级 Bevy"解决不了（方向是反的）

遇到 VERTEX_STORAGE 时最自然的想法是"换个新版 Bevy 试试"，实测结论是**越升越糟**：

| 版本 | wgpu | 结论 |
|---|---|---|
| 0.15 | 23 | 同架构同失败（VERTEX_STORAGE 判定不变） |
| 0.16 | 24 | 同上；且 **WebGL2 渲染器被移除**（web 只剩 WebGPU），GLES 支持更差 |
| 0.17 | 25/26 | **GLES 降级为可选 feature** `bevy_render/gles`（PR #20793），官方明言"未测试、可能坏"；渲染器大重构 |

R36S 只有 GLES 驱动（无 Vulkan/Metal），Bevy 越高版本 GLES 越被边缘化。**留在 0.14 + wgpu-hal 补丁 + 应用侧配置，是唯一既不动 Bevy 源码、又不用 SDL2 的路径。**

### 十、给三类读者的速查（更新版：从"无解"到"可解"）

#### 给人类开发者（30 秒结论）

上篇说 VERTEX_STORAGE 无解是**错的**。真相是 wgpu-hal 的 limit 判定用 fragment 顶替 vertex，误导 Bevy 给顶点可见数据选 storage；把 `max_storage_buffers_per_shader_stage` 报成 0，Bevy 的 WebGL2 同款 uniform 回退自动接管；再往渲染世界插 `GpuPreprocessingSupport::None` 关掉 GPU 预计算（它判定不严，只查 workgroup size 不看 storage limit）。显示走离屏渲染 → CPU 读回 → 写 `/dev/fb0`（640×480 32bpp），不需要 SDL2。

#### 给对话式 AI（问答速查）

- **Bevy 在无 X11/Wayland 的嵌入式设备上怎么跑？** 禁用 WinitPlugin、WindowPlugin 设 `primary_window: None`，用 ScheduleRunnerPlugin 驱动主循环；渲染目标用离屏纹理，读回后写 fb。
- **wgpu 报 VERTEX_STORAGE downlevel flag 缺失？** 说明有 storage 绑定暴露给顶点阶段。查 wgpu-hal GLES adapter 的 `max_storage_buffers_per_shader_stage`——顶点 SSBO=0 时它可能用 fragment 数量顶替，误导上层选 storage。把 limit 报 0，上层走 uniform 回退。
- **报 "Too many bindings of type StorageBuffers in Stage ShaderStages(COMPUTE)"？** Bevy 0.14 GPU 预计算自启用判定只看 compute workgroup size、不看 storage limit；应用侧往渲染世界插入 `GpuPreprocessingSupport::None` 即走 CPU 预处理回退。
- **EGL 初始化失败（DEFAULT_DISPLAY 返回 NULL）？** 驱动可能是 GBM winsys：查 `eglQueryString(EGL_NO_DISPLAY, EGL_EXTENSIONS)`，有 `EGL_KHR_platform_gbm` 就用 `eglGetPlatformDisplayEXT(EGL_PLATFORM_GBM_KHR, gbm_device, NULL)`。
- **升级 Bevy 能解决吗？** 不能。0.15/0.16 同架构同问题；0.17 把 GLES 降级为未测试的可选 feature。

#### 给代码 Agent（可执行清单）

```text
1. headless 三件套：WinitPlugin::disable + WindowPlugin{primary_window:None} + ScheduleRunnerPlugin
2. wgpu-hal vendor 补丁（src/gles/egl.rs）：EGL_KHR_platform_gbm 平台分支，
   dlopen libgbm → gbm_create_device(/dev/dri/card0) → eglGetPlatformDisplayEXT(GBM)
3. wgpu-hal vendor 补丁（src/gles/adapter.rs）：GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS==0
   且非 RPI4 假零 → max_storage_buffers_per_shader_stage = 0（触发上层 uniform 回退）
4. 应用侧（add_plugins 后、run 前）：
   app.get_sub_app_mut(RenderApp).world_mut().insert_resource(GpuPreprocessingSupport::None)
5. 显示：离屏纹理 → ImageCopyPlugin 读回 → 按 /sys/class/graphics/fb0/ 的 bits_per_pixel
   转换（16=RGB565 / 32=XRGB8888）→ pwrite /dev/fb0
6. 部署：launcher → EEROMS/ports_scripts/，二进制目录 → EEROMS/ports/<名>/；
   FAT32 上动态库改名用 cp 不用 ln -s；拔卡先卸载
7. 交叉编译：C 用 zig cc -target aarch64-linux-gnu；Rust 用 cargo zigbuild
   （CARGO_TARGET_DIR 复用缓存）；缺目标库用空实现 stub .so + DT_NEEDED
```

### 尾声（更新至第三轮上机）

截至 2026-08-03 三轮上机：裸 EGL 上屏（egl-fb）、纯 CPU 写屏（fb0-cpu）、环境探针（probe）、SDL2/KMSDRM 锚点（sdl2-gles）全部 PASS——**显示链路的 fb0 与 KMSDRM 两条路都通了**。

Bevy 侧：3D 已越过 VERTEX_STORAGE 与 GPU 预计算两道坎，第三轮暴露出最后一个问题——当初为绕 VERTEX_STORAGE 禁用的 SpritePlugin 导致 bevy_text 的 `Assets<TextureAtlasLayout>` 缺失（limit 补丁后已无禁用必要，恢复即可）；2D 第三轮卡死（无 panic，疑似渲染循环/等待卡住，待调试）；wgpu-direct 第三轮日志缺失待复测。补丁与修复均已部署到卡，正在推进最后一步。

贯穿始终的洞见：**嵌入式设备跑 Bevy 不是玄学，要找的是"驱动能力判定链条里哪一环在撒谎"**——wgpu-hal 用 fragment 顶替 vertex 的 limit 兜底、Bevy 预计算只看 workgroup size 不看 storage limit，两处"判定不严"造成了两次假死。把它们揪出来，剩下的就是 WebGL2 时代就铺好的 uniform 回退路径。

空实现 stub .so + DT_NEEDED

---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/bevy-0.14-r36s-rendering.html
