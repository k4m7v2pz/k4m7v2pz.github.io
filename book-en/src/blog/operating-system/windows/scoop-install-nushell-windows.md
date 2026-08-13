<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Installing Nushell on Windows via Scoop: Complete Guide

## 1. Environment Baseline

Before installing Nushell, ensure your system meets these requirements:

- **OS**: Windows 10 or Windows 11 (22H2+)
- **Existing Shell**: Git Bash (MINGW64)
- **Target Shell**: Nushell 0.113.1
- **Package Manager**: Scoop
- **Network**: Local proxy (e.g., 127.0.0.1:PORT)

## 2. Installation Steps

### 2.1 Install Scoop

In Git Bash, configure the proxy and run:

```powershell
powershell.exe -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
powershell.exe -Command "Invoke-RestMethod get.scoop.sh | Invoke-Expression"
```

### 2.2 Install Nushell

```bash
scoop install nu
```

## 3. Key Paths

| Item | Path |
|------|------|
| Scoop root | `C:\Users\YourUserName\scoop\` |
| Nu binary | `C:\Users\YourUserName\scoop\shims\nu.exe` |
| Nu config | `C:\Users\YourUserName\AppData\Roaming\nushell\config.nu` |

## 4. Common Pitfalls

### Pitfall 1: Shell Syntax Confusion
Don't write PowerShell syntax (`$env:...`) in Git Bash. Use `powershell.exe -Command` to invoke PowerShell commands from Git Bash.

### Pitfall 2: Proxy Not Working
Scoop relies on .NET's WebRequest, which doesn't read environment variables. Set both:

```powershell
$proxy = New-Object System.Net.WebProxy('http://127.0.0.1:7897')
[System.Net.WebRequest]::DefaultWebProxy = $proxy
$env:HTTP_PROXY = 'http://127.0.0.1:7897'
```

### Pitfall 3: Wrong Config File Path
On Windows, Nushell config is at `%APPDATA%\nushell\config.nu`, not `~/.config/nushell/`. Use `echo $nu.config-path` to confirm.

### Pitfall 4: Slow Download
Use a proxy and ensure the .NET proxy is also configured (see Pitfall 2).

## 5. Verification

```bash
nu --version
# Should output: 0.113.1 or similar
```

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/scoop-install-nushell-windows.html
