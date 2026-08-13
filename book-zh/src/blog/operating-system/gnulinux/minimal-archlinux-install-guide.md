<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 纯字符极简 Arch Linux 装机指南：从 UEFI 到 Sway 的开机链调优

## 前言

本文面向两类读者：
- **人类读者**：想自己装一台"开机就是黑底白字、没有品牌 Logo 污染、纯键盘操作"的 Arch Linux
- **AI Agent**：需要一份结构化的、可复现的步骤清单，用于协助装机或排查问题

**核心理念：** 每一层能显示字符的，就不显示图形；每一层能省掉的，就不加载。

## 一、UEFI 固件设置（最容易被忽略的一步）

很多人装完系统发现开机还是 OEM 厂商的大红/大蓝 Logo，然后才进 GRUB——这是因为 UEFI 固件里有个 **Quiet Boot** 选项没关。

### 进 BIOS 需要改的项目

| 选项 | 推荐值 | 说明 |
|------|--------|------|
| UEFI/Legacy Boot | `UEFI Only` | 纯 UEFI，不兼容 CSM/Legacy |
| CSM (Compatibility Support Module) | `Disabled` | 关掉兼容层，减少启动阶段固件干预 |
| Secure Boot | `Disabled` | Arch 官方不直接支持 Secure Boot，装机阶段先关掉 |
| Boot Mode / Quiet Boot | `Diagnostics` 或 `Disabled` | **关键项**：关掉厂商 Logo 显示，换成 BIOS 自检白字 |
| Boot Order | 你的安装介质排第一 | 装机阶段用 U 盘启动 |

### 效果

```
关 Quiet Boot 前： 厂商 Logo（红底/蓝底） → GRUB → 系统
关 Quiet Boot 后： 黑底白字自检 → GRUB → 系统
```

不同厂商的叫法不同：
- Lenovo: `Boot Mode` → `Diagnostics`（关掉红底 Lenovo Logo）
- Dell: 关掉 `Logo` 或 `Quiet Boot`
- ASUS: 关掉 `Boot Logo Display`
- 其他品牌：找 `Quiet Boot` 或 `Boot Logo` 相关的开关，禁用即可

## 二、GRUB 超时 + 系统启动参数

### 2.1 GRUB 超时调到 1 秒

```bash
sudo sed -i 's/GRUB_TIMEOUT=5/GRUB_TIMEOUT=1/' /etc/default/grub
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

### 2.2 关于 Arch 开机 Logo

Arch Linux 默认安装不会显示一个"Arch Logo"——但如果你用了 **archinstall** 脚本，并且选择了 **UKI (Unified Kernel Image)** 选项，那么 mkinitcpio 的 preset 里会默认加上一个 `--splash` 参数，把 Arch 的 logo 图片嵌入到 UKI 二进制里。开机时这个 logo 会闪一下。

如果你看到这个 logo 并且想关掉它，编辑 `/etc/mkinitcpio.d/linux.preset`，删除 `--splash /usr/share/systemd/bootctl/splash-arch.bmp` 参数，然后重新生成：

```bash
sudo mkinitcpio -p linux
```

## 三、内核参数：关掉欢迎消息和 Plymouth

### 3.1 关掉 `systemd-fsck` 的欢迎消息

在 `/etc/default/grub` 的 `GRUB_CMDLINE_LINUX_DEFAULT` 中追加：

```
quiet loglevel=3 udev.log_priority=3
```

- `quiet`：关掉内核大部分日志输出
- `loglevel=3`：只显示 KERN_ERR 及以上级别的内核消息
- `udev.log_priority=3`：关掉 udev 的设备发现日志

### 3.2 不要装 Plymouth

Plymouth 是开机动画框架，哪怕你只想要个简单的启动进度条，它也会引入额外的依赖（drm、framebuffer 等），并且会延迟进入登录管理器的时间。不装 Plymouth，系统直接从内核日志切到 getty 或显示管理器，反而更快，也符合"纯字符"的审美。

## 四、getty 静默（不显示开机信息）

如果你不想在登录前看到任何系统日志，编辑 `/etc/systemd/system/getty@tty1.service.d/override.conf`：

```ini
[Service]
ExecStart=
ExecStart=-/sbin/agetty -o '-p -- \\u' --noclear - $TERM
```

`--noclear` 让 getty 启动不清屏，所以之前的内核日志会保留在屏幕上。如果你想要一个"纯黑屏 + 登录提示符"，可以去掉 `--noclear`，或者干脆在 getty 启动前加一条 `ExecStartPre=/usr/bin/clear`。

## 五、显示管理器（DM） vs 直接启动 Sway

### 5.1 选择：无 DM，直接 ttys 登录后 `exec sway`

Sway 不需要显示管理器。在 `~/.bash_profile` 或 `~/.zprofile` 中：

```bash
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec sway
fi
```

这样开机后自动登录 tty1，然后自动启动 Sway。全程没有图形界面加载过渡，只有黑底白字的登录提示。

### 5.2 如果你确实需要 DM

用 `lightdm` + `lightdm-gtk-greeter`，关掉 greeter 的背景图：

```ini
# /etc/lightdm/lightdm-gtk-greeter.conf
[greeter]
background=
theme-name=Adwaita
icon-theme-name=Adwaita
font-name=Sans 10
```

## 六、最终开机链

```
电源键 → UEFI 黑底白字自检（0.5s）
  → GRUB 菜单（1s 超时自动选默认）
    → 内核解压 + 系统初始化（无 Plymouth）
      → 黑屏（0.5s）
        → tty1 登录提示（纯字符）
          → 输入密码
            → exec sway
              → 进入 Sway 工作区
```

从按电源键到进入 Sway，全程没有一张图片、没有一个大 Logo，只有黑底白字。


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/gnulinux/minimal-archlinux-install-guide.html
