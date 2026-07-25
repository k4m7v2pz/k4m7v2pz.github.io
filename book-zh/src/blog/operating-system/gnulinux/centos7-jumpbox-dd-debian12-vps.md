
## 一、痛点溯源：为什么我要动这块"10 元机"？

纯粹是手痒想折腾点新玩法。看到**多开云**这种 10 元/月的低配机，第一反应是买一台挂着跑跑 **Trae Agent**，或者丢在后台跑跑 **OpenCode** 这类字符界面工具。

结果刚连上就吃了闭门羹。排查后发现是 **`glibc` 版本不兼容**——这些现代工具链要求 `glibc` >= 2.28，而商家给的默认底包还是经典的 **CentOS 7**（自带 `glibc 2.17`）。

去找商家客服要个 Debian 或 Ubuntu 20.04+ 的镜像？不存在的，便宜机器的镜像库就那两三个老古董。商家不给换，那就自己动手！既然没法直接更换系统，那就拿 CentOS 7 当跳板，直接 DD 重装大法，硬生生把系统底包给"刷"成现代化的 **Debian 12**。

## 二、风险评估与环境确认

在开始之前，先确认一下手里这块"砖"的参数，避免翻车：

- **价格与配置**：多开云（Duokaiyun）10 元/月挂机宝。约 30-50GB 硬盘，KVM 架构（**必须是 KVM，OpenVZ/LXC 无法 DD**）。
- **系统现状**：CentOS 7.2（已 EOL，官方源下线）。
- **核心风险**：DD 操作会**全盘格式化** `/dev/sda`，数据无法恢复。请务必确认没有重要数据，或者已经备份。

## 三、实战操作流（核心代码）

整个过程分为四步，直接复制粘贴执行即可。

### 1. 修复 CentOS 7 的"临终"源

由于 CentOS 7 已停止维护，默认源失效。必须先切换至阿里云 Vault 源，否则脚本依赖包装不上。

```bash
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
curl -o /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo
yum clean all && yum makecache
```

### 2. 获取重装武器库

下载 `bin456789/reinstall` 脚本（一个非常流行的第三方 DD 脚本）。

```bash
curl -O https://cnb.cool/bin456789/reinstall/-/git/raw/main/reinstall.sh || wget -O reinstall.sh https://cnb.cool/bin456789/reinstall/-/git/raw/main/reinstall.sh
chmod +x reinstall.sh
```

### 3. 执行 Debian 12 重装指令

指定目标系统，并设置好 Root 密码（**请务必替换为您自己的强密码**）。

```bash
./reinstall.sh debian 12 --password <your-strong-password> --username root
```

*脚本会自动处理内核下载、GRUB 引导注入等复杂操作。*

### 4. 重启与静默安装

脚本配置完 Grub 后，重启即进入 Debian 12 的网络安装流程。

```bash
reboot
```

## 四、结果验证与后续

重启后大约 5-15 分钟，尝试通过 SSH 连接。如果能连上，说明重装成功。此时再把终端连上这台焕然一新的 Debian 12 机器，就能愉快地跑 Trae Agent 或 OpenCode 了。

**避坑指南**：

- 如果 SSH 连不上，去多开云后台开 **VNC 控制台**查看进度，有时网络波动会导致安装中断，重启机器让它继续跑就行。
- DD 完成后，第一件事就是修改默认密码，确保安全。


---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/gnulinux/centos7-jumpbox-dd-debian12-vps.html
