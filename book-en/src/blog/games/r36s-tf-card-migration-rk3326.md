# R36S System Migration in Practice: Moving Losslessly from a No-Name Cheap TF Card to a Branded Card

> Date: 2026-08-02

### 1. Background and Overall Approach

The R36S is an open-source handheld powered by a Rockchip RK3326 chip, preinstalled with a customized EmuELEC system. These handhelds are cheap, but the bundled TF cards are mostly no-name or low-quality ones with issues such as inflated capacity ratings and aging flash cells; they can silently fail at any time and lose game saves. Migrating the system to a branded card is something every R36S owner will eventually have to do.

This article uses a migration from a 64G stock card to a 32G branded card as an example, fully documenting partition analysis, wholesale copying, and boot-area repair; every command works on both macOS and Linux.

**Three core ideas:**

1. **The system card is essentially an MBR layout with three partitions** — a FAT32 boot partition, an ext4 system partition, and a FAT32 ROM partition. The boot and system partitions must be copied byte-for-byte wholesale, because the boot configuration extlinux.conf hardcodes two partition UUIDs (boot=UUID points to the boot partition's volume ID, disk=UUID points to the ext4 system partition); copying only the files would leave the system unable to find its root partition and unable to boot.
2. **The target card is usually smaller than the original**, so just create the ROM partition from the remaining space; the game data is copied over separately later and doesn't affect booting.
3. **The most likely trap**: the RK3326 chip's bootloader chain (idbloader, u-boot, trust) lives in the first 16MB of the TF card, in the area after the partition table and before the first partition; if this part isn't copied, inserting the card gives a black screen — even the power LED won't light.

This article proceeds in the order of "back up an image, analyze the partitions, partition the target card, copy wholesale, create a new ROM partition, restore the boot area, verify", with a quick reference for three kinds of readers at the end.

### 2. Step-by-Step Procedure

#### Step 1: Back up the old card as an image

On **Windows**, read the whole card with Win32DiskImager or balenaEtcher; on **Linux/macOS**, just use dd:

```dd if=/dev/sdX of=old.img bs=4M```bash

Once you have the raw disk image, inspect the partition table with `fdisk -l old.img`. The image layout in this article:

- P1 FAT32 boot 1GB (start sector 32768)
- P2 ext4 system 5.4GB (start sector 2129920)
- P3 FAT32 ROM 44GB (start sector 12582912)

Next, mount the image's boot partition:

- **macOS**: `hdiutil attach old.img`
- **Linux**: `mount -o loop,offset=16777216 old.img /mnt`

Open `extlinux/extlinux.conf` and note down the two UUIDs:

- `boot=UUID=0207-1718` (boot partition volume ID)
- `disk=UUID=28173377-4dde-4275-951e-c2114cddae11` (ext4 partition UUID)

These two values dictate that the wholesale copy later is mandatory — copying only files is absolutely not an option.

#### Step 2: Partition the target card

P1's and P2's start sectors and sizes must match the image exactly (their UUIDs stay in place); P3 uses the remaining space.

- **macOS**: you can extract the MBR from the image, rewrite P3's size field, and write it back to the target card.
- **Linux**: use parted or fdisk.

**Note**: on macOS you must use the raw device `/dev/rdiskX` and run `diskutil unmountDisk` first; otherwise the write is blocked by disk arbitration and appears as "write succeeded but reading back still returns old data".

#### Step 3: Copy the partitions wholesale

Copy P1 (offset = 32768 sectors × 512B):

```dd if=old.img of=/dev/rdiskX bs=1M skip=16 seek=16 count=1024```bash

Copy P2 (offset = 2129920 sectors × 512B):

```dd if=old.img of=/dev/rdiskX bs=1M skip=1040 seek=1040 count=5104```bash

#### Step 4: Create a new ROM partition

- **macOS**: `newfs_msdos -F 32 -v EEROMS /dev/rdiskXs3`
- **Linux**: `mkfs.vfat -F 32 -n EEROMS /dev/sdX3`

#### Step 5: Restore the boot area

```dd if=old.img of=/dev/rdiskX bs=512 skip=1 seek=1 count=32767```bash

Write the 16MB bootloader that sits after the partition table and before P1 back exactly as-is.

#### Step 6: Verification

- Read back the same region and compare md5: read back with `dd`, then compute the checksum.
- Use `blkid` to confirm the two UUIDs match the image.

### 3. Pitfall Checklist and Quick Reference for Three Kinds of Readers

#### Pitfall 1: Spotting fake cards

The most common failure of low-quality cards is that writes don't persist: after writing a file and running sync, unmounting and reinserting, the file is gone; or write speed is abnormally slow (over 6 seconds for 512B) and reads back all zeros. Before migrating, always test the target card: write a test file, and it only passes if the file is still there after unplugging and reinserting. A card whose capacity is recognized abnormally (e.g. a 16G card showing only 32MB) is a capacity-inflated or already damaged card — discard it outright.

#### Pitfall 2: macOS "false success" when writing the partition table

Writing the MBR with `/dev/diskX` (buffered) reports success but reads back the old data; you must use the raw device `/dev/rdiskX` and unmount all volumes with `diskutil unmountDisk` before writing, otherwise disk arbitration's automatic remounting interferes with the write.

#### Pitfall 3: Black screen, no lights when inserted into the handheld

This means the boot area wasn't copied. The RK3326 boot chain lives within the 16MB after the partition table and before P1 — idbloader around 32KB, u-boot around 8MB (signature string LOADER), and trust around 12MB (signature string BL3X). After copying sectors 1~32767, spot-check the 8MB and 12MB offsets with dd to confirm the signature strings are present — that means success.

#### Pitfall 4: The UUIDs must be preserved exactly

extlinux.conf's boot= and disk= point to the two partition UUIDs; any approach that "copies files and rebuilds partitions" will leave the system unfindable. You must dd wholesale.

#### Quick Reference for Three Kinds of Readers

1. **Human developers**: follow section 2 in order, double-check the boot-area offsets and UUIDs, and back up before operating.
2. **Conversational AI**: ask "How do I migrate the R36S's EmuELEC system from the old TF card to a new card", using this article as context; the AI should give a three-step plan of partition analysis, dd wholesale copy, and boot-area restore, and remind you to use the rdisk raw device on macOS.
3. **Code agents**: the directly executable command sequence is dd to back up the old card, fdisk to analyze, dd to copy P1 (skip=16 seek=16 count=1024) and P2 (skip=1040 seek=1040 count=5104), newfs_msdos to create the ROM partition, dd to restore the boot area (skip=1 seek=1 count=32767), and dd to read back for md5 verification. Verification points: P1/P2 start sectors must match the image, the boot area must be copied, and the UUIDs must match.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/r36s-tf-card-migration-rk3326.html
