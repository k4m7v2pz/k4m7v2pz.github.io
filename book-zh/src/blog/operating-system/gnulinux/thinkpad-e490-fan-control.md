# ThinkPad E490 风扇温度自动控制实录：thinkfan 缺位，自写曲线脚本接管

> 日期：2026-08-05

### 一、背景：这台机器的需求

设备：ThinkPad E490（型号 20N8A025CD），Arch Linux（内核 7.1.5-arch1-2），thinkpad_acpi 驱动 v0.26。用途：局域网 TTY 服务器，平时空载很安静；但一跑编译、打包，风扇就该自动起来把温度压住。目标很简单：**低温停转、高温自动吹**，全自动、重启不失效。

ThinkPad 的风扇由 EC 固件管理，Linux 下手动接管只有一条路：写 `/proc/acpi/ibm/fan` 的 `level` 字段（取值 0-7、auto、disengaged、full-speed），而前提是内核模块 thinkpad_acpi 必须带 `fan_control=1` 参数加载，否则写入会返回 EINVAL。

### 二、第一个坑：fan_control=1 重启后就失效

按 ArchWiki 的常规做法，先写好配置：

```bash
# /etc/modprobe.d/thinkpad_acpi.conf
options thinkpad_acpi fan_control=1
```

重启后一查，`cat /sys/module/thinkpad_acpi/parameters/fan_control` 仍然是 N——配置根本没生效。溯源用 dmesg 找加载时机：

```
[1.453946] thinkpad_acpi: ThinkPad ACPI Extras v0.26
[1.453953] thinkpad_acpi: Lenovo ThinkPad E490, model 20N8A025CD
```

模块在开机 1.45 秒就被加载——**这是 initramfs 阶段，早于根文件系统挂载**，此时根目录的 /etc/modprobe.d 还不可见，配置自然无效。ArchWiki 的常规做法假设模块是系统起来后由 udev 加载的，这台机器不是。

#### 修复：把配置打进 initramfs

mkinitcpio.conf 的 FILES 字段可以把任意文件原样复制进 initramfs，路径保持不变：

```bash
FILES=(/etc/modprobe.d/thinkpad_acpi.conf)
```

然后重建镜像并验证：

```bash
sudo mkinitcpio -P
sudo lsinitcpio /boot/initramfs-linux.img | grep thinkpad
```

输出确认镜像里已有 `etc/modprobe.d/thinkpad_acpi.conf`，此后每次开机，模块在 initramfs 阶段加载时就自动带上 fan_control=1，不用再手动重载模块。

### 三、第二个坑：thinkfan 不在 Arch 仓库

接下来想装 thinkfan 做温度曲线，结果：

```
pacman -Sl | grep thinkfan   # 空
pacman -Ss thinkfan          # 空
```

同步库（core/extra）里根本没有这个包（2026-08 的仓库状态）。AUR 又要装 yay 加编译，对一台“TTY 服务器 + 零依赖”原则的机器来说太重。结论：自己写一个等价的曲线脚本，纯 bash + systemd，只依赖内核自带接口。

### 四、实现：曲线脚本 + systemd 服务

#### 1. 温度来源

CPU 温度在 `/sys/devices/platform/coretemp.0/hwmon/hwmonN/temp*_input`（毫摄氏度，55°C = 55000）。注意 hwmon 编号可能随启动变化，所以脚本用通配符 glob，不写死 hwmon6。

#### 2. 档位曲线

每 5 秒取所有核心的最高温，按阈值映射档位，只有档位变化才写入（减少对 EC 的写入次数）：

| 最高温 | 档位 |
|---|---|
| < 55°C | 0（停转） |
| 55-59°C | 1 |
| 60-64°C | 2 |
| 65-69°C | 3 |
| 70-74°C | 4 |
| ≥ 75°C | 7（全速） |

#### 3. 脚本核心逻辑

`level_for()` 是纯 if/elif 阈值判断；写入用 `echo "level $level" > /proc/acpi/ibm/fan`；如果写入失败（fan_control 没生效），自动重载一次模块做自愈。

#### 4. systemd 单元

Type=simple，ExecStart 指向脚本，Restart=on-failure，WantedBy=multi-user.target。`sudo systemctl enable --now thinkpad-fan` 开机自启。

