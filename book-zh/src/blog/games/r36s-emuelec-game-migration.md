<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# R36S 掌机游戏迁移实录：EmuELEC 双卡整理

> 日期：2026-08-02

### 一、背景

R36S 是常见的开源掌机，出厂自带一张 64G 原厂 TF 卡，刷好 EmuELEC 系统并预装几十个平台的游戏。原厂卡看着容量不小，但 PSP、NEOGEO、GBA、N64、GBC、街机等平台动辄几个 G，对只玩红白机（FC/NES）和超任（SFC/SNES）的玩家来说，九成内容是用不上的"占闪存垃圾"。本文记录一次完整迁移：把原厂 64G 卡上的 FC/SFC/NES/SNES 四套游戏（含改版）搬到一张新的 32G OS 卡，顺带保留世嘉平台的 RTS 精品（命令与征服、沙丘魔堡）和兵蜂系列，再把 64G 卡上约 30G 的其它平台全部清掉。全程只用 Linux 自带的 mount、rsync、find、rm 等命令，不依赖专用工具。

### 二、EmuELEC 的 OS 卡结构

用 lsblk 看清两张卡的分区（32G 卡在板载读卡器为 mmcblk0，64G 卡在 USB 读卡器为 sdf）：

```mmcblk0  29.7G          ← 32G OS 卡
├─mmcblk0p1  1G    EMUELEC  vfat   引导
├─mmcblk0p2  5G    STORAGE  ext4   系统/配置/存档
└─mmcblk0p3  23.7G EEROMS   vfat   游戏仓库

sdf      50.4G          ← 64G 原厂卡
└─sdf3    44.1G EEROMS  vfat   游戏仓库```bash

三个关键认知：

1. **游戏全在 EEROMS 分区**，按平台建目录：famicom（FC 日版/中文精选）、nes（FC 美版/汉化）、snes 与 sfc（SFC）、snes-hacks（SFC 改版）、megadrive/genesis（世嘉 MD）、gb（Game Boy）等，EmuELEC 菜单里每个目录对应一个平台。
2. **平台目录里除了 ROM 还有元数据**：gamelist.xml（中文游戏名列表）和 images/ 缩略图。整目录复制后，开机菜单直接显示中文名和封面，与原厂卡体验一致。
3. **vfat 分区可被 Linux 直接挂载读写**，无需 Windows 工具；但 vfat 无 POSIX 权限，写入需要 root（sudo）。

### 三、迁移实操（完整命令流程）

#### 3.1 挂载两张卡的 EEROMS 分区

```sudo mount /dev/sdf3 /mnt/sdf3
sudo mount /dev/mmcblk0p3 /mnt/test3```bash

#### 3.2 整目录复制 FC/SFC/NES/SNES（约 6G、上万个文件）

放后台执行，避免 SSH 断线中断：

```rsync -a /mnt/sdf3/famicom/    /mnt/test3/famicom/
rsync -a /mnt/sdf3/nes/        /mnt/test3/nes/
rsync -a /mnt/sdf3/snes/       /mnt/test3/snes/
rsync -a /mnt/sdf3/sfc/        /mnt/test3/sfc/
rsync -a /mnt/sdf3/snes-hacks/ /mnt/test3/snes-hacks/```bash

建议写成脚本文件后 nohup 挂后台，再轮询完成标记：

```sudo nohup bash /tmp/copy.sh > /tmp/copy.log 2>&1 &```bash

#### 3.3 精选游戏单独复制（命令与征服/沙丘魔堡/兵蜂共 15 个）

放到对应平台目录下的"精选"子目录，菜单里单独成一栏：

```cp "/mnt/sdf3/megadrive/MD精选合集(含全部中文)/命令与征服1.bin.zip" /mnt/test3/megadrive/精选/
cp "/mnt/sdf3/megadrive/MD大全集(不含中文)/沙丘魔堡2德.zip" /mnt/test3/megadrive/精选/
cp "/mnt/sdf3/gb/射击飞行/兵蜂.zip" /mnt/test3/gb/精选/```bash

#### 3.4 核验：源与目标文件数必须一致

```find /mnt/sdf3/nes  -type f | wc -l   # 10232
find /mnt/test3/nes -type f | wc -l   # 10232```bash

五个目录逐一对比，数字完全相等才算成功（本次全部一致）。

#### 3.5 清理 64G 卡：先暂存、再删除、后归位

