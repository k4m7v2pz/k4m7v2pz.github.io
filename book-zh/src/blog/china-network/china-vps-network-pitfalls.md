<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 大陆机房 VPS 网络避坑指南：GitHub 被墙、云电脑安全组、HTTP 代理拦截与文件传输方案

## 1. 背景

在大陆机房的 NAT VPS 上安装软件、配置远程管理时，网络问题是最大的障碍之一。GitHub 被墙导致无法直接下载安装包，云电脑的安全组阻止入站连接导致文件传输失败，HTTP 代理拦截非标准端口请求导致 WinRM 返回 404。

本文整理大陆机房 VPS 运维中遇到的各类网络坑，包括现象、根因、修复方案，以及文件传输的最终解决方案。

## 2. GitHub 被墙

### 2.1 现象

在 VPS 上直接下载 GitHub 上的文件，超时或连接失败：

```bash
wget https://github.com/PowerShell/Win32-OpenSSH/releases/download/v<version>/OpenSSH-Win64.zip
# 连接超时
```

curl 同样失败：

```bash
curl -L -o OpenSSH-Win64.zip https://github.com/PowerShell/Win32-OpenSSH/releases/download/v<version>/OpenSSH-Win64.zip
# Failed to connect to github.com port 443: Connection timed out
```

### 2.2 GitHub 镜像也不可用

尝试常见的 GitHub 镜像，全部失败：

| 镜像 | 结果 |
|------|------|
| ghproxy.com | 无法连接 |
| mirror.ghproxy.com | 无法连接 |
| gh.api.99988866.xyz | 无法连接 |
| gh-proxy.com | 无法连接 |

这些镜像要么域名被墙，要么服务已停止。

### 2.3 国内网站基本可用

测试国内网站：

```bash
# 百度
curl -s -o /dev/null -w "%{http_code} %{size_download}" https://www.baidu.com
# 200 29050

# atomgit（国内代码托管）
curl -s -o /dev/null -w "%{http_code} %{size_download}" https://atomgit.com
# 200 252674
```

百度和 atomgit 都能正常访问，说明大陆机房的国内网站基本可用，主要是 GitHub 等国外网站被墙。

### 2.4 修复方案

**方案一：从国内镜像下载源码，手动编译**

OpenSSH 的源码可以从国内镜像（如 atomgit 的 OpenSSH 镜像）下载，但 Windows 上编译 OpenSSH 需要 Visual Studio Build Tools + CMake + Perl + NASM + OpenSSL，环境复杂，编译时间长（1-2 小时），不推荐。

**方案二：从云电脑传输文件（推荐）**

在云电脑上下载好安装包（云电脑能访问 GitHub 或有国内镜像），然后通过文件传输方案传到 VPS。详见本文第五部分的文件传输最终方案。

**方案三：用国内包管理器**

MSYS2、Chocolatey、Scoop 等包管理器可能有国内镜像，但安装包管理器本身也需要下载，且可能也被墙。

## 3. 云电脑入站安全组

### 3.1 现象

在云电脑上启动 HTTP 服务器，想让 VPS 主动下载文件：

```bash
# 云电脑上启动 HTTP 服务器
python3 -m http.server 8765
# Serving HTTP on 0.0.0.0 port 8765
```

在 VPS 上测试连接：

```powershell
Test-NetConnection -ComputerName <云电脑IP> -Port 8765
# TcpTestSucceeded : False
```

连接失败。

### 3.2 所有端口都不可达

测试云电脑的多个端口：

| 端口 | 服务 | 结果 |
|------|------|------|
| 80 | nginx | ❌ 不可达 |
| 8080 | 未知 | ❌ 不可达 |
| 8091 | python-server | ❌ 不可达 |
| 8118 | tinyproxy | ❌ 不可达 |
| 6080 | websocat | ❌ 不可达 |
| 8765 | python http.server | ❌ 不可达 |

所有端口入站都被安全组阻止。

### 3.3 根因

云电脑（豆包工作模式的运行环境）有严格的入站安全组规则，只允许特定的内部服务端口（如 Chrome CDP 的 9222，但只监听 127.0.0.1），不允许外部访问任何端口。

即使云电脑有公网 IP，外部也无法主动连接云电脑的任何端口。

### 3.4 云电脑公网 IP 动态变化

云电脑的公网 IP 还会动态变化（如 101.x.x.1 → 101.x.x.190），不能依赖固定 IP。

### 3.5 无 sudo 权限

云电脑没有 sudo 权限（`"no new privileges"` flag 阻止），无法修改 iptables 或 nginx 配置来开放端口。

### 3.6 修复方案：反转方向

云电脑入站被阻止，但**出站是通的**。所以反转方向：

- ❌ 云电脑启 HTTP 服务器，VPS 主动下载（入站被阻止）
- ✅ VPS 启 HTTP 服务器，云电脑主动上传（出站通）

详见本文第五部分的文件传输最终方案。

## 4. 云电脑 HTTP 代理拦截

