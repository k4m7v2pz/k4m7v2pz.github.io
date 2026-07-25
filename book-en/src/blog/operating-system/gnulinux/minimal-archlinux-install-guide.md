# Minimal Arch Linux Installation Guide: UEFI to Sway Boot Chain Tuning

## Preface

**Core philosophy:** At every layer, show text when possible, skip graphics when possible; load only what's needed.

## 1. UEFI Firmware Settings

| Setting | Recommended Value | Notes |
|---------|------------------|-------|
| UEFI/Legacy Boot | `UEFI Only` | Pure UEFI, no CSM |
| CSM | `Disabled` | Disable compatibility layer |
| Secure Boot | `Disabled` | Not directly supported by Arch |
| Quiet Boot | `Diagnostics` or `Disabled` | **Key setting** — removes OEM logo |
| Boot Order | Installation media first | For USB boot |

Different vendors:
- Lenovo: `Boot Mode` → `Diagnostics`
- Dell: Disable `Logo` or `Quiet Boot`
- ASUS: Disable `Boot Logo Display`

## 2. GRUB Configuration

### 2.1 GRUB Timeout to 1 Second

```bash
sudo sed -i 's/GRUB_TIMEOUT=5/GRUB_TIMEOUT=1/' /etc/default/grub
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

### 2.2 Removing Arch Boot Logo

If using archinstall with UKI, remove the `--splash` parameter from `/etc/mkinitcpio.d/linux.preset` and regenerate:

```bash
sudo mkinitcpio -p linux
```

## 3. Kernel Parameters

Append to `GRUB_CMDLINE_LINUX_DEFAULT` in `/etc/default/grub`:

```
quiet loglevel=3 udev.log_priority=3
```

## 4. Skip Plymouth

Don't install Plymouth — it adds dependencies and delays boot. The system goes directly from kernel messages to getty or display manager.

## 5. Display Manager vs Direct Sway

### 5.1 No DM, Start Sway from tty

In `~/.bash_profile` or `~/.zprofile`:

```bash
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec sway
fi
```

### 5.2 If You Need a DM

Use `lightdm` + `lightdm-gtk-greeter`, disable the background:

```ini
[greeter]
background=
```

## 6. Final Boot Chain

```
Power → UEFI text POST (0.5s) → GRUB (1s timeout) → Kernel init → Black (0.5s) → tty1 login → exec sway
```

No images, no logos — just black text on white background from power-on to workspace.

---
<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/minimal-archlinux-install-guide.html