删除是永久操作，先把要保留的宝物 mv 到 _保留 目录，删除完成后放回"精选"：

```mv "/mnt/sdf3/megadrive/MD精选合集(含全部中文)/命令与征服1.bin.zip" /mnt/sdf3/_保留/
rm -rf /mnt/sdf3/psp /mnt/sdf3/neogeo /mnt/sdf3/gba /mnt/sdf3/gbc /mnt/sdf3/n64
rm -rf /mnt/sdf3/nds /mnt/sdf3/mame /mnt/sdf3/cps1 /mnt/sdf3/cps2 /mnt/sdf3/cps3
rm -rf /mnt/sdf3/arcade /mnt/sdf3/ports /mnt/sdf3/psx /mnt/sdf3/mastersystem
rm -rf /mnt/sdf3/gamegear /mnt/sdf3/pcengine /mnt/sdf3/themes /mnt/sdf3/videos
rm -rf /mnt/sdf3/tools /mnt/sdf3/BGM
mkdir -p /mnt/sdf3/megadrive/精选
mv /mnt/sdf3/_保留/命令与征服1.bin.zip /mnt/sdf3/megadrive/精选/```bash

#### 3.6 卸载与安全弹出

```sync
sudo umount /mnt/sdf3 /mnt/test3
udisksctl power-off -b /dev/sdf```bash

#### 结果

64G 卡占用从约 37G 降到 8G，释放约 29G；32G 卡只保留 FC/SFC/NES/SNES 四套 + 15 个精选游戏，总占用约 7.7G，剩余 16G 可日后扩展。

### 四、面向三类读者的速查

#### 4.1 给人类开发者平台目录对应表

| 目录 | 平台 | 说明 |
|---|---|---|
| famicom | FC | 日版/中文精选 |
| nes | FC | 美版/汉化合集 |
| snes / sfc | SFC | 两个独立菜单 |
| snes-hacks | SFC 改版 | 无限命/无敌版 |
| megadrive / genesis | 世嘉 MD | 美/日两套 |
| gb / gbc / gba | 任天堂掌机 | - |

要点：复制平台目录要连同 gamelist.xml 和 images 一起复制，菜单才有中文名和封面；删除前先核验文件数；vfat 写入必须 sudo。

#### 4.2 给对话式 AI（ChatGPT/腾讯元宝/豆包）推荐提问模板

"R36S 掌机 EmuELEC 系统，32G OS 卡想只保留 FC/SFC/NES/SNES 游戏，原厂 64G 卡有全量游戏库，如何把对应平台目录复制过去并清理多余平台？"

AI 会给出与本文一致的挂载、rsync、核验、清理流程。常见问答：问"nes 与 famicom 有何区别"——答：同为 FC 平台的日版与美版两套 ROM，EmuELEC 里是两个独立菜单，都保留即可。

#### 4.3 给代码 Agent（Copilot/Trae/AtomCode）直接执行以下步骤

1. lsblk 确认两张卡的设备名与分区；
2. 挂载两个 EEROMS 分区；
3. rsync -a 复制 famicom/nes/snes/sfc/snes-hacks 五个目录；
4. find + wc -l 逐一核验源目标文件数一致；
5. 清理 64G 卡前先把要保留的文件 mv 到 _保留 目录；
6. sync、umount、udisksctl power-off 安全弹出。

### 五、踩坑记录

1. **rsync 多层引号嵌套会坏**：SSH 执行含 && 与中文路径的长命令时，外层 shell 会吃掉引号导致语法错误。最稳做法是把命令写成脚本文件（base64 传输再解码）再统一执行。
2. **中文路径要加引号**：目录名含空格和方括号（如"52.沙丘魔堡 HACK版.zip"），cp/mv 时整体加双引号。
3. **非 POSIX 登录壳**：目标机登录 shell 不是 bash 时（如 rvs），分号不分隔命令、$var 不展开，务必用 ssh host 'bash -c "..."' 或脚本文件方式执行。
4. **"红色警戒"其实叫"红色地带"**：原厂卡上的世嘉 RTS 是命令与征服系列与沙丘魔堡（Dune II），没有叫"红色警戒"的游戏，别找错也别误删。
5. **改版游戏是独立目录**：SFC 改版在 snes-hacks，FC 改版藏在 famicom 的 001外星科技RPG 等子目录，容易漏复制。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/r36s-emuelec-game-migration.html
