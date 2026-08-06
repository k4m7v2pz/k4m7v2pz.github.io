## 一、触发场景：R36S 双卡分离梦魇

R36S 开源掌机（RK3326 / Mali-G31 / 640×480 LCD）有两个 TF 卡槽：**右侧 = OS 槽，左侧 = game 槽**。很多玩家第一反应是"一张装系统、一张装游戏"，但实际买回来的商家固件（EmuELEC 定制版）插右侧系统卡能开机，左侧插游戏卡却**毫无反应**——游戏只能跟系统挤在同一张卡上，想加游戏还得来回倒腾。

### 现象时间线

1. 商家 64G 卡（EmuELEC 系统）插右侧 OS 槽：正常开机
2. 左侧插任何 game 卡：系统里完全看不到，游戏库还是原来那些
3. 网上查"EmuELEC 双卡"，说法五花八门：有的说只支持单卡、有的说需要改配置、有的说换固件
4. 实测折腾：下载了另一套"懒人固件"（ROCKNIX/ArkOS 6.12 内核），结果**完全黑屏**（背光亮但屏幕无画面、指示灯不亮），商家系统却一直正常
5. 最后回到商家 EmuELEC，从它的挂载逻辑入手，成功实现双卡分离

### 目标

- 32G 卡 = 系统卡（右侧 OS 槽，只装系统）
- 64G 卡 = 游戏卡（左侧 game 槽，只放游戏）
- 开机后游戏库自动变成 game 卡内容

## 二、谬误溯源：两个坑

### 坑 1：EmuELEC 不支持双卡？

错。EmuELEC 原生支持双卡，挂载逻辑在系统里写死了：

- 配置文件 `.config/emuelec/configs/emuelec.conf` 有 `ee_mount.handler=eemount`（C 写的挂载处理器）
- 系统内还有 `mount_romfs.sh`（旧版 Bash 实现）和 `storage-roms.mount.sample`（systemd 模板）
- `eemount` 二进制里明确有 `Trying to mount EEROMS to ...` 和 `Last hope, mounting LABEL=EEROMS directly`

**真正的原因**：游戏卡必须有一个**卷标为 `EEROMS` 的 vfat 分区**，EmuELEC 启动时靠 `LABEL=EEROMS` 兜底挂载它，把 `/storage/roms` 指向游戏卡。直接插一张没分区/没卷标的卡，eemount 找不到标记就跳过——表现为"没反应"。

### 坑 2：系统卡必须整卡对拷？

商家系统卡的迁移确实有讲究，但不是"整卡 dd 到新卡"这么简单：

- 系统卡 MBR 三分区：P1 `EMUELEC`（vfat boot，1G，起始扇区 32768）、P2 `STORAGE`（ext4，5G，起始扇区 2129920）、P3 `EEROMS`（vfat，游戏）
- **P1/P2 的起始扇区与大小必须和原镜像完全一致**（引导配置 `boot=UUID=... disk=UUID=...` 硬编码了分区 UUID）
- **RK3326 引导链（idbloader/U-Boot/trust）在 MBR 之后、P1 之前的 16MB**，只拷分区不拷引导区必然黑屏

所以系统卡要"整块 dd P1/P2 + 补引导区"，游戏卡则只需要"一个 EEROMS 卷标分区"。
## 三、源码验证：eemount 的双卡挂载逻辑（实测）

### 1. 商家 EmuELEC 系统的挂载配置

在系统卡 P2（STORAGE 分区）的 `.config/emuelec/configs/emuelec.conf`：

```ini
## Mount handler: eemount (newer, C) or mount_romfs.sh (older, Bash)
#ee_mount.handler=eemount
ee_mount.retry=1
```

`eemount` 二进制（`/usr/sbin/eemount`）的关键字符串：

```text
Trying to mount EEROMS to ...
Last hope, mounting LABEL=EEROMS directly
Checking if external system directory ... exists and create it if neccessary
Skipped external drive ... mark file ... does not exist
```

结论：**eemount 扫描所有外部驱动，优先找 EEROMS 卷标分区，找不到就用 `LABEL=EEROMS` 兜底**。这就是游戏卡必须带 EEROMS 卷标的原因。

### 2. 系统卡迁移（商家 64G → 32G）

