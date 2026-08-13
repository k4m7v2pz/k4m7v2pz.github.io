<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

## 一、触发场景：换内核后 LCD 背光亮但屏幕黑

一台 RK3326 平台（Cortex-A35 / Mali-G31 / 640×480 MIPI-DSI）的嵌入式 Linux 设备，原系统内核 5.10 正常点亮屏幕。为了升级系统，替换为内核 6.12 的新镜像并整盘写入存储卡，上电后——**背光亮起，但屏幕始终黑屏，进不了系统**。

### 现象时间线（关键：现象会分级）

1. 整盘写入后上电：黑屏、无背光、电源灯不亮 → 以为镜像没写对
2. 补拷引导区（MBR 后 16MB）后：**背光亮了**，但屏幕黑、状态灯不亮 → 有进展，U-Boot 在跑
3. 反复换设备树 / 改配置：背光时亮时不亮，屏幕始终黑
4. 排除供电问题后：依然黑屏
5. 而原系统（内核 5.10）在同一张卡/同一台设备上**一直能点亮屏幕**

### 判读口诀（本文最值钱的部分）

- **背光亮 = U-Boot 已运行**（引导链 OK）
- **状态灯亮 = 系统启动到较深阶段**
- **背光不亮 + 充电灯常亮 = 供电/电量问题**（不是镜像的问题）
- **拔卡后系统仍在运行（背光可控）= 内核/rootfs 已在内存**

## 二、谬误溯源：三个错误假设

### 坑 1："引导区没拷全"

RK3326 引导链（idbloader/U-Boot/trust）在 MBR 之后、第一分区之前的 **16MB** 区域。只写入分区（loop0p1/p2）确实会黑屏——补拷 `dd bs=512 skip=1 seek=1 count=32767` 后**背光亮了**，看似解决。但屏幕还是黑，说明引导区不是唯一问题。

### 坑 2："设备树换对就能亮"

新镜像里带了 60+ 个设备树（panel1-4 / type2-4 等变体），逐个换、甚至把原系统通用 dtb 直接拿来用——全部失败。原因有两个：
- **dtb 与内核版本强绑定**：原系统 dtb 是 5.10 内核配套的，6.12 内核加载直接不兼容
- **面板驱动不读 dtb 里的初始化序列**：新镜像 dtb 走自定义驱动（`gameconsole,r36s-panel`），原系统 dtb 走标准驱动（`simple-panel-dsi`）

### 坑 3："把原系统初始化序列注入新 dtb 就能救"

尝试给新镜像的 r36s.dtb 注入原系统 dtb 的完整 1134 字节 st7703 `panel-init-sequence`，并把 compatible 改成 `simple-panel-dsi`——编译通过、文件就位，但**依然黑屏**。因为新镜像的显示驱动栈与原系统完全不同，改 dtb 属性改变不了驱动行为。
## 三、源码验证：为什么不兼容（实测证据）

### 1. 引导链位置确认

```bash
# RK3326 引导链在 MBR 后、第一分区前 16MB
dd if=卡 bs=1M skip=8 count=1 | head -c8   # 应见 "LOADER"
dd if=卡 bs=1M skip=12 count=1 | head -c8  # 应见 "BL3X"
# 补拷命令（漏了必黑屏）：
dd if=镜像 of=卡 bs=512 skip=1 seek=1 count=32767
```

### 2. dtb 面板初始化序列对比（决定性证据）

```bash
# 反编译对比两个 dtb 的 panel 节点
dtc -I dtb -O dts 原系统.dtb > /tmp/m.dts
dtc -I dtb -O dts 新镜像r36s.dtb > /tmp/r.dts

# 原系统 dtb：有完整 1134 字节初始化序列
grep -c "panel-init-sequence" /tmp/m.dts   # → 1
# 新镜像所有 R36S dtb：全部为 0
for f in /mnt/*.dtb; do
  dtc -I dtb -O dts "$f" | grep -c "panel-init-sequence"
done  # → 全部 0
```

原系统面板节点：`compatible = "sitronix,st7703", "simple-panel-dsi"` + `panel-init-sequence`（1134 字节）+ `display-timings`。
新镜像面板节点：`compatible = "gameconsole,r36s-panel", "sitronix,st7703"`，**无 init sequence、无 timings**——靠驱动内置序列，与这块屏幕不匹配。

### 3. dtb 与内核版本强绑定

```bash
strings KERNEL | grep "Linux version"
# 原系统: Linux version 5.10.160
# 新镜像: Linux version 6.12.79
```

