# R36S Handheld Game Migration Field Notes: EmuELEC Dual-Card Cleanup

> Date: 2026-08-02

### 1. Background

The R36S is a common open-source handheld. It ships with a stock 64G TF card pre-flashed with the EmuELEC system and games preinstalled for dozens of platforms. The stock card looks roomy, but platforms like PSP, NEOGEO, GBA, N64, GBC, and arcade each take several gigabytes; for a player who only plays Famicom (FC/NES) and Super Famicom (SFC/SNES), nine-tenths of the content is "flash-storage garbage" that will never be used. This article records one complete migration: moving the FC/SFC/NES/SNES game sets (including hacks) from the stock 64G card onto a new 32G OS card, keeping the Sega RTS gems (Command & Conquer, Dune) and the TwinBee series along the way, then wiping the ~30G of other platforms from the 64G card. Everything is done with Linux's built-in mount, rsync, find, rm and similar commands — no special tools needed.

### 2. EmuELEC's OS Card Layout

Use lsblk to see the partitions on both cards (the 32G card appears as mmcblk0 in the onboard reader, the 64G card as sdf in the USB reader):

```mmcblk0  29.7G          ← 32G OS 卡
├─mmcblk0p1  1G    EMUELEC  vfat   引导
├─mmcblk0p2  5G    STORAGE  ext4   系统/配置/存档
└─mmcblk0p3  23.7G EEROMS   vfat   游戏仓库

sdf      50.4G          ← 64G 原厂卡
└─sdf3    44.1G EEROMS  vfat   游戏仓库```bash

Three key takeaways:

1. **All games live in the EEROMS partition**, organized into per-platform directories: famicom (FC Japanese / Chinese curated), nes (FC US / translated), snes and sfc (SFC), snes-hacks (SFC hacks), megadrive/genesis (Sega MD), gb (Game Boy), etc.; each directory in the EmuELEC menu corresponds to one platform.
2. **Platform directories contain metadata besides ROMs**: gamelist.xml (the Chinese game-name list) and images/ thumbnails. Copy the whole directory and the boot menu shows Chinese names and cover art, exactly like the stock card.
3. **vfat partitions can be mounted and written directly by Linux**, with no Windows tools needed; but vfat has no POSIX permissions, so writing requires root (sudo).

### 3. The Migration in Practice (Full Command Flow)

#### 3.1 Mount both cards' EEROMS partitions

```sudo mount /dev/sdf3 /mnt/sdf3
sudo mount /dev/mmcblk0p3 /mnt/test3```bash

#### 3.2 Copy the FC/SFC/NES/SNES directories wholesale (~6G, tens of thousands of files)

Run it in the background so an SSH disconnect can't interrupt it:

```rsync -a /mnt/sdf3/famicom/    /mnt/test3/famicom/
rsync -a /mnt/sdf3/nes/        /mnt/test3/nes/
rsync -a /mnt/sdf3/snes/       /mnt/test3/snes/
rsync -a /mnt/sdf3/sfc/        /mnt/test3/sfc/
rsync -a /mnt/sdf3/snes-hacks/ /mnt/test3/snes-hacks/```bash

It's best to write the commands into a script file, run it under nohup in the background, then poll for a completion marker:

```sudo nohup bash /tmp/copy.sh > /tmp/copy.log 2>&1 &```bash

#### 3.3 Copy the selected games individually (Command & Conquer / Dune / TwinBee, 15 total)

Put them in a "curated" subdirectory under the corresponding platform directory so they form a separate row in the menu:

```cp "/mnt/sdf3/megadrive/MD精选合集(含全部中文)/命令与征服1.bin.zip" /mnt/test3/megadrive/精选/
cp "/mnt/sdf3/megadrive/MD大全集(不含中文)/沙丘魔堡2德.zip" /mnt/test3/megadrive/精选/
cp "/mnt/sdf3/gb/射击飞行/兵蜂.zip" /mnt/test3/gb/精选/```bash

#### 3.4 Verify: source and destination file counts must match

```find /mnt/sdf3/nes  -type f | wc -l   # 10232
find /mnt/test3/nes -type f | wc -l   # 10232```bash

Compare the five directories one by one; only when the numbers match exactly is it a success (they all matched this time).

#### 3.5 Clean up the 64G card: stage first, delete, then restore

