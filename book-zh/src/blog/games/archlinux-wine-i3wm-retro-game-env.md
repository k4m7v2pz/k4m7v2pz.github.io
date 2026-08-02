# Arch Linux + Wine + i3wm 搭建复古游戏环境

> 日期：2026-08-02

### 概述

《重武器老鼠》（Mighty Rodent，也有民间称为重装老鼠）是一款 2006 年发布的街机风格 2D 射击游戏，原为 Windows 平台 RAR 自解压包。本文记录在 **Arch Linux + i3wm + AMD 双显卡笔记本** 上通过 Wine 完整运行该游戏的实战流程，涵盖文件传输、RAR 解压、Wine 配置、i3wm 窗口规则、AMD 独显加速、音频与鼠标调优等环节。

### 一、环境准备

#### 1.1 系统与硬件

| 项目 | 规格 |
|---|---|
| 发行版 | Arch Linux（内核 latest） |
| 窗口管理器 | i3wm（X11） |
| 默认 Shell | Nushell |
| CPU | Intel i5-8265U |
| 集成显卡 | Intel UHD Graphics 620 |
| 独立显卡 | AMD Radeon 540（Lexa PRO） |
| 声卡 | PipeWire + WirePlumber |

#### 1.2 安装必要软件包

```# 工具链
sudo pacman -S wine wine-mono wine-gecko winetricks \
  unrar xorg-xinit xorg-server i3-wm i3status dmenu xterm \
  xorg-xinput pipewire-pulse wireplumber
可选：DXVK（DirectX → Vulkan 转译，大幅提升游戏性能）
sudo pacman -S dxvk```bash

>
注意：游戏为 2006 年发布的 32 位程序，推荐使用 32 位 Wine Prefix，兼容性最佳。

### 二、游戏文件传输与解压

#### 2.1 传输文件到目标机器

```# 从本机传输到 Arch Linux 机器
scp zhongwuqilaoshu_<ver>.exe <lan-host>:/home/user/```bash

#### 2.2 识别与解压

```# 确认文件类型（RAR 自解压包）
file /home/user/zhongwuqilaoshu_<ver>.exe
# 输出: PE32 executable, RAR self-extracting archive
创建游戏目录并解压
mkdir /home/user/zhongwuqilaoshu
cd /home/user/zhongwuqilaoshu
unrar x /home/user/zhongwuqilaoshu_<ver>.exe```bash

#### 2.3 处理中文文件名

解压后主程序为 `重武器老鼠.exe`（中文名），需在中文 locale 下操作：

```# 生成中文 locale
sudo bash -c 'echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen && locale-gen'
用中文 locale 提取主程序
LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8
unrar e /home/user/zhongwuqilaoshu_<ver>.exe
/home/user/zhongwuqilaoshu/ "*.exe" -o+ -y```bash

解压后目录结构如下：

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

### 三、Wine 配置

#### 3.1 创建 32 位 Wine Prefix

游戏为 32 位程序，用 64 位 Prefix 可能遇到兼容问题：

```export WINEARCH=win32
export WINEPREFIX=~/.wine32
初始化 Wine Prefix（首次运行会自动创建）
winecfg```bash

在弹出的 `winecfg` 中：

- **Applications** 标签 → Windows Version 选择 **Windows 10**
- **Graphics** 标签 → 勾选 "Allow the window manager to control the windows"（让 i3wm 管理窗口）

#### 3.2 安装 DirectX 运行库

```# 安装 DirectX 9 运行时库（游戏所需）
winetricks directx9
可选：安装常用 VC++ 运行库
winetricks vcrun2019```bash

#### 3.3 配置 DXVK（性能优化）

如果游戏使用 DirectX 9（多数 2006 年游戏），DXVK 可将 DirectX 调用转译为 Vulkan，显著提升性能：

```# 安装 DXVK 到当前 Wine Prefix
winetricks dxvk```bash

#### 3.4 首次运行测试

```cd /home/user/zhongwuqilaoshu
WINEPREFIX=~/.wine32 \
  DRI_PRIME=1 \
  DISPLAY=:0 \
  LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8 \
  wine 重武器老鼠.exe```bash

### 四、i3wm 窗口管理器配置

#### 4.1 启动 i3

```# 创建 .xinitrc
echo "exec i3" > ~/.xinitrc
从 tty1 启动
startx```bash

#### 4.2 i3 配置

配置文件 `~/.config/i3/config`：

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
**关键修正**：`for_window` 的匹配条件必须使用具体窗口标题（如 `[title="重武器老鼠"]`），而非 `[all]`——i3wm 不支持 `[all]` 语法。滥用 `[title=".*"]` 会导致所有窗口（包括终端）被全屏，故仅对游戏窗口生效。

#### 4.3 Nushell 启动脚本

由于 Arch Linux 默认 Shell 为 Nushell，为避免 `&&`、`2>&1` 等 bash 语法与 Nushell 冲突，建议编写独立的 `.nu` 启动脚本：

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

### 五、双显卡优化（AMD 独显加速）

本机配备 Intel UHD 620（集成）+ AMD Radeon 540（独立）双显卡。Wine 默认使用 Intel 集显，需通过 `DRI_PRIME=1` 强制使用 AMD 独显。

#### 5.1 验证 GPU 使用

```# 安装 radeontop 监控 AMD 显卡
sudo pacman -S radeontop
运行游戏后检查 GPU 占用
sudo radeontop -d -```bash

优化前（Intel 集显）：