```bash
# 原镜像分区（fdisk 确认起始扇区）
#   P1: 32768 起 1G vfat EMUELEC (boot)
#   P2: 2129920 起 5G ext4 STORAGE

# 目标卡重建分区（起始扇区必须与镜像一致）
sfdisk /dev/mmcblk0 <<EOF
label: dos
32768, 2097152, c, *
2129920, 10452992, 83
EOF

# 整块 dd P1 / P2（UUID 原地保留）
dd if=full_disk_image.img of=/dev/mmcblk0 bs=1M skip=16 seek=16 count=1024
dd if=full_disk_image.img of=/dev/mmcblk0 bs=1M skip=1040 seek=1040 count=5104

# 补引导区（MBR 之后、P1 之前 16MB：idbloader/U-Boot/trust）
dd if=full_disk_image.img of=/dev/mmcblk0 bs=512 skip=1 seek=1 count=32767
```

### 3. 游戏卡制作（64G）

```bash
# 单 vfat 分区 + 卷标 EEROMS
sfdisk /dev/sde <<EOF
label: dos
, , c
EOF
mkfs.vfat -F 32 -n EEROMS /dev/sde1

# 游戏目录直接放分区根目录
mount /dev/sde1 /mnt/gamecard
cp -a /原游戏目录/{nes,snes,sfc,famicom,genesis,megadrive,ports} /mnt/gamecard/
```

### 实测数据（2026-08-07）

- 32G 系统卡单独开机：电池图标 → R36S 开机画面 → 正常进 EmuELEC
- 加插 64G 游戏卡（EEROMS 卷标）重启：进系统后 **All Games 识别 15928 个游戏**
- 12 个精选平台目录共 13G：famicom 387M / fds / nes 1.4G / sfc 3.3G / snes 2.5G / genesis 1.3G / megadrive 2.6G / mastersystem 171M / segacd / sega32x / sg-1000 / ports 1.1G
- e2fsck / fsck.vfat 全部通过，UUID 与镜像一致（`boot=UUID=0207-1718 disk=UUID=28173377-...`）
## 四、落地结论：可复用方案

### 双卡分离三步走

1. **系统卡（右侧 OS 槽）**：从商家原镜像迁移
   - P1/P2 起始扇区与镜像完全一致（UUID 保留），整块 dd
   - 补引导区 `skip=1 seek=1 count=32767`（16MB 引导链，漏了必黑屏）
   - 系统卡不需要带游戏分区，P3 可省略

2. **游戏卡（左侧 game 槽）**：单 vfat 分区 + 卷标 `EEROMS`
   - `mkfs.vfat -F 32 -n EEROMS`，平台目录直接放根目录
   - EmuELEC 启动时 `eemount` 靠 `LABEL=EEROMS` 自动挂载为 `/storage/roms`

3. **上机验证**：系统卡开机 → 正常后关机加插游戏卡 → 重启，游戏库应为游戏卡内容

### 适用范围

- R36S / RK3326 系列开源掌机（EmuELEC 定制系统均可）
- 想"OS 卡 + 游戏卡分离"、游戏库独立扩充的玩家
- 已有一张能开机系统卡 + 想加第二张游戏卡的场景

### 关键判断顺序

先看挂载标记（EEROMS 卷标）→ 再看系统卡 UUID/引导区 → 最后才怀疑系统不支持。
实测 EmuELEC 双卡是原生功能，商家"game 卡没反应"九成是分区/卷标问题。

### 避坑清单

- 游戏卡没分区/卷标 → 没反应：`mkfs.vfat -F 32 -n EEROMS` 解决
- 系统卡 UUID 不一致 → 找不到系统：必须整块 dd，不能只复制文件
- 系统卡漏引导区 → 黑屏：补 `count=32767`（16MB）
- 想换 ROCKNIX/ArkOS 懒人固件 → 本机实测黑屏不兼容，EE 系统最稳

## 五、三类读者速查

### 人类开发者

```bash
sfdisk /dev/sdX <<EOF   # 游戏卡：单 vfat 分区
label: dos
, , c
EOF
mkfs.vfat -F 32 -n EEROMS /dev/sdX1   # 卷标必须 EEROMS
```

### 对话式 AI

问法：「R36S 双卡分离，游戏卡插左边没反应怎么解决？」回答要点：检查游戏卡是否为 `EEROMS` 卷标的 vfat 分区——EmuELEC 的 eemount 靠 `LABEL=EEROMS` 挂载 `/storage/roms`，没有卷标就跳过。

### 代码 Agent

- 系统卡迁移：`dd if=镜像 of=卡 bs=1M skip=16 seek=16 count=1024`（P1）+ `skip=1040 seek=1040 count=5104`（P2）+ `bs=512 skip=1 seek=1 count=32767`（引导区），P1/P2 起始扇区与镜像一致
- 游戏卡：`mkfs.vfat -F 32 -n EEROMS`，平台目录放根目录
- 验证：`blkid` 查 UUID/卷标；上机看 All Games 数量（实测 15928）
