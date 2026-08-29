<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Mainland China VPS Network Pitfalls: GitHub Blocked, Cloud PC Security Groups, HTTP Proxy Interception, and File Transfer Solutions

## 1. Background

When installing software and setting up remote management on a NAT VPS hosted in mainland China, network issues are the biggest obstacle. GitHub is blocked so installation packages cannot be downloaded directly; the cloud PC's security group blocks inbound connections so file transfer fails; and the HTTP proxy intercepts requests to non-standard ports, making WinRM return 404.

This article collects the network pitfalls encountered while operating mainland China VPS instances, covering symptoms, root causes, fixes, and the final file transfer solution.

## 2. GitHub Is Blocked

### 2.1 Symptom

Downloading files from GitHub directly on the VPS times out or fails to connect:

```bash
wget https://github.com/PowerShell/Win32-OpenSSH/releases/download/v<version>/OpenSSH-Win64.zip
# connection timeout
```

curl fails the same way:

```bash
curl -L -o OpenSSH-Win64.zip https://github.com/PowerShell/Win32-OpenSSH/releases/download/v<version>/OpenSSH-Win64.zip
# Failed to connect to github.com port 443: Connection timed out
```

### 2.2 GitHub Mirrors Are Unavailable Too

Common GitHub mirrors all failed:

| Mirror | Result |
|------|------|
| ghproxy.com | cannot connect |
| mirror.ghproxy.com | cannot connect |
| gh.api.99988866.xyz | cannot connect |
| gh-proxy.com | cannot connect |

These mirrors are either blocked by domain or have shut down.

### 2.3 Domestic Sites Are Basically Reachable

Testing domestic sites:

```bash
# Baidu
curl -s -o /dev/null -w "%{http_code} %{size_download}" https://www.baidu.com
# 200 29050

# atomgit (domestic code hosting)
curl -s -o /dev/null -w "%{http_code} %{size_download}" https://atomgit.com
# 200 252674
```

Both Baidu and atomgit work fine, which shows domestic sites are basically reachable from a mainland China VPS — it is mainly GitHub and other overseas sites that are blocked.

### 2.4 Fixes

**Option 1: Download source from a domestic mirror and compile it manually**

OpenSSH source can be pulled from a domestic mirror (e.g. an atomgit mirror of OpenSSH), but compiling OpenSSH on Windows requires Visual Studio Build Tools + CMake + Perl + NASM + OpenSSL. The toolchain is complex and the build takes 1-2 hours — not recommended.

**Option 2: Transfer the file from the cloud PC (recommended)**

Download the installer on the cloud PC (it can reach GitHub or has domestic mirrors), then transfer it to the VPS using the file transfer approach. See the final file transfer solution in Section 5.

**Option 3: Use a domestic package manager**

Package managers such as MSYS2, Chocolatey and Scoop may have domestic mirrors, but installing the package manager itself also requires a download, which may also be blocked.

## 3. Cloud PC Inbound Security Group

### 3.1 Symptom

Start an HTTP server on the cloud PC so the VPS can download files from it:

```bash
# Start an HTTP server on the cloud PC
python3 -m http.server 8765
# Serving HTTP on 0.0.0.0 port 8765
```

Test the connection from the VPS:

```powershell
Test-NetConnection -ComputerName <cloud-PC-IP> -Port 8765
# TcpTestSucceeded : False
```

The connection fails.

### 3.2 Every Port Is Unreachable

Testing multiple ports on the cloud PC:

| Port | Service | Result |
|------|------|------|
| 80 | nginx | ❌ unreachable |
| 8080 | unknown | ❌ unreachable |
| 8091 | python-server | ❌ unreachable |
| 8118 | tinyproxy | ❌ unreachable |
| 6080 | websocat | ❌ unreachable |
| 8765 | python http.server | ❌ unreachable |

All inbound ports are blocked by the security group.

### 3.3 Root Cause

