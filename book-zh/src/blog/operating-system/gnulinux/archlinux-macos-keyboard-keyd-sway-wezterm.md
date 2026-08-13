<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 在 Arch Linux 上模拟 macOS 键盘习惯：keyd + Sway + WezTerm 配置实录

## 一、目标

在 ThinkPad E490（Arch Linux + Sway 1.12）上实现 macOS 风格的键盘操作：

| 键帽 | 期望行为 |
|------|----------|
| **win 键帽** | 当 Sway 的 `$mod`（窗口管理）+ 复制粘贴（Ctrl+Shift+C/V） |
| **ctrl 键帽** | 当 Ctrl（终端中断 `^C`、Ctrl+Z 撤销） |
| **alt 键帽** | 当 Alt（macOS 的 opt 键） |

**关键约束：** win 键帽同时承担两个角色——
- 给 **Sway** 当 Super/Mod4（`$mod`，触发窗口管理快捷键）
- 给 **WezTerm** 当 Ctrl+Shift（触发复制粘贴等编辑操作）

## 二、技术栈

| 组件 | 版本 | 作用 |
|------|------|------|
| keyd | 2.4.3 | 内核级键位重映射（不依赖桌面环境） |
| Sway | 1.12 | Wayland 平铺窗口管理器 |
| WezTerm | 2026-07-16 (git) | GPU 加速终端，跨平台配置 |

## 三、踩坑实录

### 坑 1：keyd 的物理键命名与键帽印字不一致

**现象：** 在 ThinkPad 内置键盘上，物理位置的 win 键帽，keyd 内部叫 `leftalt`；物理位置的 alt 键帽，keyd 内部叫 `leftmeta`。

**诊断方法：** 用 `sudo keyd monitor` 实时查看按键输出：

```bash
keyd virtual keyboard  leftalt down      ← 你按的是 win 键帽
keyd virtual keyboard  leftmeta down     ← 你按的是 alt 键帽
keyd virtual keyboard  leftcontrol down  ← 你按的是 ctrl 键帽
```

**结论：** keyd 配置必须按 **keyd 内部名** 写，不能按键帽印字写。ThinkPad 上：
- win 键帽 = `leftalt`（keyd 内部）
- alt 键帽 = `leftmeta`（keyd 内部）
- ctrl 键帽 = `leftcontrol`（keyd 内部）

### 坑 2：keyd layer 的 `:M` 后缀与编辑键冲突

**第一次尝试：** 用 `[winmod:M]` 让 win 键帽模拟 Super，然后在里面定义 `c = C-c`。

**结果：** keyd monitor 显示 win+c 输出 `leftmeta + leftcontrol + c`（Super+Ctrl+c），而不是纯 Ctrl+c。`:M` 后缀让 layer 模拟 Super，`C-` 前缀加 Ctrl，两者叠加变成了 `Super+Ctrl+c`。

**正确做法：** 不用 `:M` 后缀，而是用 `overload` 机制：

```ini
# 在 keyd 配置中
altkey = overload(control, leftmeta)
```

这样按一下 alt 键帽是 Ctrl，按住不放再按其他键才是 Alt（leftmeta）。

### 坑 3：Sway 的 `set $mod` 直接写 Mod2/Mod3 不生效

Sway 的 `$mod` 只接受 `Mod4`（Super）或 `Mod1`（Alt）。不能直接用 `Mod2` / `Mod3`。所以需要把 win 键帽映射到 keyd 的 `leftmeta`（Super），然后 Sway 的 `$mod` 设为 `Mod4`。

### 坑 4：WezTerm 的 `send_composed_key_when_alt_is_pressed` 不适用于 Ctrl

这个选项只影响 Alt 组合键，不影响 Ctrl。要让 Ctrl+Shift+C/V 在 WezTerm 中复制粘贴，需要在 WezTerm 的 key binding 中显式绑定。

## 四、最终生效配置

### keyd 配置 `/etc/keyd/default.conf`

```ini
[ids]
*

[main]

# 物理 win 键帽 → Meta (Super)
leftalt = leftmeta

# 物理 alt 键帽 → Ctrl, 按住不放是 Alt
leftmeta = overload(control, leftmeta)

# 物理 ctrl 键帽 → Ctrl（保持不变）
leftcontrol = leftcontrol

[control]
# 在 Ctrl 层中，把 Ctrl+Shift+c/v 映射到 Ctrl+Shift+c/v（透传）
c = C-c
v = C-v
```

### Sway 配置 `~/.config/sway/config`

```
# 设置 $mod 为 Mod4（Super）
set $mod Mod4

# 窗口管理快捷键使用 $mod
bindsym $mod+Return exec wezterm
bindsym $mod+d exec wofi
bindsym $mod+Shift+q kill
# ... 其他快捷键
```

### WezTerm 配置 `~/.config/wezterm/wezterm.lua`

```lua
local wezterm = require 'wezterm'
local keys = {
    -- Ctrl+Shift+C 复制
    { key = 'C', mods = 'CTRL|SHIFT', action = wezterm.action.CopyTo 'Clipboard' },
    -- Ctrl+Shift+V 粘贴
    { key = 'V', mods = 'CTRL|SHIFT', action = wezterm.action.PasteFrom 'Clipboard' },
}
return { keys = keys }
```

## 五、效果

- win 键帽 = Sway 的 `$mod`（窗口管理）+ WezTerm 的 Ctrl+Shift（复制粘贴）
- ctrl 键帽 = Ctrl（终端中断、撤销）
- alt 键帽 = Alt（macOS 的 opt 键，在 WezTerm 中通过 `send_composed_key_when_alt_is_pressed` 使用）

这套配置在 ThinkPad E490 上实测通过，让 macOS 用户切换到 Arch Linux + Sway 后几乎零适应成本。


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/gnulinux/archlinux-macos-keyboard-keyd-sway-wezterm.html