### 4.1 现象

从云电脑用 pywinrm 连接 VPS 的 WinRM 端口，返回 404：

```python
import winrm
s = winrm.Session('http://<公网IP>:<WinRM公网端口>/wsman',
                  auth=('Administrator', '<密码>'), transport='ntlm')
r = s.run_cmd('hostname')
# WinRMTransportError: Bad HTTP response returned from server. Code 404
```

用 curl 测试：

```bash
curl -v -X POST http://<公网IP>:<WinRM公网端口>/wsman
# < HTTP/1.1 404 Not Found
# < Server: Proxy-1.13.0
```

响应头的 Server 是 `Proxy-1.13.0`（nginx），不是 WinRM 的响应。

### 4.2 根因：云电脑默认配置了 HTTP 代理

检查云电脑的环境变量：

```bash
env | grep -i proxy
# http_proxy=http://proxy-sid-...@vortex-...:8080
# https_proxy=http://proxy-sid-...@vortex-...:8080
```

云电脑默认配置了 HTTP 代理，所有 HTTP/HTTPS 请求都会走代理。代理服务器对非标准端口（如 WinRM 的 5985 映射端口）的请求返回 404。

### 4.3 修复：禁用代理

**Python 中禁用代理：**

```python
import os
for k in ['http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY','all_proxy','ALL_PROXY']:
    os.environ.pop(k, None)
os.environ['no_proxy'] = '*'
```

**curl 禁用代理：**

```bash
curl --noproxy '*' -X POST http://<公网IP>:<端口>/wsman
```

禁用代理后，WinRM 正常响应：

```python
r = s.run_cmd('hostname')
# <主机名>
```

### 4.4 注意事项

- 代理只影响 HTTP/HTTPS 请求，不影响 SSH（SSH 是独立协议，不走 HTTP 代理）
- 但如果用了 proxytunnel 或 corkscrew 等工具把 SSH 走 HTTP 代理，也会受影响
- 云电脑的代理配置是环境变量级别，每个新的 shell 都会继承，需要每次禁用

## 5. 文件传输最终方案

### 5.1 失败的方案总结

| 方案 | 失败原因 |
|------|----------|
| VPS 直接从 GitHub 下载 | GitHub 被墙 |
| VPS 从 GitHub 镜像下载 | 镜像也不可用 |
| 云电脑启 HTTP 服务器，VPS 下载 | 云电脑入站安全组阻止 |
| WinRM base64 分块传输 | WinRM 命令行长度限制（约 8KB） |

### 5.2 成功方案：VPS 侧启 HTTP 服务器反向上传

**思路**：云电脑入站被阻止，但出站通。所以在 VPS（Windows）上启动临时 HTTP 服务器，通过多开云端口映射暴露到公网，然后从云电脑用 curl 上传文件。

#### 步骤一：在 VPS 上启动 HTTP 服务器

PowerShell 脚本（http_server.ps1）：

```powershell
$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://+:8080/')
$listener.Start()
Write-Output "HTTP服务器已启动，监听8080端口"
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        if ($request.HttpMethod -eq 'POST' -and $request.Url.LocalPath -eq '/upload') {
            $filename = $request.QueryString['filename']
            if (-not $filename) { $filename = 'upload.bin' }
            $filepath = Join-Path 'C:\Users\Administrator\Downloads' $filename
            $stream = $request.InputStream
            $fileStream = [System.IO.File]::Create($filepath)
            $stream.CopyTo($fileStream)
            $fileStream.Close()
            $stream.Close()
            $fi = Get-Item $filepath
            $msg = "OK: $filepath ($($fi.Length) bytes)"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Output "上传完成: $msg"
        }
        $response.Close()
    } catch { }
}
```

#### 步骤二：用 WMI 启动（独立于 WinRM 会话）

通过 WinRM 启动的进程，在 WinRM 会话结束后可能被杀。用 WMI `Win32_Process.Create` 启动，进程独立于 WinRM 会话：

```powershell
$process = [WMICLASS]"Win32_Process"
$result = $process.Create("powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\Administrator\http_server.ps1")
Write-Output "ProcessId: $($result.ProcessId)"
```

#### 步骤三：添加端口映射 + 防火墙

- 多开云控制台添加端口映射：公网端口 → 内网 8080
- Windows 防火墙允许 8080：

```powershell
New-NetFirewallRule -DisplayName 'HTTP Upload' -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -EdgeTraversalPolicy Allow
```

#### 步骤四：从云电脑上传

```bash
curl --noproxy '*' -X POST --data-binary @OpenSSH-Win64.zip \
  "http://<公网IP>:<HTTP上传公网端口>/upload?filename=OpenSSH-Win64.zip"
```

#### 实测结果

- 4.8MB 文件上传仅需 7 秒
- 速度 691 KB/s
- 上传后 VPS 上的文件 MD5 与源文件一致

### 5.3 通用化：任何文件都可以这样传

