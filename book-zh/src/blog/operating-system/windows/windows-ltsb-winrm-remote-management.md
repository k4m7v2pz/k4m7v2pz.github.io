# 受限网络下 Windows 10 LTSB 远程管理踩坑实录：OpenSSH 走不通，WinRM 救场

## 一、场景与约束

一台部署在云端的 Windows 10 Enterprise 2016 LTSB（Build 14393），QEMU/KVM 虚拟机，内网静态 IP `10.178.16.44`。平台已配置端口映射：

```
公网 <public-ip>:<nat-port>  →  内网 10.178.16.44:22
```

**硬性约束**（决定了一切技术选型）：

1. **禁止部署第三方代理/隧道类软件**：Tailscale / ZeroTier / frp / nps / WireGuard 等一律不可用，违反即封号
2. **外网访问受限**：机器能访问的资源极少，GitHub、7-zip.org、SourceForge 等主流下载源均不可达
3. **RDP 传文件不稳**：>1MB 的文件传输频繁报"内部错误"，只适合传几百 K 的文本/小文件
4. **系统老旧**：LTSB 14393 被厂商阉割了大量可选组件（无 Telnet Server、无 OpenSSH Capability）
5. **工作环境**：Mac 侧使用 nushell + uv，希望尽量保持 "just paste" 工作流，少装全局依赖

目标：让 Mac 能像 `ssh win10` 那样直连 Windows 执行 PowerShell 命令。

---

## 二、失败的尝试

### ❌ 尝试 1：Windows 原生 OpenSSH Server

LTSB 14393 的 `Get-WindowsCapability` 里根本没有 `OpenSSH.Server` 条目，DISM 也找不到对应 capability。只能走手动下载 ZIP/MSI 的路。

**国内镜像尝试**：

- `cyberlite.com.cn` 的 MSI → 404
- `cnblogs.com` 的 `OpenSSH-Win64.7z` → **下载成功（5MB）**
- GitHub 官方 ZIP → 连接超时

**死结**：`.7z` 需要 7-Zip 解压，但系统没装 7-Zip，且 7-Zip 官网、各大镜像站（阿里云、华为云、腾讯云）**全部不可达**。Windows 10 LTSB 14393 也**没有 `tar.exe`**（该命令 1803 才加入）。

> ⚠️ **坑点 1**：封闭环境里，"下载一个解压工具"这种在普通环境里 1 分钟的活，在这里是死循环——解压需要工具，工具下载需要网络，网络又不通。

### ❌ 尝试 2：Windows 原生 Telnet Server

DISM 启用 `TelnetServer` 特性 → **特性不存在**。Windows 10 系列只有 Telnet **Client**，Server 组件被完全移除。

### ❌ 尝试 3：传文件破局

从 Mac 传 `7za.exe` 或其他文件会破坏 just paste 工作流，且不符合"不为老系统额外提供文件"的原则。此路堵死。

---

## 三、WinRM：系统原生的救命通道

转机在于：**WinRM（WS-Management）是 Windows 原生组件，LTSB 14393 自带，默认禁用但无需下载任何东西**。

关键思路：

- WinRM 默认监听 5985，但我们可以**改监听端口为 22**，完美复用已有的 NAT 映射 `<nat-port>→22`
- 纯 PowerShell 命令启用，不需要网络下载
- Mac 侧用 Python `pywinrm` 连接，通过 `uv run --with pywinrm` 临时加载，不污染系统环境

### 3.1 Windows 侧启用脚本（纯 ASCII，避免 PowerShell 5.1 中文乱码）

```powershell
# Requires -RunAsAdministrator

# 1. 启动 WinRM 服务并设为自动启动
sc config winrm start= auto
net start winrm

# 2. 删除默认 5985 监听器，创建 22 端口监听器
winrm delete winrm/config/listener?Address=*+Transport=HTTP
winrm create winrm/config/listener?Address=*+Transport=HTTP `@Port=22

# 3. 允许 Basic 认证（Mac 客户端兼容）
winrm set winrm/config/service/auth `@Basic="true"
winrm set winrm/config/service `@AllowUnencrypted="true"
winrm set winrm/config/client `@TrustedHosts="*"

# 4. 防火墙放行 22 端口
New-NetFirewallRule -Name "WinRM-Server-In-TCP" `
    -DisplayName "WinRM Server" `
    -Direction Inbound -Protocol TCP `
    -LocalPort 22 -Action Allow -Profile Any

# 5. 关闭 UAC 远程限制（允许本地管理员远程登录）
$reg = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
New-ItemProperty -Path $reg -Name "LocalAccountTokenFilterPolicy" `
    -Value 1 -PropertyType DWord -Force
```

> 💡 **坑点 2**：PowerShell 里 `winrm set` 命令的 `@{...}` 语法必须写成 `` `@{...} ``（反引号转义），否则 PowerShell 会把 `@` 当成数组操作符报错。这是 WinRM 配置脚本最常见的语法坑。

> ⚠️ **坑点 3**：如果网络位置被识别为 Public（LTSB 默认），`winrm quickconfig` 会失败："由于此计算机上的网络连接类型之一设置为公用，因此 WinRM 防火墙例外将不运行"。需先用 `Set-NetConnectionProfile -NetworkCategory Private` 改为专用网络，或像上面脚本那样直接手动建防火墙规则绕过。

### 3.2 验证 Windows 侧

```powershell
Get-Service winrm          # 应为 Running, Automatic
Get-NetTCPConnection -LocalPort 22   # 应看到 LISTENING
winrm enumerate winrm/config/listener  # 应看到 Port=22 的 HTTP 监听器
```

### 3.3 Mac 侧连接（uv + pywinrm，零全局安装）

```bash
uv run --with pywinrm python -c '
import winrm
s = winrm.Session("http://<public-ip>:<nat-port>",
                  auth=("Administrator", "你的密码"))
