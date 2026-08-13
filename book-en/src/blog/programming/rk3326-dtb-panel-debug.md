# RK3326 Device Tree Panel Debug: LCD Backlight On but Black Screen After Kernel Upgrade

> Date: 2026-08-07

## 1. Trigger: Black Screen After Kernel Upgrade

An embedded Linux device based on RK3326 (Cortex-A35 / Mali-G31 / 640x480 MIPI-DSI) booted its stock kernel 5.10 with a working display. To upgrade the system, a new image with kernel 6.12 was written to the storage card. After power-on: **backlight lit, but the screen stayed black and the system never came up.**

### Timeline (key: symptoms are staged)

1. After writing the image: black screen, no backlight, power LED off — thought the image was written wrong
2. After copying the bootloader region (16MB after MBR): **backlight came on**, but screen black, status LED off — progress, U-Boot running
3. Tried swapping device trees / configs repeatedly: backlight flickered, screen always black
4. After ruling out power issues: still black
5. The stock system (kernel 5.10) on the same card/device **always lit the screen**

### Readout tips (the most valuable part)

- **Backlight on = U-Boot running** (boot chain OK)
- **Status LED on = system booted deeper**
- **No backlight + charge LED on = power/battery issue** (not the image)
- **System still running after card removal (backlight controllable) = kernel/rootfs in RAM**

## 2. Misdiagnoses: Three Wrong Assumptions

### Trap 1: "Bootloader region not fully copied"

The RK3326 boot chain (idbloader/U-Boot/trust) lives in the **16MB region after MBR, before partition 1**. Writing only partitions (loop0p1/p2) does cause black screen — after copying `dd bs=512 skip=1 seek=1 count=32767`, **backlight came on**, seemingly solved. But screen still black: bootloader was not the only problem.

### Trap 2: "The right device tree will light it"

The new image ships 60+ DTBs (panel1-4 / type2-4 variants). Swapping all of them, even reusing the stock generic DTB, all failed. Two reasons:
- **DTB is tightly bound to kernel version**: stock DTB pairs with 5.10 kernel, loading it on 6.12 fails
- **Panel driver ignores the DTB init sequence**: new image DTB uses a custom driver (`gameconsole,r36s-panel`), stock DTB uses the standard driver (`simple-panel-dsi`)

### Trap 3: "Injecting the stock init sequence into the new DTB will save it"

Injected the stock 1134-byte st7703 `panel-init-sequence` into the new r36s.dtb and changed compatible to `simple-panel-dsi` — compiled, file in place, **still black**. The new image's display driver stack is completely different; changing DTB properties cannot change driver behavior.

## 3. Source Verification: Why Incompatible (Measured Evidence)

### 3.1 Boot chain location

```bash
dd if=card bs=1M skip=8 count=1 | head -c8   # should show "LOADER"
dd if=card bs=1M skip=12 count=1 | head -c8  # should show "BL3X"
dd if=image of=card bs=512 skip=1 seek=1 count=32767  # copy bootloader
```

### 3.2 DTB panel init sequence comparison (decisive)

```bash
dtc -I dtb -O dts stock.dtb > /tmp/m.dts
dtc -I dtb -O dts new-r36s.dtb > /tmp/r.dts
grep -c "panel-init-sequence" /tmp/m.dts   # stock: 1 (1134 bytes)
for f in /mnt/*.dtb; do dtc -I dtb -O dts "$f" | grep -c "panel-init-sequence"; done  # new: all 0
```

Stock panel node: `compatible = "sitronix,st7703", "simple-panel-dsi"` + `panel-init-sequence` + `display-timings`.
New image panel node: `compatible = "gameconsole,r36s-panel", "sitronix,st7703"`, **no init sequence, no timings** — relies on driver-built-in sequence, mismatched with this panel.

### 3.3 Kernel/DTB binding

```bash
strings KERNEL | grep "Linux version"   # stock 5.10.160 vs new 6.12.79
```

### 3.4 Fix attempts (all failed)

| Attempt | Result |
|---------|--------|
| Copy bootloader 16MB | backlight on (U-Boot works) |
| Swap DTB (panel1-4/type4/stock) | black |
| Inject panel-init-sequence + change compatible | black |
| Hardcode boot/disk UUID | black |
| Simplify boot.scr (pure sysboot) | black |
| Restore full boot.scr (ADC auto DTB) | black |
| Full battery, retest | still black |

### 3.5 Counter-example: stock system works

Stock EmuELEC (5.10 + generic `rk3326-evb-lp3-v12-linux.dtb`) on the same card/device **always boots with display** — card, machine, power are all fine; the problem is the new image's incompatibility with the hardware.

## 4. Symptom Grading (locate the fault layer fast)

| Symptom | Conclusion |
|---------|-----------|
| Backlight on + status LED off + black | U-Boot running; kernel/panel not up → check DTB/driver |
| No backlight + charge LED on | power/battery; charge fully first |
| System still running after card removal | kernel/rootfs in RAM; display layer issue |
| Status LED on | system booted deep, nearly there |

## 5. Conclusions: Reusable Approach

### Pre-flight compatibility check (in order)

1. **Bootloader present**: `dd if=card bs=1M skip=8 | head -c8` shows `LOADER`, `skip=12` shows `BL3X`
2. **Panel init sequence**: `dtc -I dtb -O dts image.dtb | grep -c "panel-init-sequence"` should be >0
3. **DTB/kernel match**: `strings KERNEL | grep "Linux version"` vs DTB source
4. **Power**: charge LED on with no backlight = battery, charge until LED off

### Troubleshooting order

Bootloader → UUID/partitions → DTB panel sequence → finally suspect hardware.
Measured here: after fixing the bootloader, U-Boot ran (backlight), but **missing panel sequence + driver stack incompatibility** left the screen permanently black — not fixable at config level. Abandon the image, return to stock.

### Scope

- RK3326 embedded Linux devices upgrading kernels / replacing system images
- "Backlight on but screen black / status LED off" troubleshooting
- Deciding whether an image is worth further effort

### Key lessons

- Stock systems (generic DTB) usually have the best compatibility
- "Backlight on" is the watershed: U-Boot is through; everything after is kernel/driver layer
- Panel driver match (compatible) and init sequence are the two requirements for LCD

## 6. Quick Reference

### Human developers

```bash
dd if=card bs=1M skip=8 count=1 | head -c8      # check LOADER
dtc -I dtb -O dts image.dtb | grep -c "panel-init-sequence"
strings KERNEL | grep "Linux version"
```

### Conversational AI

Question: "RK3326 device black screen after kernel upgrade, backlight on, how to debug?" Answer: backlight on = U-Boot running; decompile DTB and check `panel-init-sequence` (absent means driver-built-in sequence, possibly mismatched); verify DTB/kernel version pairing.

### Code agents

- Readout: backlight on = U-Boot OK; status LED off + black = kernel/panel not up
- Check: `dtc -I dtb -O dts X.dtb | grep -c "panel-init-sequence"` should be >0; `strings KERNEL | grep "Linux version"`
- Stop-loss: missing panel sequence + driver incompatibility = not fixable at config level; revert to stock image

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/rk3326-dtb-panel-debug.html
