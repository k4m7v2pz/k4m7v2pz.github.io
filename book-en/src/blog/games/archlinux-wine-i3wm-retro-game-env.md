<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Arch Linux + Wine + i3wm Retro Gaming Environment

> Date: 2026-08-02

### Overview

《重武器老鼠》(Mighty Rodent, also informally called 重装老鼠) is an arcade-style 2D shooter released in 2006, originally distributed as a Windows RAR self-extracting package. This article documents the hands-on process of running the game fully through Wine on an **Arch Linux + i3wm + AMD dual-GPU laptop**, covering file transfer, RAR extraction, Wine configuration, i3wm window rules, AMD discrete-GPU acceleration, and audio and mouse tuning.

### 1. Environment Preparation

#### 1.1 System and Hardware

| Item | Spec |
|---|---|
| Distribution | Arch Linux (kernel latest) |
| Window Manager | i3wm (X11) |
| Default Shell | Nushell |
| CPU | Intel i5-8265U |
| Integrated GPU | Intel UHD Graphics 620 |
| Discrete GPU | AMD Radeon 540 (Lexa PRO) |
| Audio | PipeWire + WirePlumber |

#### 1.2 Install Required Packages

```# 工具链
sudo pacman -S wine wine-mono wine-gecko winetricks \
  unrar xorg-xinit xorg-server i3-wm i3status dmenu xterm \
  xorg-xinput pipewire-pulse wireplumber
可选：DXVK（DirectX → Vulkan 转译，大幅提升游戏性能）
sudo pacman -S dxvk```bash

>
Note: the game is a 32-bit program released in 2006; a 32-bit Wine Prefix is recommended for best compatibility.

### 2. Game File Transfer and Extraction

#### 2.1 Transfer the File to the Target Machine

```# 从本机传输到 Arch Linux 机器
scp zhongwuqilaoshu_<ver>.exe <lan-host>:/home/user/```bash

#### 2.2 Identify and Extract

```# 确认文件类型（RAR 自解压包）
file /home/user/zhongwuqilaoshu_<ver>.exe
# 输出: PE32 executable, RAR self-extracting archive
创建游戏目录并解压
mkdir /home/user/zhongwuqilaoshu
cd /home/user/zhongwuqilaoshu
unrar x /home/user/zhongwuqilaoshu_<ver>.exe```bash

#### 2.3 Handling the Chinese Filename

After extraction the main program is `重武器老鼠.exe` (a Chinese name), so it must be handled under a Chinese locale:

```# 生成中文 locale
sudo bash -c 'echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen && locale-gen'
用中文 locale 提取主程序
LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8
unrar e /home/user/zhongwuqilaoshu_<ver>.exe
/home/user/zhongwuqilaoshu/ "*.exe" -o+ -y```bash

The extracted directory looks like this:

```zhongwuqilaoshu/
├── 重武器老鼠.exe      ← 主程序
├── reg.exe / reg.ini
├── profiles.dat / res.dat / scores.dat
├── gfx/                 ← 图片资源
│   ├── fonts/           ← 字体文件（font01.png, font02.png）
│   ├── background/
│   ├── bosses/
│   └── ...
├── music/               ← OGG 背景音乐
├── sound/               ← OGG 音效
└── hintGameVer/         ← 游戏版本信息```plaintext

### 3. Wine Configuration

#### 3.1 Create a 32-bit Wine Prefix

The game is a 32-bit program; a 64-bit Prefix may run into compatibility problems:

```export WINEARCH=win32
export WINEPREFIX=~/.wine32
初始化 Wine Prefix（首次运行会自动创建）
winecfg```bash

In the `winecfg` window that pops up:

- **Applications** tab → set Windows Version to **Windows 10**
- **Graphics** tab → check "Allow the window manager to control the windows" (let i3wm manage the window)

#### 3.2 Install the DirectX Runtime

```# 安装 DirectX 9 运行时库（游戏所需）
winetricks directx9
可选：安装常用 VC++ 运行库
winetricks vcrun2019```bash

#### 3.3 Configure DXVK (Performance Optimization)

If the game uses DirectX 9 (most 2006 games do), DXVK can translate DirectX calls to Vulkan and noticeably improve performance:

```# 安装 DXVK 到当前 Wine Prefix
winetricks dxvk```bash

#### 3.4 First-Run Test