```GPU:    0%      ← AMD 完全空闲
VRAM:   0.27%   ← 仅用于桌面
Core:   0.326 GHz```plaintext

优化后（`DRI_PRIME=1`）：

```GPU:    31%     ← 活跃
VRAM:   5% (84 MB)  ← 显存被使用
Core:   1.176 GHz (100%)  ← 满频运行```plaintext

#### 5.2 性能对比

| 指标 | Intel UHD 620（优化前） | AMD Radeon 540（优化后） |
|---|---|---|
| GPU 占用 | 0~20%（间歇性） | 20~35%（稳定） |
| 游戏帧率 | 卡顿频繁 | 流畅运行 |
| CPU 占用 | 163%（Wine 转译开销大） | 正常（约 30~50%） |
| 温度 | 70~78°C | 70~75°C |

### 六、文件系统兼容：字体大小写问题

#### 6.1 问题现象

游戏启动后弹出错误：

```error file gfx/fonts/font01.png not found
```plaintext

#### 6.2 原因

Windows 文件系统不区分大小写，`font01.png` 与 `Font01.png` 视为同一文件。Linux 文件系统区分大小写，游戏代码中引用的文件名大小写可能与实际文件不一致。

#### 6.3 解决方案

创建常见大小写变体的符号链接：

```cd /home/user/zhongwuqilaoshu/gfx/fonts
ln -sf font01.png Font01.png
ln -sf font02.png Font02.png
ln -sf font01.png FONT01.png
ln -sf font02.png FONT02.png
```bash

### 七、音频设置（PipeWire）

#### 7.1 解除静音并设置音量

```# 查看当前音量
wpctl get-volume @DEFAULT_AUDIO_SINK@
设置音量为 67% 并解除静音
wpctl set-volume @DEFAULT_AUDIO_SINK@ 67%
wpctl set-mute @DEFAULT_AUDIO_SINK@ 0
```bash

>
💡 `wpctl` 是 WirePlumber 的命令行工具，比 `pactl` 更现代。

### 八、禁用鼠标加速度

射击游戏需要精确的鼠标定位，建议禁用鼠标加速度。

#### 8.1 持久化配置（推荐）

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

#### 8.2 即时生效（不重启 X）

```# 查看设备列表
xinput list
禁用加速度（以实际设备名为准）
xinput set-prop "pointer:设备名" "libinput Accel Profile Enabled" 0, 1
```bash

>
`AccelProfile flat` 即等比模式，光标移动距离与物理移动距离成 1:1 关系，无加速度算法介入，适合射击类游戏。

### 九、排错速查

| 现象 | 原因与对策 |
|---|---|
| `unrar: command not found` | `sudo pacman -S unrar` |
| 解压后中文文件名乱码 | 生成 `zh_CN.UTF-8` locale 后用 `LANG=zh_CN.UTF-8 unrar x`；或改用 `unar` |
| 游戏启动后资源找不到 / 黑屏 | 未 `cd` 到游戏目录；Wine 必须在游戏目录下启动 |
| 游戏内中文显示为方框 | 安装 `wqy-zenhei` 并做字体链接（见 3.3） |
| Wine 全屏黑屏 | 从 Sway/Wayland 切到 i3wm/X11（见第四节） |
| 无声音 | `wpctl` 检查默认音频输出，解除静音 |
| 鼠标移动有"飘"的感觉 | 按第八节禁用鼠标加速度 |

### 十、总结

经过以上配置，《重武器老鼠》在 Arch Linux + i3wm + AMD 独显环境下可流畅运行。核心要点汇总：

| 环节 | 关键操作 | 注意事项 |
|---|---|---|
| 文件传输 | `scp` 传输 .exe 到目标机器 | 确认 mDNS 域名解析 |
| RAR 解压 | `unrar` + 中文 locale | 中文文件名需 `LANG=zh_CN.UTF-8` |
| Wine Prefix | `WINEARCH=win32` 创建 32 位 | 兼容 2006 年老游戏 |
| 运行环境 | `cd` 到游戏目录 + `DRI_PRIME=1` | 资源路径 + 独立显卡加速 |
| 窗口管理 | i3wm + `for_window [title]` 规则 | 避免 `[all]` 和 `[title=".*"]` 滥用 |
| 字体兼容 | 创建大小写符号链接 | Linux 文件系统大小写敏感 |
| 音频 | `wpctl set-volume` | PipeWire + WirePlumber |
| 鼠标 | Xorg `flat` profile | 禁用加速度，适合射击游戏 |

>
**提示**：如果游戏在 AMD 独显下仍有卡顿，可尝试安装 DXVK（`winetricks dxvk`）将 DirectX 调用转译为 Vulkan，性能可再提升 30~50%。

>
💡 整套方案的本质，是用现代 Linux 的兼容层与技术栈，为 Windows 游戏提供一个"等效"的运行环境——Wine 负责 API 翻译，X11 负责图形输出，PipeWire 负责音频，i3wm 负责窗口管理。理解每一层的作用，遇到问题时就能精准定位。

---

**📝 环境声明**：本文验证环境为 Arch Linux（2025 年 6 月后的纯 WoW64 Wine 构建）+ i3wm + Wine 9.x/10.x + PipeWire + Xorg。其他发行版或更新版本的 Wine 可能略有差异，请以实际表现为准。

**相关标签**：#ArchLinux #Wine #i3wm #重武器老鼠 #MightyRodent #复古游戏 #Linux游戏 #PipeWire

在 Linux 桌面环境下运行老 Windows 游戏的通用参考模板。Enjoy your retro gaming!

p>