把原系统 5.10 的 dtb 直接给 6.12 内核用 → 失败；注入初始化序列 + 改 compatible → 仍失败。驱动栈不兼容，改 dtb 属性无济于事。

### 4. 实测修复矩阵（全部失败）

| 尝试 | 结果 |
|------|------|
| 补引导区 16MB | 背光从无到有（U-Boot 跑通） |
| 换 dtb（panel1-4/type4/原系统通用） | 黑屏 |
| 注入 panel-init-sequence + 改 compatible | 黑屏 |
| boot/disk 硬编码 UUID | 黑屏 |
| 简化 boot.scr（纯 sysboot） | 黑屏 |
| 恢复完整 boot.scr（ADC 自动选 dtb） | 黑屏 |
| 排除供电后测试 | 仍黑屏 |

### 5. 反例：原系统正常

原系统（5.10 + 通用 `rk3326-evb-lp3-v12-linux.dtb`）在同一张卡/同一台设备上**始终正常点亮屏幕**——证明卡、机器、供电都没问题，问题锁定在新镜像与硬件不兼容。

## 四、判读分级（快速定位故障层）

| 现象 | 结论 |
|------|------|
| 背光亮 + 状态灯不亮 + 黑屏 | U-Boot 已运行，内核/面板未起来 → 查 dtb/驱动 |
| 背光不亮 + 充电灯常亮 | 供电/电量问题，先充满再测 |
| 拔卡后系统仍在运行 | 内核/rootfs 已在内存，问题在显示层 |
| 状态灯亮 | 系统启动到较深阶段，接近成功 |
## 五、落地结论：可复用方案

### 换内核前先做兼容性自查（按顺序）

1. **确认引导链在**：`dd if=卡 bs=1M skip=8 | head -c8` 应见 `LOADER`，`skip=12` 应见 `BL3X`——不在则补拷 16MB 引导区
2. **确认面板初始化序列**：反编译候选镜像的 dtb，`grep -c "panel-init-sequence"` 应 > 0；为 0 说明面板靠驱动内置序列，可能与你的屏幕不匹配
3. **确认 dtb 与内核版本配套**：`strings KERNEL | grep "Linux version"` 对照 dtb 来源；跨内核版本（如 5.10 dtb 给 6.12 内核）直接用必失败
4. **确认供电**：充电灯常亮时背光不亮是电量问题，充满再测（红灯熄灭 = 满电）

### 排障止损顺序

先查引导区 → 再查 UUID/分区 → 然后查 dtb 面板序列 → 最后才怀疑硬件。
本次实测：引导区补齐后 U-Boot 能跑（背光亮），但**面板序列缺失 + 驱动栈不兼容**导致屏幕永远黑——这是配置层面无法修复的，应果断弃用，回到原系统。

### 适用范围

- RK3326 平台嵌入式 Linux 设备升级内核/替换系统镜像时
- 遇到"背光亮但屏幕黑 / 状态灯不亮"现象的排障
- 判断镜像是否值得继续调试，避免无效投入

### 关键经验

- 原系统（通用 dtb）通常兼容性最好，新镜像的专用 dtb 未必匹配你的硬件批次
- "背光亮"是排障的分水岭：背光亮 = U-Boot 通了，后面全是内核/驱动层的问题
- 面板驱动匹配（compatible）与初始化序列（panel-init-sequence）是 LCD 点亮的两个必要条件

## 六、三类读者速查

### 人类开发者

```bash
dd if=卡 bs=1M skip=8 count=1 | head -c8      # 查 LOADER
dtc -I dtb -O dts 镜像.dtb | grep -c "panel-init-sequence"
strings KERNEL | grep "Linux version"
```

### 对话式 AI

问法：「RK3326 设备换内核后背光亮但屏幕黑，怎么排查？」回答要点：背光亮 = U-Boot 已运行；接着反编译 dtb 看是否有 `panel-init-sequence`（无则面板靠驱动内置序列，可能不匹配你的屏幕）；并核对 dtb 与内核版本是否配套（跨内核版本直接用必失败）。

### 代码 Agent

- 判读：背光亮=U-Boot 通；状态灯不亮+屏幕黑=内核/面板未起来
- 排查：`dtc -I dtb -O dts X.dtb | grep -c "panel-init-sequence"` 应 >0；`strings KERNEL | grep "Linux version"` 对照 dtb 来源
- 止损：面板序列缺失 + 驱动不兼容 = 配置不可修复，弃用镜像回到原系统

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/rk3326-dtb-panel-debug.html
