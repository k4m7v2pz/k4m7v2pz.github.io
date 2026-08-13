# Simulating macOS Keyboard Habits on Arch Linux: keyd + Sway + WezTerm

## 1. Goal

On a ThinkPad E490 (Arch Linux + Sway 1.12), achieve macOS-style keyboard operation:

| Keycap | Expected Behavior |
|--------|------------------|
| **Win key** | Sway `$mod` (window management) + copy/paste (Ctrl+Shift+C/V) |
| **Ctrl key** | Ctrl (terminal interrupt `^C`, Ctrl+Z undo) |
| **Alt key** | Alt (macOS option key) |

## 2. Tech Stack

| Component | Version | Role |
|-----------|---------|------|
| keyd | 2.4.3 | Kernel-level key remapping |
| Sway | 1.12 | Wayland tiling window manager |
| WezTerm | 2026-07-16 | GPU-accelerated terminal |

## 3. Pitfalls

### Pitfall 1: keyd Physical Key Names Don't Match Keycap Labels

On ThinkPad keyboards, the physical Win keycap is called `leftalt` internally, and the Alt keycap is `leftmeta`. Use `sudo keyd monitor` to verify.

### Pitfall 2: `:M` Suffix Conflicts with Editing Keys

The `:M` suffix makes a layer simulate Super, which combined with `C-` prefix creates `Super+Ctrl+c`. Use `overload` instead:

```ini
leftmeta = overload(control, leftmeta)
```

### Pitfall 3: Sway `$mod` Only Accepts Mod4/Mod1

Sway's `$mod` only accepts `Mod4` (Super) or `Mod1` (Alt). Map the Win key to `leftmeta` (Super) and set `$mod Mod4`.

### Pitfall 4: WezTerm's `send_composed_key_when_alt_is_pressed` Doesn't Affect Ctrl

Bind Ctrl+Shift+C/V explicitly in WezTerm's key bindings.

## 4. Final Configuration

### keyd `/etc/keyd/default.conf`

```ini
[ids]
*

[main]
leftalt = leftmeta
leftmeta = overload(control, leftmeta)
leftcontrol = leftcontrol

[control]
c = C-c
v = C-v
```

### Sway `~/.config/sway/config`

```
set $mod Mod4
bindsym $mod+Return exec wezterm
bindsym $mod+d exec wofi
```

### WezTerm `~/.config/wezterm/wezterm.lua`

```lua
local wezterm = require 'wezterm'
local keys = {
    { key = 'C', mods = 'CTRL|SHIFT', action = wezterm.action.CopyTo 'Clipboard' },
    { key = 'V', mods = 'CTRL|SHIFT', action = wezterm.action.PasteFrom 'Clipboard' },
}
return { keys = keys }
```

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/archlinux-macos-keyboard-keyd-sway-wezterm.html
