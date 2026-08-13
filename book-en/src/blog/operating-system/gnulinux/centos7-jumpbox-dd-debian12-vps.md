<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

## 1. Why Bother With This "10-Buck Box"?

Pure curiosity and the itch to tinker. When I saw a **Duokaiyun** VPS for 10 RMB/month, my first thought was to run a **Trae Agent** or an **OpenCode** terminal-based tool on it.

But right after connecting, I hit a wall. The root cause: **`glibc` version incompatibility**. Modern toolchains require `glibc` >= 2.28, but the provider's default image was good old **CentOS 7** (shipping `glibc 2.17`).

Asking support for a Debian or Ubuntu 20.04+ image? Not happening — cheap VPS image libraries only have a few ancient options. No help from the provider → DIY time! Since I couldn't directly replace the OS, I used CentOS 7 as a jump box and applied the **DD reinstall method** to flash the system to modern **Debian 12**.

## 2. Risk Assessment & Environment Check

Before starting, confirm the VPS specs to avoid disaster:

- **Price & specs**: Duokaiyun 10 RMB/month "挂机宝". ~30-50GB disk, KVM architecture (**must be KVM — OpenVZ/LXC cannot DD**).
- **Current OS**: CentOS 7.2 (EOL, official repos offline).
- **Core risk**: DD will **wipe the entire `/dev/sda`**. Data cannot be recovered. Make absolutely sure there's nothing important, or that you have a backup.

## 3. Step-by-Step Operations

The process has four steps — copy and paste each block.

### 3.1 Fix CentOS 7's Dying Repos

Since CentOS 7 has reached EOL, the default repos are dead. Switch to Aliyun's Vault mirror first, or the script's dependencies won't install.

```bash
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo
yum clean all && yum makecache
```

### 3.2 Get the Reinstall Toolkit

Download the `bin456789/reinstall` script (a popular third-party DD script).

```bash
curl -O https://cnb.cool/bin456789/reinstall/-/git/raw/main/reinstall.sh || wget -O reinstall.sh https://cnb.cool/bin456789/reinstall/-/git/raw/main/reinstall.sh
chmod +x reinstall.sh
```

### 3.3 Execute Debian 12 Reinstall

Specify the target system and set the root password (**make sure to replace with your own strong password**).

```bash
./reinstall.sh debian 12 --password <your-strong-password> --username root
```

*The script handles kernel download, GRUB boot injection, and other complex operations automatically.*

### 3.4 Reboot and Silent Install

After the script configures Grub, reboot to start the Debian 12 network install.

```bash
reboot
```

## 4. Verification & Next Steps

After rebooting, wait about 5-15 minutes, then try to connect via SSH. If you can connect, the reinstall succeeded. At this point, you can log into the fresh Debian 12 machine and run Trae Agent or OpenCode without issues.

**Tips:**

- If SSH doesn't connect, open the **VNC console** in the Duokaiyun dashboard to check progress. Network hiccups can interrupt the install — just reboot and let it continue.
- After DD completes, the first order of business is to change the default password to ensure security.

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/centos7-jumpbox-dd-debian12-vps.html
