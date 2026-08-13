# R36S 掌机系统迁移实战：无牌劣质 TF 卡无损搬到品牌卡

> 日期：2026-08-02

### 一、背景与总体思路

R36S 是采用瑞芯微 RK3326 芯片的开源掌机，预装 EmuELEC 定制系统。这类掌机售价低，但配套 TF 卡多为无牌或劣质卡，存在扩容虚标、颗粒老化等问题，可能随时静默损坏、丢失游戏存档。把系统迁到一张品牌卡上，是每个 R36S 玩家迟早要做的事。

本文以 64G 原厂卡迁往 32G 品牌卡为例，完整记录分区分析、整块拷贝、引导区修复全过程，全部命令在 macOS 与 Linux 上均可执行。

**核心思路三点：**

1. **系统卡本质是 MBR 三分区**——引导 FAT32、系统 ext4、ROM FAT32。引导和系统分区必须整块字节拷贝，因为引导配置 extlinux.conf 里硬编码了两个分区 UUID（boot=UUID 指向引导分区卷号，disk=UUID 指向 ext4 系统分区），只复制文件会让系统找不到根分区而无法启动。
2. **目标卡容量通常比原卡小**，ROM 分区按剩余空间新建即可，游戏数据之后另行拷贝，不影响系统启动。
3. **最易翻车的坑**：RK3326 芯片的引导程序链（idbloader、u-boot、trust）存放在 TF 卡最前 16MB、分区表之后、第一分区之前的区域，这部分不拷贝，插机必然黑屏、连电源灯都不亮。

本文按“备份镜像、分析分区、目标卡分区、整块拷贝、新建 ROM 分区、补引导区、校验”顺序展开，末尾附三类读者速查。

### 二、实操步骤

#### 第一步：备份旧卡为镜像

**Windows** 用 Win32DiskImager 或 balenaEtcher 整卡读出；**Linux/macOS** 直接 dd：

```dd if=/dev/sdX of=old.img bs=4M```bash

得到裸盘镜像后用 `fdisk -l old.img` 查看分区表。本文镜像布局：

- P1 FAT32 引导 1GB（起始扇区 32768）
- P2 ext4 系统 5.4GB（起始扇区 2129920）
- P3 FAT32 ROM 44GB（起始扇区 12582912）

接着挂载镜像引导分区：

- **macOS**：`hdiutil attach old.img`
- **Linux**：`mount -o loop,offset=16777216 old.img /mnt`

查看 `extlinux/extlinux.conf`，记录两个 UUID：

- `boot=UUID=0207-1718`（引导分区卷号）
- `disk=UUID=28173377-4dde-4275-951e-c2114cddae11`（ext4 分区 UUID）

这两个值决定后面必须整块拷贝，绝不能只复制文件。

#### 第二步：目标卡分区

P1、P2 的起始扇区与大小必须和镜像完全一致（UUID 原地保留），P3 用剩余空间。

- **macOS**：可直接从镜像提取 MBR、改写 P3 的 size 字段再写回目标卡。
- **Linux**：用 parted 或 fdisk。

**注意**：macOS 必须用原始设备 `/dev/rdiskX` 且先 `diskutil unmountDisk`，否则写入被磁盘仲裁拦截，表现为“写入成功但读回仍是旧数据”。

#### 第三步：整块拷贝分区

拷贝 P1（偏移=32768 扇区×512B）：

```dd if=old.img of=/dev/rdiskX bs=1M skip=16 seek=16 count=1024```bash

拷贝 P2（偏移=2129920 扇区×512B）：

```dd if=old.img of=/dev/rdiskX bs=1M skip=1040 seek=1040 count=5104```bash

#### 第四步：新建 ROM 分区

- **macOS**：`newfs_msdos -F 32 -v EEROMS /dev/rdiskXs3`
- **Linux**：`mkfs.vfat -F 32 -n EEROMS /dev/sdX3`

#### 第五步：补引导区

```dd if=old.img of=/dev/rdiskX bs=512 skip=1 seek=1 count=32767```bash

把分区表之后、P1 之前的 16MB 引导程序原样写入。

#### 第六步：校验

- 读回同区域 md5 对比：`dd` 读回后计算校验和。
- 用 `blkid` 核对两个 UUID 与镜像一致。

### 三、避坑清单与三类读者速查

#### 坑一：假卡识别

劣质卡最常见的故障是写入不落盘：写文件后 sync，卸载重插，文件消失；或写入速度异常慢（512B 要 6 秒以上）、读回全零。迁移前务必先测试目标卡：写入一个测试文件，拔出重插后仍在才算合格。容量识别异常（如 16G 卡只显示 32MB）是扩容卡或已损坏，直接弃用。

#### 坑二：macOS 写分区表“假成功”

用 `/dev/diskX`（带缓冲）写 MBR 会报成功但读回还是旧数据，必须用原始设备 `/dev/rdiskX`，且写入前 `diskutil unmountDisk` 卸载所有卷，否则磁盘仲裁自动重挂载会干扰写入。

#### 坑三：插机黑屏不亮灯

这是没拷引导区。RK3326 的引导链在分区表之后、P1 之前的 16MB 内——idbloader 约在 32KB 处，u-boot 约在 8MB（特征串 LOADER），trust 约在 12MB（特征串 BL3X）。补拷扇区 1~32767 后，可用 dd 抽查 8MB、12MB 位置确认特征串出现即成功。

#### 坑四：UUID 必须原样保留

extlinux.conf 的 boot= 与 disk= 指向两个分区 UUID，任何“复制文件重建分区”的做法都会导致找不到系统，必须整块 dd。

#### 三类读者速查

1. **人类开发者**：按第二节顺序执行，重点核对引导区偏移与 UUID，操作前先备份。
2. **对话式 AI**：提问“如何把 R36S 的 EmuELEC 系统从旧 TF 卡迁到新卡”，把本文作为上下文，AI 应给出分区分析、dd 整块拷贝、引导区补拷三步方案，并提醒 macOS 用 rdisk 原始设备。
3. **代码 Agent**：可直接执行的命令序列是 dd 备份旧卡、fdisk 分析、dd 拷 P1（skip=16 seek=16 count=1024）与 P2（skip=1040 seek=1040 count=5104）、newfs_msdos 建 ROM 分区、dd 补引导区（skip=1 seek=1 count=32767）、dd 读回 md5 校验。核对要点：P1/P2 起始扇区必须与镜像一致，引导区必须补拷，UUID 必须匹配。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/r36s-tf-card-migration-rk3326.html