```cd /home/user/zhongwuqilaoshu
WINEPREFIX=~/.wine32 \
  DRI_PRIME=1 \
  DISPLAY=:0 \
  LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8 \
  wine 重武器老鼠.exe```bash

### 4. i3wm Window Manager Configuration

#### 4.1 Launch i3

```# 创建 .xinitrc
echo "exec i3" > ~/.xinitrc
从 tty1 启动
startx```bash

#### 4.2 i3 Configuration

The config file `~/.config/i3/config`:

```# i3 config for 重武器老鼠 game
font pango:monospace 10
set $mod Mod4
自动启动游戏（使用 Nushell 脚本管理环境变量）
exec nu /home/user/zhongwuqilaoshu/launch_game.nu
快捷键
bindsym $mod+Shift+e exec i3-msg exit
bindsym $mod+Shift+q kill
bindsym $mod+d exec dmenu_run
bindsym $mod+Return exec xterm
bindsym $mod+Shift+r restart
bindsym $mod+f fullscreen toggle
窗口规则：游戏窗口自动浮动 + 全屏
for_window [title="重武器老鼠"] floating enable
for_window [title="重武器老鼠"] fullscreen enable
bar {
status_command i3status
position top
}```ini

>
**Key fix**: the `for_window` match condition must use the concrete window title (e.g. `[title="重武器老鼠"]`), not `[all]` — i3wm does not support the `[all]` syntax. Overusing `[title=".*"]` would fullscreen every window (including terminals), so it should only apply to the game window.

#### 4.3 Nushell Launch Script

Since the default shell on Arch Linux is Nushell, to avoid conflicts between bash syntax such as `&&`, `2>&1` and Nushell, it's recommended to write a standalone `.nu` launch script:

```cat > /home/user/zhongwuqilaoshu/launch_game.nu << 'EOF'
# 启动 重武器老鼠 游戏（AMD 独立显卡 + 32位 Wine Prefix）
$env.DISPLAY = ":0"
$env.XAUTHORITY = "/run/user/1000/lyxauth"
$env.DRI_PRIME = "1"
$env.WINEARCH = "win32"
$env.WINEPREFIX = "/home/user/.wine32"
$env.LANG = "zh_CN.UTF-8"
$env.LC_ALL = "zh_CN.UTF-8"
cd /home/user/zhongwuqilaoshu
/usr/bin/wine 重武器老鼠.exe
EOF```bash

### 5. Dual-GPU Optimization (AMD Discrete-GPU Acceleration)

This machine is equipped with dual GPUs: an Intel UHD 620 (integrated) and an AMD Radeon 540 (discrete). Wine uses the Intel iGPU by default; you need `DRI_PRIME=1` to force it onto the AMD discrete GPU.

#### 5.1 Verify GPU Usage

```# 安装 radeontop 监控 AMD 显卡
sudo pacman -S radeontop
运行游戏后检查 GPU 占用
sudo radeontop -d -```bash

Before optimization (Intel iGPU):

```GPU:    0%      ← AMD 完全空闲
VRAM:   0.27%   ← 仅用于桌面
Core:   0.326 GHz```plaintext

After optimization (`DRI_PRIME=1`):

```GPU:    31%     ← 活跃
VRAM:   5% (84 MB)  ← 显存被使用
Core:   1.176 GHz (100%)  ← 满频运行```plaintext

#### 5.2 Performance Comparison

| Metric | Intel UHD 620 (before) | AMD Radeon 540 (after) |
|---|---|---|
| GPU usage | 0~20% (intermittent) | 20~35% (stable) |
| Game frame rate | Frequent stutter | Smooth |
| CPU usage | 163% (heavy Wine translation overhead) | Normal (about 30~50%) |
| Temperature | 70~78°C | 70~75°C |

### 6. Filesystem Compatibility: the Font Case Problem

#### 6.1 Symptom

After launch the game pops an error:

```error file gfx/fonts/font01.png not found
```plaintext

#### 6.2 Cause

Windows filesystems are case-insensitive, so `font01.png` and `Font01.png` are the same file. Linux filesystems are case-sensitive, so the case used in the file references inside the game code may not match the actual files.

#### 6.3 Solution

Create symlinks for the common case variants:

```cd /home/user/zhongwuqilaoshu/gfx/fonts
ln -sf font01.png Font01.png
ln -sf font02.png Font02.png
ln -sf font01.png FONT01.png
ln -sf font02.png FONT02.png
```bash