这个方案不仅限于 OpenSSH 安装包，任何文件都可以通过这种方式从云电脑传到 VPS：

1. VPS 上启 HTTP 服务器（或 FTP、SMB 等）
2. 控制台添加端口映射
3. 云电脑用 curl/ftp 上传

关键是**反转方向**：不要让 VPS 主动连云电脑（入站被阻止），要让云电脑主动连 VPS（出站通）。

## 6. 其他网络坑

### 6.1 Windows 模板禁用 Windows Update

多开云 Windows 模板禁用了 Windows Update 服务（wuauserv），导致：
- `Add-WindowsCapability` 失败（错误 1083）
- `dism /online /Add-Capability` 失败
- 无法安装任何可选功能（OpenSSH Server、.NET Framework 等）

只能手动下载安装包安装。

### 6.2 内网端口 22/2222 被限制

多开云控制台添加端口映射时，内网端口填 22 或 2222 会提交失败（跳转到首页无提示）。非标准端口（如 3456、5985、8080）可以正常添加。

SSH 服务需要监听非标准端口（如 3456）。

### 6.3 atomgit 镜像没有 releases

atomgit 对 GitHub 项目的镜像只包含代码分支，不包含 releases 附件。需要预编译二进制的项目（如 OpenSSH-Win64.zip）不能从 atomgit 镜像下载。

## 7. 谬误溯源

### 7.1 「GitHub 被墙，用 ghproxy 就行」——不成立

ghproxy、mirror.ghproxy.com 等常见 GitHub 镜像在大陆机房也不可用（域名被墙或服务停止）。需要找其他国内镜像，或手动传输文件。

### 7.2 「云电脑启个 HTTP 服务器，VPS 下载就行」——不成立

云电脑所有端口入站被安全组阻止，VPS 无法访问云电脑的任何端口。需要反转方向：VPS 启 HTTP 服务器，云电脑上传。

### 7.3 「WinRM 返回 404 = WinRM 没配置好」——不一定是

404 可能是云电脑的 HTTP 代理（nginx）返回的，不是 WinRM 返回的。看响应头的 Server 字段判断是谁返回的错误。禁用代理后 WinRM 正常响应。

### 7.4 「WinRM base64 分块能传大文件」——不成立

WinRM 命令行长度限制约 8KB，base64 编码后 6KB 的数据就超长。4.8MB 文件需要上千块，完全不可行。需要用 HTTP/FTP 等协议传输。

### 7.5 「云电脑有公网 IP 就能对外提供服务」——不成立

云电脑的公网 IP 是动态变化的，且入站安全组阻止所有端口。即使有公网 IP，外部也无法主动连接云电脑的任何服务。

## 8. 落地结论：大陆机房 VPS 网络避坑 checklist

### 8.1 下载文件

- [ ] 先测试 GitHub 是否可达（`curl -I https://github.com`）
- [ ] 不可达则找国内镜像（atomgit、清华镜像、阿里镜像等）
- [ ] 国内镜像也没有的，从云电脑下载后传输
- [ ] atomgit 镜像只有代码，没有 releases 附件

### 8.2 文件传输（云电脑 ↔ VPS）

- [ ] 不要让 VPS 主动连云电脑（入站被阻止）
- [ ] 反转方向：VPS 启 HTTP/FTP 服务器，云电脑上传
- [ ] VPS 上用 WMI 启动后台进程（独立于远程会话）
- [ ] 控制台添加端口映射 + VPS 防火墙放行
- [ ] 云电脑用 `curl --noproxy '*'` 上传（禁用代理）
- [ ] 上传后验证 MD5

### 8.3 远程管理

- [ ] WinRM/SSH 连接前禁用云电脑 HTTP 代理
- [ ] WinRM 用 NTLM 认证
- [ ] SSH 用非标准端口（22/2222 可能被限制）
- [ ] 404 错误先看响应头的 Server 字段，判断是代理还是服务返回的

### 8.4 Windows 特有

- [ ] Windows Update 被禁用，不能用 Add-WindowsCapability
- [ ] 手动下载安装包安装
- [ ] 安装包通过文件传输方案传到 VPS

### 8.5 关键命令速查

```bash
# 禁用代理（Python）
import os
for k in ['http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY']:
    os.environ.pop(k, None)
os.environ['no_proxy'] = '*'

# 禁用代理（curl）
curl --noproxy '*' http://example.com

# 测试端口连通性
nc -vz -w 5 <IP> <端口>

# 上传文件到 VPS 的 HTTP 服务器
curl --noproxy '*' -X POST --data-binary @file.zip \
  "http://<IP>:<端口>/upload?filename=file.zip"
```

```powershell
# Windows 上启动 HTTP 服务器（用 WMI 后台启动）
$process = [WMICLASS]"Win32_Process"
$process.Create("powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\path\http_server.ps1")

# 防火墙放行端口
New-NetFirewallRule -DisplayName 'HTTP Upload' -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/china-network/china-vps-network-pitfalls.html