print(s.run_cmd("powershell Get-Service winrm").std_out.decode())
'
```

**输出**：

```
Status   Name               DisplayName
------   ----               -----------
Running  winrm              Windows Remote Management (WS-Manag...
```

✅ **全链路通了**。

### 3.4 交互式 PowerShell（最接近的 ssh 体验）

保存为 `winrm_sh.py`：

```python
#!/usr/bin/env python3
"""用 uv 临时加载 pywinrm 并进入交互 shell"""

import winrm
import sys

s = winrm.Session("http://<public-ip>:<nat-port>",
                  auth=("Administrator", "你的密码"))
print("Connected to Windows via WinRM. Type exit to quit.")

def decode(b):
    if not b:
        return ""
    for enc in ("utf-8", "gbk", "latin-1"):
        try:
            return b.decode(enc)
        except Exception:
            continue
    return b.decode("utf-8", errors="replace")

while True:
    try:
        cmd = input("PS> ")
        if cmd.lower() == "exit":
            break
        r = s.run_cmd(f"powershell -Command \"{cmd}\"")
        if r.std_out:
            print(decode(r.std_out).rstrip())
        if r.std_err:
            print(decode(r.std_err).rstrip(), file=sys.stderr)
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f"Error: {e}")
```

运行：`uv run --with pywinrm python winrm_sh.py`

> 💡 **坑点 4**：pywinrm 的 Response 对象错误属性名是 `std_err`（带下划线），不是 `stderr`。且 Windows 中文输出是 GBK 编码，必须按 GBK→UTF-8 顺序尝试解码，否则中文变 `?`。

---

## 四、完整坑点总结

| 坑点 | 现象 | 根因 | 解决方案 |
|---|---|---|---|
| 1 | 下载 7-Zip 解压 OpenSSH.7z 失败 | 外网全墙，仅 cnblogs 可达 | 放弃 OpenSSH，改用原生 WinRM |
| 2 | `winrm set` 命令报语法错误 | PowerShell 把 `@{` 解析为数组 | 反引号转义：`` `@{ `` |
| 3 | WinRM 防火墙规则不生效 | 网络位置为 Public | 手动 `New-NetFirewallRule` 绕过 |
| 4 | 中文输出乱码 `?` | Windows 用 GBK，Python 默认 UTF-8 | 按 `utf-8→gbk→latin-1` 顺序解码 |
| 5 | `response.stderr` 属性错误 | pywinrm API 是 `std_err` | 改用 `r.std_err` |
| 6 | Telnet Server 不存在 | Win10 系列已移除该组件 | 改用 WinRM |
| 7 | `tar.exe` 不存在 | 该命令 1803 才加入 | 不用 tar，直接 WinRM |
| 8 | `pip3 install` 被拒 | macOS PEP 668 外部托管环境 | 用 `uv run --with pywinrm` 临时环境 |

---

## 五、为什么 WinRM 是这个场景的最优解

1. **合规性**：WinRM 是 Windows 系统原生管理组件，不属于"代理/内网穿透"范畴，不会触发平台风控
2. **零文件传输**：纯 PowerShell 命令启用，不需要从 Mac 传任何文件
3. **复用已有 NAT**：监听端口改为 22，直接对接平台已配置的 `<nat-port>→22` 映射
4. **Mac 侧零污染**：`uv run --with pywinrm` 临时拉起隔离环境，不写全局 site-packages
5. **完整 PowerShell 体验**：远程执行 PS 5.1 cmdlet，能力等同本地
6. **稳定性**：系统服务级组件，重启自动拉起

---

## 六、安全建议

> ⚠️ 当前配置为快速连通，**允许了 Basic 认证和明文传输**。生产环境建议：
> 1. 在 Windows 侧用 `winrm set` 关闭 `AllowUnencrypted`，配置 HTTPS 监听器 + 自签证书
> 2. 防火墙规则收窄 `RemoteAddress` 为 Mac 所在网段
> 3. 定期更换 Administrator 密码
> 4. 不用时 `Stop-Service winrm` 关闭服务

---

## 七、结语

在受限网络环境里做远程管理，**最大的认知转变是：放弃"下载一个更好的工具"的执念，回归系统原生能力**。OpenSSH 虽好，但在这个环境里就是装不上；Telnet 虽老，组件已被砍掉；唯有 WinRM，从 Windows Vista 起就是系统标配，静静躺在那里等待被启用。

配合 Mac 上 `uv` 这个现代 Python 包管理器，"临时拉取依赖 + 执行 + 清理"的模式，完美兼顾了**能力**与**整洁**。整套方案从 Windows 启用到 Mac 连接，**没有传一个文件，没有装一个全局包，没有碰任何第三方代理软件**——这才是受限网络下该有的技术姿态。

> 📌 适用场景：Windows 7/8/10/11 全系列（WinRM 原生支持）、禁止第三方组网软件的环境、外网受限的隔离网络、需要通过已有端口映射做远程管理的所有情况。


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/windows-ltsb-winrm-remote-management.html