The cloud PC (the runtime environment of the Doubao work mode) has strict inbound security group rules: only specific internal service ports are allowed (e.g. Chrome CDP's 9222, but it only listens on 127.0.0.1), and no port is accessible from outside.

Even though the cloud PC has a public IP, the outside world cannot actively connect to any of its ports.

### 3.4 The Cloud PC Public IP Changes Dynamically

The cloud PC's public IP also changes over time (e.g. 101.x.x.1 → 101.x.x.190), so you cannot rely on a fixed IP.

### 3.5 No sudo Privileges

The cloud PC has no sudo privileges (blocked by the `"no new privileges"` flag), so iptables or nginx configs cannot be modified to open ports.

### 3.6 Fix: Reverse the Direction

The cloud PC's inbound is blocked, but its **outbound works**. So reverse the direction:

- ❌ Cloud PC starts an HTTP server, VPS downloads (inbound blocked)
- ✅ VPS starts an HTTP server, cloud PC uploads (outbound works)

See the final file transfer solution in Section 5.

## 4. Cloud PC HTTP Proxy Interception

### 4.1 Symptom

Connecting from the cloud PC to the VPS WinRM port with pywinrm returns 404:

```python
import winrm
s = winrm.Session('http://<public-IP>:<public-WinRM-port>/wsman',
                  auth=('Administrator', '<password>'), transport='ntlm')
r = s.run_cmd('hostname')
# WinRMTransportError: Bad HTTP response returned from server. Code 404
```

Test with curl:

```bash
curl -v -X POST http://<public-IP>:<public-WinRM-port>/wsman
# < HTTP/1.1 404 Not Found
# < Server: Proxy-1.13.0
```

The response header `Server` is `Proxy-1.13.0` (nginx), not WinRM's response.

### 4.2 Root Cause: The Cloud PC Has an HTTP Proxy Configured by Default

Check the cloud PC's environment variables:

```bash
env | grep -i proxy
# http_proxy=http://proxy-sid-...@vortex-...:8080
# https_proxy=http://proxy-sid-...@vortex-...:8080
```

The cloud PC has an HTTP proxy configured by default, so every HTTP/HTTPS request goes through the proxy. The proxy returns 404 for requests to non-standard ports (such as WinRM's mapped 5985 port).

### 4.3 Fix: Disable the Proxy

**Disable the proxy in Python:**

```python
import os
for k in ['http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY','all_proxy','ALL_PROXY']:
    os.environ.pop(k, None)
os.environ['no_proxy'] = '*'
```

**Disable the proxy in curl:**

```bash
curl --noproxy '*' -X POST http://<public-IP>:<port>/wsman
```

After disabling the proxy, WinRM responds correctly:

```python
r = s.run_cmd('hostname')
# <hostname>
```

### 4.4 Notes

- The proxy only affects HTTP/HTTPS requests, not SSH (SSH is a separate protocol that does not use the HTTP proxy)
- But if you tunnel SSH through the HTTP proxy with tools like proxytunnel or corkscrew, it will be affected too
- The proxy config is at the environment-variable level; every new shell inherits it, so you must disable it every time

## 5. The Final File Transfer Solution

### 5.1 Failed Approaches Summary

| Approach | Failure Reason |
|------|----------|
| VPS downloads directly from GitHub | GitHub is blocked |
| VPS downloads from a GitHub mirror | Mirrors are also unavailable |
| Cloud PC starts an HTTP server, VPS downloads | Cloud PC inbound security group blocks it |
| WinRM base64 chunked transfer | WinRM command-line length limit (~8KB) |

### 5.2 The Working Approach: Reverse Upload with an HTTP Server on the VPS Side

**Idea**: The cloud PC's inbound is blocked, but its outbound works. So start a temporary HTTP server on the VPS (Windows), expose it to the public network via the Duokaiyun port mapping, then upload files from the cloud PC with curl.

#### Step 1: Start an HTTP server on the VPS

PowerShell script (http_server.ps1):

```powershell
$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://+:8080/')
$listener.Start()
Write-Output "HTTP server started, listening on port 8080"
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
            Write-Output "Upload complete: $msg"
        }
        $response.Close()
    } catch { }
}
```

#### Step 2: Start it with WMI (independent of the WinRM session)

Processes started over WinRM may be killed when the WinRM session ends. Use WMI `Win32_Process.Create` instead, so the process is independent of the WinRM session:

```powershell
$process = [WMICLASS]"Win32_Process"
$result = $process.Create("powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Users\Administrator\http_server.ps1")
Write-Output "ProcessId: $($result.ProcessId)"
```

#### Step 3: Add port mapping + firewall rule

- Add a port mapping in the Duokaiyun console: public port → internal port 8080
- Allow 8080 in the Windows firewall:

```powershell
New-NetFirewallRule -DisplayName 'HTTP Upload' -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -EdgeTraversalPolicy Allow
```

#### Step 4: Upload from the cloud PC

```bash
curl --noproxy '*' -X POST --data-binary @OpenSSH-Win64.zip \
  "http://<public-IP>:<public-HTTP-upload-port>/upload?filename=OpenSSH-Win64.zip"
```

#### Measured Results

- A 4.8MB file uploaded in only 7 seconds
- Speed: 691 KB/s
- The file's MD5 on the VPS matches the source file

### 5.3 Generalization: Any File Can Be Transferred This Way

This approach is not limited to the OpenSSH installer — any file can be transferred from the cloud PC to the VPS this way:

1. Start an HTTP server on the VPS (or FTP, SMB, etc.)
2. Add a port mapping in the console
3. Upload from the cloud PC with curl/ftp

The key is to **reverse the direction**: do not have the VPS actively connect to the cloud PC (inbound is blocked); have the cloud PC actively connect to the VPS (outbound works).

## 6. Other Network Pitfalls

### 6.1 The Windows Template Disables Windows Update

The Duokaiyun Windows template disables the Windows Update service (wuauserv), which causes:
- `Add-WindowsCapability` fails (error 1083)
- `dism /online /Add-Capability` fails
- No optional feature can be installed (OpenSSH Server, .NET Framework, etc.)

The only way is to download the installer manually.

### 6.2 Internal Ports 22/2222 Are Restricted

When adding a port mapping in the Duokaiyun console, submitting internal port 22 or 2222 fails (it redirects to the home page without any message). Non-standard ports (e.g. 3456, 5985, 8080) can be added normally.

SSH must listen on a non-standard port (e.g. 3456).

### 6.3 atomgit Mirrors Have No Releases

atomgit's mirrors of GitHub projects only contain code branches, not release attachments. Projects that need prebuilt binaries (e.g. OpenSSH-Win64.zip) cannot be downloaded from atomgit mirrors.

## 7. Tracing the Misconceptions

### 7.1 "GitHub is blocked, just use ghproxy" — false

Common GitHub mirrors such as ghproxy and mirror.ghproxy.com are also unavailable on mainland China VPSes (domain blocked or service shut down). You need other domestic mirrors, or transfer the file manually.

### 7.2 "Start an HTTP server on the cloud PC and download from the VPS" — false

All inbound ports on the cloud PC are blocked by the security group, so the VPS cannot reach any port on the cloud PC. You must reverse the direction: start an HTTP server on the VPS, and upload from the cloud PC.

### 7.3 "WinRM returning 404 means WinRM is misconfigured" — not necessarily

The 404 may come from the cloud PC's HTTP proxy (nginx), not from WinRM. Look at the `Server` field in the response header to tell who returned the error. After disabling the proxy, WinRM responds correctly.

### 7.4 "WinRM base64 chunked transfer can send large files" — false

WinRM's command-line length limit is about 8KB; with base64 encoding, 6KB of data already exceeds the limit. A 4.8MB file would require thousands of chunks, which is completely impractical. Use HTTP/FTP or similar protocols instead.

### 7.5 "A public IP on the cloud PC means it can serve the outside world" — false

The cloud PC's public IP changes dynamically, and the inbound security group blocks every port. Even with a public IP, no external party can actively connect to any service on the cloud PC.

## 8. Actionable Takeaways: A Checklist for Mainland China VPS Networking

### 8.1 Downloading Files

- [ ] Test whether GitHub is reachable first (`curl -I https://github.com`)
- [ ] If not, look for domestic mirrors (atomgit, Tsinghua mirror, Aliyun mirror, etc.)
- [ ] If no domestic mirror has it, download on the cloud PC and transfer it
- [ ] atomgit mirrors only have code, no release attachments

### 8.2 File Transfer (Cloud PC ↔ VPS)

- [ ] Do not have the VPS actively connect to the cloud PC (inbound is blocked)
- [ ] Reverse the direction: start an HTTP/FTP server on the VPS, upload from the cloud PC
- [ ] Start background processes on the VPS with WMI (independent of the remote session)
- [ ] Add a port mapping in the console + allow the port in the VPS firewall
- [ ] Upload from the cloud PC with `curl --noproxy '*'` (proxy disabled)
- [ ] Verify the MD5 after uploading

### 8.3 Remote Management

- [ ] Disable the cloud PC's HTTP proxy before connecting via WinRM/SSH
- [ ] Use NTLM authentication for WinRM
- [ ] Use a non-standard port for SSH (22/2222 may be restricted)
- [ ] For 404 errors, check the `Server` field in the response header first to tell whether the proxy or the service returned it

### 8.4 Windows-Specific

- [ ] Windows Update is disabled, so Add-WindowsCapability cannot be used
- [ ] Download and install the installer manually
- [ ] Transfer the installer to the VPS with the file transfer approach

### 8.5 Quick Command Reference

```bash
# Disable the proxy (Python)
import os
for k in ['http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY']:
    os.environ.pop(k, None)
os.environ['no_proxy'] = '*'

# Disable the proxy (curl)
curl --noproxy '*' http://example.com

# Test port connectivity
nc -vz -w 5 <IP> <port>

# Upload a file to the VPS HTTP server
curl --noproxy '*' -X POST --data-binary @file.zip \
  "http://<IP>:<port>/upload?filename=file.zip"
```

```powershell
# Start an HTTP server on Windows (background via WMI)
$process = [WMICLASS]"Win32_Process"
$process.Create("powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\path\http_server.ps1")

# Allow a port in the firewall
New-NetFirewallRule -DisplayName 'HTTP Upload' -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/china-vps-network-pitfalls.html