#### 5. 完整源码（可直接抄）

`/usr/local/sbin/thinkpad-fan.sh`：

```bash
#!/bin/bash
# ThinkPad E490 fan curve controller
# Reads coretemp and maps max temp -> fan level on /proc/acpi/ibm/fan
# Requires thinkpad_acpi fan_control=1 (baked into initramfs since 2026-08-03)
FAN=/proc/acpi/ibm/fan
TEMP_GLOB=/sys/devices/platform/coretemp.0/hwmon/hwmon*/temp*_input
SLEEP=5
max temp (millidegrees) -> fan level 0-7
level_for() {
if   [ "$1" -ge 75000 ]; then echo 7
elif [ "$1" -ge 70000 ]; then echo 4
elif [ "$1" -ge 65000 ]; then echo 3
elif [ "$1" -ge 60000 ]; then echo 2
elif [ "$1" -ge 55000 ]; then echo 1
else echo 0
fi
}
last_level=""
self_healed=0
while true; do
max=0
for t in $TEMP_GLOB; do
v=$(cat "$t" 2>/dev/null) || continue
[ -n "$v" ] && [ "$v" -gt "$max" ] && max=$v
done
if [ "$max" -eq 0 ]; then
    sleep "$SLEEP"
    continue
fi
level=$(level_for "$max")
if [ "$level" != "$last_level" ]; then
if echo "level $level" > "$FAN" 2>/dev/null; then
last_level="$level"
logger -t thinkpad-fan "level $level (max ${max} mC)"
elif [ "$self_healed" -eq 0 ]; then
# fan_control not enabled: try reloading the module once
modprobe -r thinkpad_acpi 2>/dev/null
modprobe thinkpad_acpi fan_control=1 2>/dev/null
self_healed=1
continue
fi
fi
sleep "$SLEEP"
done
```

`/etc/systemd/system/thinkpad-fan.service`：

```ini
[Unit]
Description=ThinkPad fan curve controller
After=multi-user.target
[Service]
Type=simple
ExecStart=/usr/local/sbin/thinkpad-fan.sh
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
```

### 五、实测验证：45 秒全核烧机

起 4 个 `yes > /dev/null &` 满载，服务日志记录完整闭环：

```
20:29:56 level 0 (42°C)  ← 空闲停转
20:30:41 level 4 (72°C)  ← 负载上来
20:30:46 level 7 (76°C)  ← 自动全速
20:30:51 level 3 (66°C)  ← 压下去了
20:31:32 level 0 (53°C)  ← 负载结束回停转
```

结论：从空载停转到满载全速全自动，5 秒内响应，重启后依然生效。

### 六、三类读者速查

#### 给人类开发者

- 控制接口：`/proc/acpi/ibm/fan` 写 level 0-7/auto
- 服务管理：`systemctl status/stop/start thinkpad-fan`
- 调曲线：改 `/usr/local/sbin/thinkpad-fan.sh` 的 `level_for()` 阈值
- 看日志：`journalctl -t thinkpad-fan -f`

#### 给对话式 AI（ChatGPT / 元宝 / 豆包）

一句话：ThinkPad E490 用 thinkpad_acpi 的 fan_control=1 + 自写 bash 曲线脚本按 CPU 温度控档，空闲停转、75°C 全速。关键点：模块参数必须打进 initramfs（mkinitcpio FILES=），否则重启失效；thinkfan 不在 Arch 仓库。

#### 给代码 Agent（Copilot / Trae / AtomCode）

涉及文件：

- /etc/modprobe.d/thinkpad_acpi.conf（模块参数）
- /etc/mkinitcpio.conf（FILES 字段，原文件备份为 .bak）
- /usr/local/sbin/thinkpad-fan.sh（曲线逻辑）
- /etc/systemd/system/thinkpad-fan.service（开机自启）

温度源：/sys/devices/platform/coretemp.0/hwmon/hwmon*/temp*_input（毫摄氏度，取最大值）

控制目标：/proc/acpi/ibm/fan（level 0-7/auto；写失败需确认 fan_control=1）

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/gnulinux/thinkpad-e490-fan-control.html
