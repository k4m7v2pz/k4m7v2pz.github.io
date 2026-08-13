# R36S System Card and Game Card Separation: EmuELEC Dual-Card Setup

> Date: 2026-08-07

## 1. Trigger: The R36S Dual-Card Nightmare

The R36S open-source handheld (RK3326 / Mali-G31 / 640x480 LCD) has two TF slots: **right = OS slot, left = game slot**. Many players assume "one card for the system, one for games," but the stock merchant firmware (custom EmuELEC) boots from the right OS card while the left game slot **does nothing** — games stay crammed on the system card.

### Timeline

1. Merchant 64G card (EmuELEC) in right OS slot: boots fine
2. Any game card in the left slot: invisible to the system, game library unchanged
3. Online "EmuELEC dual-card" advice varies: single-card only / need config changes / switch firmware
4. Tried another "lazy firmware" (ROCKNIX/ArkOS 6.12): **completely black screen** (backlight on but no image, status LED off); stock system kept working
5. Returned to stock EmuELEC, dug into its mount logic, and achieved dual-card separation

### Goal

- 32G card = system card (right OS slot, system only)
- 64G card = game card (left game slot, games only)
- On boot, the game library automatically comes from the game card

## 2. Misdiagnoses: Two Traps

### Trap 1: "EmuELEC doesn't support dual cards"?

Wrong. EmuELEC natively supports dual cards; the mount logic is hardcoded in the system:

- `.config/emuelec/configs/emuelec.conf` has `ee_mount.handler=eemount` (C mount handler)
- System also ships `mount_romfs.sh` (older Bash) and `storage-roms.mount.sample` (systemd template)
- `eemount` binary literally contains `Trying to mount EEROMS to ...` and `Last hope, mounting LABEL=EEROMS directly`

**Real cause**: the game card must have a **vfat partition labeled `EEROMS`**. On boot EmuELEC mounts it via `LABEL=EEROMS` and points `/storage/roms` at the game card. A card without partition/label is skipped by eemount — the "no reaction."

### Trap 2: "System card must be copied whole"?

System card migration does have rules, but not simply "dd the whole image":

- System card MBR has 3 partitions: P1 `EMUELEC` (vfat boot, 1G, start sector 32768), P2 `STORAGE` (ext4, 5G, start 2129920), P3 `EEROMS` (vfat, games)
- **P1/P2 start sectors and sizes must match the source image exactly** (boot config hardcodes `boot=UUID=... disk=UUID=...`)
- **RK3326 boot chain (idbloader/U-Boot/trust) lives in the 16MB after MBR, before P1** — copying only partitions gives black screen

So: system card = "dd P1/P2 whole + copy bootloader region"; game card = "just one EEROMS-labeled partition."

## 3. Source Verification: eemount Dual-Card Mount Logic (Measured)

### 3.1 Mount config in stock EmuELEC

In system card P2 (STORAGE), `.config/emuelec/configs/emuelec.conf`:

```ini
## Mount handler: eemount (newer, C) or mount_romfs.sh (older, Bash)
#ee_mount.handler=eemount
ee_mount.retry=1
```

`eemount` binary (`/usr/sbin/eemount`) key strings:

```text
Trying to mount EEROMS to ...
Last hope, mounting LABEL=EEROMS directly
Checking if external system directory ... exists and create it if neccessary
Skipped external drive ... mark file ... does not exist
```

Conclusion: eemount scans external drives, prefers an EEROMS-labeled partition, falls back to `LABEL=EEROMS`. That's why the game card needs the EEROMS label.

### 3.2 System card migration (merchant 64G → 32G)

```bash
# Source image partitions (fdisk)
#   P1: 32768, 1G vfat EMUELEC (boot)
#   P2: 2129920, 5G ext4 STORAGE

# Target card repartition (start sectors must match source)
sfdisk /dev/mmcblk0 <<EOF
label: dos
32768, 2097152, c, *
2129920, 10452992, 83
EOF

# dd P1 / P2 whole (UUID preserved in place)
dd if=full_disk_image.img of=/dev/mmcblk0 bs=1M skip=16 seek=16 count=1024
dd if=full_disk_image.img of=/dev/mmcblk0 bs=1M skip=1040 seek=1040 count=5104

# Copy bootloader (16MB after MBR: idbloader/U-Boot/trust)
dd if=full_disk_image.img of=/dev/mmcblk0 bs=512 skip=1 seek=1 count=32767
```

### 3.3 Game card (64G)

```bash
sfdisk /dev/sde <<EOF
label: dos
, , c
EOF
mkfs.vfat -F 32 -n EEROMS /dev/sde1

mount /dev/sde1 /mnt/gamecard
cp -a /games/{nes,snes,sfc,famicom,genesis,megadrive,ports} /mnt/gamecard/
```

### Measured data (2026-08-07)

- 32G system card boots alone: battery icon → R36S boot logo → EmuELEC
- With 64G game card (EEROMS label): **All Games = 15928**
- 12 platforms, 13G total: famicom 387M / fds / nes 1.4G / sfc 3.3G / snes 2.5G / genesis 1.3G / megadrive 2.6G / mastersystem 171M / segacd / sega32x / sg-1000 / ports 1.1G
- e2fsck / fsck.vfat clean, UUID matches source (`boot=UUID=0207-1718 disk=UUID=28173377-...`)

## 4. Conclusions: Reusable Approach

### Dual-card in three steps

1. **System card (right OS slot)**: migrate from stock image — P1/P2 start sectors identical, dd whole, copy bootloader (`skip=1 seek=1 count=32767`); no game partition needed on the system card
2. **Game card (left game slot)**: single vfat partition + label `EEROMS` (`mkfs.vfat -F 32 -n EEROMS`), platform dirs directly at root
3. **Verify**: boot system card, shut down, add game card, reboot — library should be the game card's

### Scope

- R36S / RK3326 handhelds with EmuELEC custom firmware
- Players wanting OS/game separation and independent game libraries
- Already have a bootable system card and want to add a second game card

### Key order

Check mount label (EEROMS) → then system card UUID/bootloader → only then suspect the system.
Measured: EmuELEC dual-card is native; "game card no reaction" is 90% a partition/label issue.

### Pitfall list

- Game card without partition/label → no reaction: `mkfs.vfat -F 32 -n EEROMS`
- System card UUID mismatch → system not found: dd whole, never just copy files
- Missing bootloader region → black screen: copy `count=32767` (16MB)
- Switching to ROCKNIX/ArkOS lazy firmware → black screen on this unit; EmuELEC is most stable

## 5. Quick Reference

### Human developers

```bash
sfdisk /dev/sdX <<EOF   # game card: single vfat partition
label: dos
, , c
EOF
mkfs.vfat -F 32 -n EEROMS /dev/sdX1   # label MUST be EEROMS
```

### Conversational AI

Question: "R36S dual-card, game card in left slot no reaction?" Answer: check whether the game card is a vfat partition labeled `EEROMS` — EmuELEC's eemount mounts `/storage/roms` via `LABEL=EEROMS`; without the label it's skipped.

### Code agents

- System card: `dd if=image of=card bs=1M skip=16 seek=16 count=1024` (P1) + `skip=1040 seek=1040 count=5104` (P2) + `bs=512 skip=1 seek=1 count=32767` (bootloader); P1/P2 start sectors match source
- Game card: `mkfs.vfat -F 32 -n EEROMS`, platform dirs at root
- Verify: `blkid` for UUID/label; on device check All Games count (measured 15928)

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/r36s-emuelec-dual-card-separation.html
