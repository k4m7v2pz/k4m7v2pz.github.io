# Remote Management of Windows 10 LTSB in Restricted Networks: When OpenSSH Fails, WinRM to the Rescue

## 1. Scenario & Constraints

A Windows 10 Enterprise 2016 LTSB (Build 14393) instance deployed in the cloud as a QEMU/KVM VM, with a static internal IP of `10.178.16.44`. The platform has port forwarding configured:

```
Public <public-ip>:<nat-port>  →  Internal 10.178.16.44:22
```

**Hard constraints** (dictating every technical decision):

1. **No third-party proxy/tunnel software allowed**: Tailscale / ZeroTier / frp / nps / WireGuard are all forbidden — violation leads to account suspension
2. **Restricted outbound access**: The machine can reach very few resources; GitHub, 7-zip.org, SourceForge, and other mainstream download sources are all unreachable
3. **Unstable RDP file transfer**: Transfers >1MB frequently fail with "Internal Error", only suitable for text/small files of a few hundred KB
4. **Aged system**: LTSB 14393 has many optional components stripped by the vendor (no Telnet Server, no OpenSSH Capability)
5. **Workstation environment**: macOS with nushell + uv — prefer a "just paste" workflow with minimal global dependencies

Goal: Enable the Mac to connect to Windows and execute PowerShell commands directly, as easily as `ssh win10`.

---

## 2. Failed Attempts

### ❌ Attempt 1: Windows Native OpenSSH Server

LTSB 14393's `Get-WindowsCapability` has no `OpenSSH.Server` entry at all, and DISM cannot find the corresponding capability. The only option was manual ZIP/MSI download.

**Mirror attempts within China**:

- `cyberlite.com.cn` MSI → 404
- `cnblogs.com` `OpenSSH-Win64.7z` → **Downloaded successfully (5MB)**
- GitHub official ZIP → Connection timed out

**Dead end**: `.7z` requires 7-Zip to extract, but the system doesn't have 7-Zip installed, and the 7-Zip website as well as all major mirror sites (Alibaba Cloud, Huawei Cloud, Tencent Cloud) are **all unreachable**. Windows 10 LTSB 14393 also **does not have `tar.exe`** (it was added in 1803).

> ⚠️ **Gotcha 1**: In a closed environment, "download an extraction tool" — a one-minute task in a normal environment — becomes an infinite loop: extraction needs a tool, the tool needs network access, and the network is blocked.

### ❌ Attempt 2: Windows Native Telnet Server

DISM enable `TelnetServer` feature → **Feature does not exist**. The Windows 10 series only has Telnet **Client**; the Server component has been completely removed.

### ❌ Attempt 3: Breaking the Deadlock by Transferring Files

Transferring `7za.exe` or other files from the Mac would break the "just paste" workflow and violates the principle of "no extra files provided to the old system". This path was a dead end.

---

## 3. WinRM: The Native Lifeline

The turning point: **WinRM (WS-Management) is a native Windows component, included in LTSB 14393, disabled by default but requiring no downloads whatsoever**.

Key insight:

- WinRM listens on port 5985 by default, but we can **change the listening port to 22**, perfectly reusing the existing NAT mapping `<nat-port>→22`
- Enabling it requires only PowerShell commands — no network downloads needed
- On the Mac side, connect via Python `pywinrm` with `uv run --with pywinrm` for a temporary environment, leaving no global footprint

### 3.1 Windows-Side Enablement Script (Plain ASCII to Avoid PowerShell 5.1 Encoding Issues)

```powershell
# Requires -RunAsAdministrator

# 1. Start WinRM service and set to auto-start
sc config winrm start= auto
net start winrm

# 2. Delete the default 5985 listener and create one on port 22
winrm delete winrm/config/listener?Address=*+Transport=HTTP
winrm create winrm/config/listener?Address=*+Transport=HTTP `@Port=22

# 3. Allow Basic authentication (for Mac client compatibility)
winrm set winrm/config/service/auth `@Basic="true"
winrm set winrm/config/service `@AllowUnencrypted="true"
winrm set winrm/config/client `@TrustedHosts="*"

# 4. Open port 22 in the firewall
New-NetFirewallRule -Name "WinRM-Server-In-TCP" `
    -DisplayName "WinRM Server" `
    -Direction Inbound -Protocol TCP `
    -LocalPort 22 -Action Allow -Profile Any

# 5. Disable UAC remote restrictions (allow local admin remote login)
$reg = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
New-ItemProperty -Path $reg -Name "LocalAccountTokenFilterPolicy" `
    -Value 1 -PropertyType DWord -Force
```

