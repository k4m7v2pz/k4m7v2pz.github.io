<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# ThinkPad E490 Fan/Temperature Auto-Control Log: thinkfan Absent, a Hand-Written Curve Script Takes Over

> Date: 2026-08-05

### 1. Background: This Machine's Requirements

Device: ThinkPad E490 (model 20N8A025CD), Arch Linux (kernel 7.1.5-arch1-2), thinkpad_acpi driver v0.26. Use: LAN TTY server, normally quiet at idle; but as soon as a compile or package job runs, the fan should automatically spin up to hold the temperature down. The goal is simple: **stop at low temperature, auto-blow at high temperature**, fully automatic, surviving reboot.

The ThinkPad's fan is managed by EC firmware; the only way to take manual control under Linux is to write the `level` field of `/proc/acpi/ibm/fan` (values 0-7, auto, disengaged, full-speed), and the prerequisite is that the kernel module thinkpad_acpi is loaded with the `fan_control=1` parameter, otherwise the write returns EINVAL.

### 2. First Pit: fan_control=1 Stops Working After Reboot

Following ArchWiki's conventional approach, first write the config:

```bash
# /etc/modprobe.d/thinkpad_acpi.conf
options thinkpad_acpi fan_control=1
```

After reboot, checking `cat /sys/module/thinkpad_acpi/parameters/fan_control` still shows N — the config didn't take effect at all. Trace the load timing with dmesg:

```
[1.453946] thinkpad_acpi: ThinkPad ACPI Extras v0.26
[1.453953] thinkpad_acpi: Lenovo ThinkPad E490, model 20N8A025CD
```

The module is loaded 1.45 seconds after power-on — **this is the initramfs stage, before the root filesystem is mounted**, so the root's /etc/modprobe.d isn't visible yet and the config naturally has no effect. ArchWiki's conventional approach assumes the module is loaded by udev after the system comes up; this machine isn't like that.

#### Fix: Bake the Config Into initramfs

mkinitcpio.conf's FILES field can copy any file as-is into initramfs, preserving the path:

```bash
FILES=(/etc/modprobe.d/thinkpad_acpi.conf)
```

Then rebuild the image and verify:

```bash
sudo mkinitcpio -P
sudo lsinitcpio /boot/initramfs-linux.img | grep thinkpad
```

The output confirms the image now contains `etc/modprobe.d/thinkpad_acpi.conf`; from then on, every boot, the module is loaded at the initramfs stage with fan_control=1 automatically, no need to manually reload the module.

### 3. Second Pit: thinkfan Is Not in the Arch Repositories

Next I wanted to install thinkfan to do temperature curves, but:

```
pacman -Sl | grep thinkfan   # empty
pacman -Ss thinkfan          # empty
```

There's no such package in the sync repos (core/extra) at all (repository state as of 2026-08). AUR would require installing yay and compiling — too heavy for a machine that follows the "TTY server + zero dependencies" principle. Conclusion: write an equivalent curve script yourself, pure bash + systemd, depending only on the kernel's built-in interfaces.

### 4. Implementation: Curve Script + systemd Service

#### 1. Temperature Source

CPU temperature is at `/sys/devices/platform/coretemp.0/hwmon/hwmonN/temp*_input` (milli-degrees Celsius, 55°C = 55000). Note that the hwmon number can change between boots, so the script uses a wildcard glob and doesn't hardcode hwmon6.

#### 2. Gear Curve

Every 5 seconds, take the highest temperature across all cores and map it to a gear by threshold; the gear is only written when it changes (to reduce the number of writes to the EC):

| Max temp | Gear |
|---|---|
| < 55°C | 0 (stop) |
| 55-59°C | 1 |
| 60-64°C | 2 |
| 65-69°C | 3 |
| 70-74°C | 4 |
| ≥ 75°C | 7 (full speed) |

#### 3. Script Core Logic

`level_for()` is a pure if/elif threshold judgment; the write uses `echo "level $level" > /proc/acpi/ibm/fan`; if the write fails (fan_control not in effect), the module is automatically reloaded once for self-healing.

#### 4. systemd Unit

Type=simple, ExecStart points to the script, Restart=on-failure, WantedBy=multi-user.target. `sudo systemctl enable --now thinkpad-fan` enables autostart at boot.

#### 5. Complete Source (copy directly)

`/usr/local/sbin/thinkpad-fan.sh`:

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

`/etc/systemd/system/thinkpad-fan.service`:

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

### 5. Live Verification: 45-Second All-Core Stress

Start 4 `yes > /dev/null &` to go full load; the service log records the complete closed loop:

```
20:29:56 level 0 (42°C)  ← idle, stopped
20:30:41 level 4 (72°C)  ← load coming up
20:30:46 level 7 (76°C)  ← auto full speed
20:30:51 level 3 (66°C)  ← pressed back down
20:31:32 level 0 (53°C)  ← load over, back to stopped
```

Conclusion: from idle-stopped to full-load full-speed, fully automatic, responding within 5 seconds, and still in effect after reboot.

### 6. Quick Reference for Three Kinds of Readers

#### For Human Developers

- Control interface: write level 0-7/auto to `/proc/acpi/ibm/fan`
- Service management: `systemctl status/stop/start thinkpad-fan`
- Adjust the curve: edit the `level_for()` thresholds in `/usr/local/sbin/thinkpad-fan.sh`
- View logs: `journalctl -t thinkpad-fan -f`

#### For Conversational AI (ChatGPT / Doubao / etc.)

In one sentence: the ThinkPad E490 uses thinkpad_acpi's fan_control=1 + a hand-written bash curve script to control the gear by CPU temperature — idle stop, full speed at 75°C. Key point: the module parameter must be baked into initramfs (mkinitcpio FILES=), otherwise it stops working after reboot; thinkfan is not in the Arch repos.

#### For Code Agents (Copilot / Trae / AtomCode)

Files involved:

- /etc/modprobe.d/thinkpad_acpi.conf (module parameters)
- /etc/mkinitcpio.conf (FILES field, original file backed up as .bak)
- /usr/local/sbin/thinkpad-fan.sh (curve logic)
- /etc/systemd/system/thinkpad-fan.service (boot autostart)

Temperature source: /sys/devices/platform/coretemp.0/hwmon/hwmon*/temp*_input (milli-degrees Celsius, take the max)

Control target: /proc/acpi/ibm/fan (level 0-7/auto; if the write fails, confirm fan_control=1)

---

<!-- License statement -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright belongs to the author; attribution is required, but for enterprise compliance please retain the original statement.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/thinkpad-e490-fan-control.html