### 7. Audio Settings (PipeWire)

#### 7.1 Unmute and Set Volume

```# 查看当前音量
wpctl get-volume @DEFAULT_AUDIO_SINK@
设置音量为 67% 并解除静音
wpctl set-volume @DEFAULT_AUDIO_SINK@ 67%
wpctl set-mute @DEFAULT_AUDIO_SINK@ 0
```bash

>
💡 `wpctl` is WirePlumber's command-line tool, more modern than `pactl`.

### 8. Disable Mouse Acceleration

Shooters need precise mouse aiming, so disabling mouse acceleration is recommended.

#### 8.1 Persistent Configuration (Recommended)

```sudo tee /etc/X11/xorg.conf.d/99-mouse-accel.conf << 'EOF'
Section "InputClass"
    Identifier "Disable Mouse Acceleration"
    MatchIsPointer "yes"
    Driver "libinput"
    Option "AccelProfile" "flat"
    Option "AccelSpeed" "0"
EndSection
EOF
```bash

#### 8.2 Take Effect Immediately (Without Restarting X)

```# 查看设备列表
xinput list
禁用加速度（以实际设备名为准）
xinput set-prop "pointer:设备名" "libinput Accel Profile Enabled" 0, 1
```bash

>
`AccelProfile flat` is the proportional mode: cursor movement distance maps 1:1 to physical movement, with no acceleration algorithm in between — ideal for shooters.

### 9. Troubleshooting Quick Reference

| Symptom | Cause and fix |
|---|---|
| `unrar: command not found` | `sudo pacman -S unrar` |
| Chinese filenames garbled after extraction | Generate the `zh_CN.UTF-8` locale then `LANG=zh_CN.UTF-8 unrar x`; or switch to `unar` |
| Resources not found / black screen after launch | Didn't `cd` into the game directory; Wine must be started from the game directory |
| Chinese text shows as boxes in game | Install `wqy-zenhei` and link the fonts (see 3.3) |
| Wine fullscreen black screen | Switch from Sway/Wayland to i3wm/X11 (see Section 4) |
| No sound | Use `wpctl` to check the default audio output and unmute |
| Mouse feels "floaty" | Disable mouse acceleration per Section 8 |

### 10. Summary

With the configuration above, 《重武器老鼠》 runs smoothly on Arch Linux + i3wm + AMD discrete GPU. Key points at a glance:

| Stage | Key operation | Notes |
|---|---|---|
| File transfer | Transfer the .exe with `scp` to the target machine | Confirm mDNS hostname resolution |
| RAR extraction | `unrar` + Chinese locale | Chinese filenames need `LANG=zh_CN.UTF-8` |
| Wine Prefix | `WINEARCH=win32` to create a 32-bit one | Compatible with the 2006-era game |
| Runtime environment | `cd` into the game directory + `DRI_PRIME=1` | Asset paths + discrete-GPU acceleration |
| Window management | i3wm + `for_window [title]` rules | Avoid abusing `[all]` and `[title=".*"]` |
| Font compatibility | Create case-variant symlinks | Linux filesystems are case-sensitive |
| Audio | `wpctl set-volume` | PipeWire + WirePlumber |
| Mouse | Xorg `flat` profile | Disables acceleration, suited to shooters |

>
**Tip**: if the game still stutters on the AMD discrete GPU, try installing DXVK (`winetricks dxvk`) to translate DirectX calls to Vulkan — performance can improve another 30~50%.

>
💡 The essence of the whole setup is using the compatibility layers and tech stack of a modern Linux to provide an "equivalent" runtime for a Windows game — Wine handles API translation, X11 handles graphics output, PipeWire handles audio, and i3wm handles window management. Understand what each layer does, and you can pinpoint problems precisely when they occur.

---

**📝 Environment statement**: this article was verified on Arch Linux (pure-WoW64 Wine builds after June 2025) + i3wm + Wine 9.x/10.x + PipeWire + Xorg. Other distros or newer Wine versions may differ slightly; go by actual behavior.

**Related tags**: #ArchLinux #Wine #i3wm #重武器老鼠 #MightyRodent #retrogaming #LinuxGaming #PipeWire

A general reference template for running old Windows games on a Linux desktop. Enjoy your retro gaming!

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/archlinux-wine-i3wm-retro-game-env.html