> 💡 **Gotcha 2**: In PowerShell, the `@{...}` syntax in `winrm set` commands must be written as `` `@{...} `` (backtick-escaped); otherwise PowerShell treats `@` as the array operator and throws a syntax error. This is the most common pitfall in WinRM configuration scripts.

> ⚠️ **Gotcha 3**: If the network profile is detected as Public (LTSB default), `winrm quickconfig` will fail: "WinRM firewall exception will not run because one of the network connection types on this computer is set to Public." You must either switch to a private network with `Set-NetConnectionProfile -NetworkCategory Private` or bypass it by creating the firewall rule manually as shown above.

### 3.2 Verify on Windows Side

```powershell
Get-Service winrm          # Should show Running, Automatic
Get-NetTCPConnection -LocalPort 22   # Should show LISTENING
winrm enumerate winrm/config/listener  # Should show Port=22 HTTP listener
```

### 3.3 Mac-Side Connection (uv + pywinrm, Zero Global Installation)

```bash
uv run --with pywinrm python -c '
import winrm
s = winrm.Session("http://<public-ip>:<nat-port>",
                  auth=("Administrator", "your_password"))
print(s.run_cmd("powershell Get-Service winrm").std_out.decode())
'
```

**Output**:

```
Status   Name               DisplayName
------   ----               -----------
Running  winrm              Windows Remote Management (WS-Manag...
```

✅ **Full chain is working**.

### 3.4 Interactive PowerShell (Closest to the SSH Experience)

Save as `winrm_sh.py`:

```python
#!/usr/bin/env python3
"""Use uv to temporarily load pywinrm and enter an interactive shell"""

import winrm
import sys

s = winrm.Session("http://<public-ip>:<nat-port>",
                  auth=("Administrator", "your_password"))
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

Run it: `uv run --with pywinrm python winrm_sh.py`

> 💡 **Gotcha 4**: The pywinrm Response object's error attribute is `std_err` (with underscore), not `stderr`. Also, Chinese output from Windows uses GBK encoding — you must attempt decoding in GBK→UTF-8 order, otherwise Chinese characters become `?`.

---

## 4. Complete Gotcha Summary

| # | Symptom | Root Cause | Solution |
|---|---|---|---|
| 1 | Can't extract OpenSSH.7z | Outbound network fully blocked, only cnblogs reachable | Abandon OpenSSH, use native WinRM |
| 2 | `winrm set` throws syntax error | PowerShell interprets `@{` as array operator | Backtick-escape: `` `@{ `` |
| 3 | WinRM firewall rule doesn't apply | Network profile is Public | Create rule manually with `New-NetFirewallRule` |
| 4 | Chinese output shows as `?` | Windows uses GBK, Python defaults to UTF-8 | Decode in `utf-8→gbk→latin-1` order |
| 5 | `response.stderr` attribute error | pywinrm API uses `std_err` | Use `r.std_err` instead |
| 6 | Telnet Server doesn't exist | Win10 series removed this component | Use WinRM instead |
| 7 | `tar.exe` not found | Command added in 1803 | Skip tar, use WinRM directly |
| 8 | `pip3 install` rejected | macOS PEP 668 externally managed environment | Use `uv run --with pywinrm` temporary environment |

---

## 5. Why WinRM Is the Optimal Solution for This Scenario

1. **Compliance**: WinRM is a native Windows management component — not a "proxy/tunnel" tool — and won't trigger platform risk controls
2. **Zero file transfer**: Enabled purely via PowerShell commands, no files need to be transferred from the Mac
3. **Reuses existing NAT**: Change the listening port to 22, directly leveraging the platform's configured `<nat-port>→22` mapping
4. **Zero pollution on Mac**: `uv run --with pywinrm` creates a temporary isolated environment without touching global site-packages
5. **Full PowerShell experience**: Execute PS 5.1 cmdlets remotely with capabilities equivalent to local access
6. **Stability**: System service-level component, auto-starts on reboot

---

## 6. Security Recommendations

> ⚠️ The current configuration prioritizes quick connectivity — **Basic authentication and unencrypted traffic are enabled**. For production environments:
> 1. On Windows, use `winrm set` to disable `AllowUnencrypted` and configure an HTTPS listener with a self-signed certificate
> 2. Narrow the firewall rule's `RemoteAddress` to the Mac's subnet
> 3. Rotate the Administrator password regularly
> 4. Stop the service when not in use: `Stop-Service winrm`

---

## 7. Conclusion

When managing remote systems in a restricted network environment, **the biggest mindset shift is: let go of the obsession with "downloading a better tool" and return to the system's native capabilities**. OpenSSH is great, but in this environment it simply couldn't be installed; Telnet is old, but the component has been removed; only WinRM, a standard component since Windows Vista, sits quietly waiting to be enabled.

Paired with `uv` — the modern Python package manager on macOS — the "temporarily pull dependencies, execute, and clean up" model perfectly balances **capability** and **tidiness**. From Windows enablement to Mac connection, the entire solution **transferred zero files, installed zero global packages, and touched zero third-party proxy software** — this is the proper technical posture for a restricted network.

> 📌 Applicable scenarios: Windows 7/8/10/11 all series (WinRM native support), environments where third-party networking software is prohibited, isolated networks with restricted outbound access, and any situation requiring remote management through existing port mappings.