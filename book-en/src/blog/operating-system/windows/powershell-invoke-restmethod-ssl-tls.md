<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# PowerShell Invoke-RestMethod SSL/TLS Secure Channel Errors: Troubleshooting

> Date: 2026-08-02

### 1. Platform Environment Summary (System Profile)

| Dimension | Actual state |
|---|---|
| Hostname | WIN-XXXXXXXXXXXX |
| OS | Microsoft Windows 10 Enterprise 2016 LTSB |
| Build | 10.0.14393, Build 14393 currently unavailable |
| System type | x64-based PC, QEMU VM (Standard PC i440FX + PIIX, 1996) |
| Processor | Intel64 Family 6 Model 85 Stepping 4, 1 core ~2.7 GHz |
| Physical memory | 2,047 MB (~2 GB), ~698 MB available |
| Network | Static IP `10.x.x.x`, Intel PRO/1000 MT, no DHCP |
| Patch level | 6 Hotfixes, latest KB5023788 from 2023 |
| Installed tools | AtomCode 5.0.0 |
| PowerShell | 5.1; default TLS stack needs TLS 1.2 enabled manually |
| EOL | 2026-10-13 (~2.7 months to end of support) |

⚠️ **Key signal**: This is a QEMU VM running Windows 10 LTSB 2016, CPU Intel64 Family 6 Model 85 (1 core ~2.7 GHz), 2,047 MB physical memory (~698 MB available), with system patches frozen at 2023. It is not a modern dev machine — it's a legacy environment that "runs, but every corner is a trap."

### 2. Issues Encountered and Symptoms

#### Issue 1: PowerShell `irm` Fails to Create an SSL/TLS Secure Channel When Downloading Scripts

When running the install command:

```powershell
irm https://raw.atomgit.com/.../install.ps1 | iex
```

Error:

```powershell
irm : The request was aborted: Could not create SSL/TLS secure channel.
CategoryInfo : InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest)[FullyQualifiedErrorId : WebCmdletWebResponseException]
```

**Root cause**: In Windows PowerShell 5.1 and older, only SSL 3.0 and TLS 1.0 are enabled by default. Servers such as `raw.atomgit.com` now only accept TLS 1.2 or higher, so the protocol negotiation fails and the handshake is aborted. This is the classic problem when connecting to modern APIs like GitHub.

#### Issue 2: System Patches and TLS/Crypto Stack Are Outdated

- Build 14393 is the 2016 RTM baseline
- Only 6 Hotfixes are installed; the vast majority of TLS / Crypto / .NET cumulative updates released between 2016–2023 are missing
- This means that even with TLS 1.2 manually enabled, the underlying Crypto chain may still suffer from missing trust roots, expired certificates, and other problems

#### Issue 3: Extremely Tight Memory

- Current VM quota: 2 GB RAM + 2 vCPU. This is the QEMU VM's allocation cap, not a host hardware limit. To raise it, just adjust the quota at the virtualization layer — no hardware replacement needed.
- Windows itself occupies 800–1000 MB resident
- Once AtomCode kicks off model inference, parallel downloads, or child processes (Git/Node/Python), memory pressure or even OOM is very likely.

#### Issue 4: LTSB 2016 Reaching End of Life

- Microsoft's free security update support for Windows 10 LTSB 2016 ends October 13, 2026
- The current date is July 22, 2026 — only ~2.7 months to EOL
- After that, no more security patches; TLS/Crypto vulnerabilities will go unpatched

### 3. Mitigations Already Applied (Important)

To solve the SSL/TLS issues above, the following operations were performed on the system:

```powershell
# 1. Enable TLS 1.2 for the current session
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
```

```powershell
# 2. Permanently enable strong crypto (registry)
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value 1 -Type DWord
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Wow6432Node\Microsoft\.NETFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value 1 -Type DWord
```

**Result**: after enabling TLS 1.2, the `irm` install command ran successfully; AtomCode 5.0.0 downloaded and installed correctly into the user directory, and PATH is configured.

💡 **Note**: after the registry change, restart PowerShell or the system for it to take effect permanently in new sessions; the current session still needs the first command run manually.

### 4. Collaboration Constraints Suggested for Agents / Conversational AI

To avoid future advice that "looks correct but doesn't actually work", please have AI follow the constraints below in subsequent conversations:

#### ✅ DO (Recommended)

1. **Prefix every command involving `irm` / `Invoke-WebRequest` / `Invoke-RestMethod` with:**

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
```

Or recommend the user upgrade to PowerShell 7+ (pwsh), which enables TLS 1.2/1.3 by default and sidesteps the issue entirely.

2. **When downloading external HTTPS resources, prefer:**

- Use `curl.exe` (bundled with Windows 10) instead of `irm`
- Or download locally first, then execute
- Or provide an "offline install" path

3. **Be restrained with memory-sensitive operations:**

- Avoid suggesting launching multiple heavy processes at once
- Avoid suggesting running large-model inference locally (2 GB RAM is not realistic)
- AtomCode model calls should go through remote APIs / CodingPlan, not local inference

4. **Keep system-level advice pragmatic:**

- Short-term: add the TLS 1.2 strong-crypto registry entries ✅ (done)
- Mid-term: upgrade to Windows 10 LTSC 2021 or Windows Server 2019+ (before October 2026)
- VM: raise memory to 4–8 GB

#### ❌ DON'T (Avoid)

1. ❌ Don't assume the system has modern TLS 1.3 / up-to-date root certificates — it doesn't
2. ❌ Don't assume PowerShell is 7+ — it's 5.1
3. ❌ Don't recommend modern tools that require .NET 4.7+ or WebView2 — they may fail
4. ❌ Don't recommend running Ollama / LLM inference locally — not enough memory
5. ❌ Don't ignore the patch backlog — solutions must account for the pre-2023 Crypto stack
6. ❌ Don't recommend upgrading to Windows 11 — LTSB 2016 + old QEMU machine don't meet the hardware requirements

### 5. "Standard Response Template" for Typical Failures

If a similar `Could not create SSL/TLS secure channel` error occurs again on this platform, the standard handling procedure is:

```powershell
# Step 1: Force TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Step 2: (if necessary) temporarily skip certificate validation — TEST environments only
⚠️ Warning: skipping certificate validation exposes you to man-in-the-middle attacks; only use on isolated test networks
Production must install the correct root certificates rather than skipping validation
[Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
Step 3: retry the original command
irm https://example.com/target-script.ps1 | iex
```

If it still fails, switch to `curl.exe`:

```powershell
curl.exe -L -o install.ps1 https://example.com/target-script.ps1
.\install.ps1
```

### 6. One-Line Summary

>
This is a QEMU VM running Windows 10 LTSB 2016 (Build 14393) with 2 GB RAM, whose TLS/Crypto stack sits at the 2016 baseline. AtomCode 5.0.0 was installed successfully by enabling TLS 1.2 strong crypto, but the platform overall faces four challenges: outdated protocol stack, tight memory, patch backlog, and approaching end of life. Every technical recommendation going forward must be grounded in this platform's real constraints — avoid "modern best practice"-style advice.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/powershell-invoke-restmethod-ssl-tls.html