Deleting is permanent, so first `mv` the treasures to keep into a `_保留` directory, and move them back into "curated" after deletion:

```mv "/mnt/sdf3/megadrive/MD精选合集(含全部中文)/命令与征服1.bin.zip" /mnt/sdf3/_保留/
rm -rf /mnt/sdf3/psp /mnt/sdf3/neogeo /mnt/sdf3/gba /mnt/sdf3/gbc /mnt/sdf3/n64
rm -rf /mnt/sdf3/nds /mnt/sdf3/mame /mnt/sdf3/cps1 /mnt/sdf3/cps2 /mnt/sdf3/cps3
rm -rf /mnt/sdf3/arcade /mnt/sdf3/ports /mnt/sdf3/psx /mnt/sdf3/mastersystem
rm -rf /mnt/sdf3/gamegear /mnt/sdf3/pcengine /mnt/sdf3/themes /mnt/sdf3/videos
rm -rf /mnt/sdf3/tools /mnt/sdf3/BGM
mkdir -p /mnt/sdf3/megadrive/精选
mv /mnt/sdf3/_保留/命令与征服1.bin.zip /mnt/sdf3/megadrive/精选/```bash

#### 3.6 Unmount and safely eject

```sync
sudo umount /mnt/sdf3 /mnt/test3
udisksctl power-off -b /dev/sdf```bash

#### Result

The 64G card's usage dropped from ~37G to 8G, freeing ~29G; the 32G card now only holds the FC/SFC/NES/SNES sets + 15 curated games, ~7.7G total, leaving 16G for future expansion.

### 4. Quick Reference for Three Kinds of Readers

#### 4.1 Platform directory table for human developers

| Directory | Platform | Notes |
|---|---|---|
| famicom | FC | Japanese / Chinese curated |
| nes | FC | US / translated collection |
| snes / sfc | SFC | two separate menus |
| snes-hacks | SFC hacks | infinite-life / invincible versions |
| megadrive / genesis | Sega MD | US/JP two sets |
| gb / gbc / gba | Nintendo handhelds | - |

Key points: when copying a platform directory, copy gamelist.xml and images together, or the menu won't show Chinese names and cover art; verify file counts before deleting; vfat writes require sudo.

#### 4.2 Recommended question template for conversational AI (ChatGPT/Tencent Yuanbao/Doubao)

"On an R36S handheld with the EmuELEC system, the 32G OS card should keep only FC/SFC/NES/SNES games, and the stock 64G card has the full game library; how do I copy the corresponding platform directories over and clean up the extra platforms?"

The AI will give the same mount, rsync, verify, and clean-up flow as this article. Common Q&A: "What's the difference between nes and famicom?" — Answer: they are the Japanese and US ROM sets of the same FC platform, two separate menus in EmuELEC; keep both.

#### 4.3 For code agents (Copilot/Trae/AtomCode), execute these steps directly

1. Use lsblk to confirm both cards' device names and partitions;
2. Mount the two EEROMS partitions;
3. rsync -a the five directories famicom/nes/snes/sfc/snes-hacks;
4. Use find + wc -l to verify source/target file counts match one by one;
5. Before cleaning the 64G card, mv the files to keep into the `_保留` directory;
6. sync, umount, and udisksctl power-off for a safe eject.

### 5. Pitfalls Encountered

1. **Nested quotes in rsync can break**: when running a long command containing && and Chinese paths over SSH, the outer shell eats the quotes and causes a syntax error. The safest approach is to write the commands into a script file (transfer it as base64, then decode) and execute it as one unit.
2. **Quote Chinese paths**: directory names contain spaces and square brackets (e.g. "52.沙丘魔堡 HACK版.zip"), so wrap the whole path in double quotes for cp/mv.
3. **Non-POSIX login shells**: when the target machine's login shell isn't bash (e.g. rvs), semicolons don't separate commands and $var isn't expanded — always execute via `ssh host 'bash -c "..."'` or a script file.
4. **"Red Alert" is actually "Red Zone"**: the Sega RTS games on the stock card are the Command & Conquer series and Dune II; there's no game called "Red Alert" — don't look for the wrong one and don't delete the wrong thing.
5. **Hacks live in separate directories**: SFC hacks are in snes-hacks, while FC hacks hide inside subdirectories like 001外星科技RPG under famicom — easy to miss when copying.
