<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Windows Terminal Ultimate Overhaul: PowerShell 7, Nushell, and Git Bash Coexistence Guide

## 1. Introduction: Why Is My Terminal Such a Mess?

When developing on Windows, we tend to accumulate a pile of shells that don't talk to each other:

- **CMD** — Ancient, but some old scripts depend on it.
- **PowerShell 5.1** — Built-in, good compatibility.
- **PowerShell 7** — Cross-platform, powerful, the modern productivity workhorse.
- **Git Bash** — For the GNU toolchain (grep, sed, awk) and SSH.
- **Nushell** — A new structured shell, replacing traditional `ls` and `find`.

The pain point: they're isolated from each other. Packages installed in Git Bash are invisible to PowerShell; variables set in PowerShell are unknown to Nushell. This article shares how to integrate these shells into a non-interfering yet interoperable efficient environment.

## 2. Baseline: Know Your Current State

| Shell | Command | Path | Status |
|-------|---------|------|--------|
| PowerShell 7 | pwsh | `C:\Program Files\PowerShell\7\pwsh.exe` | ✅ Primary |
| PowerShell 5.1 | powershell | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` | ✅ Fallback |
| Nushell | nu | `C:\Users\user\scoop\shims\nu.exe` | ✅ New favorite |
| Git Bash | bash | `C:\Program Files\Git\bin\bash.exe` | ✅ Toolchain |
| CMD | cmd | `C:\Windows\system32\cmd.exe` | ⏸️ Spare |

## 3. Core Challenge: Cross-Shell Calls and PATH Conflicts

### 3.1 Path Format Differences

- PowerShell/Nu: `C:\Users\...`
- Git Bash: `/c/Users/...`

### 3.2 Command Resolution

Running `nu` directly in Git Bash may fail because Scoop's shims directory isn't in Git Bash's PATH.

### 3.3 Solution: Wrappers and Aliases

**PowerShell 7 Profile:**
```powershell
function global:bash {
    $bashPath = "C:\Program Files\Git\bin\bash.exe"
    if (Test-Path $bashPath) {
        & $bashPath @args
    } else {
        Write-Error "Git Bash not found at $bashPath"
    }
}
```

**Nushell config.nu:**
```nu
def bash [...args: string] {
    ^"C:\Program Files\Git\bin\bash.exe" ...$args
}
```

## 4. Windows Terminal Configuration

```json
{
    "profiles": {
        "list": [
            { "name": "PowerShell 7", "commandline": "pwsh.exe" },
            { "name": "Nushell", "commandline": "nu.exe" },
            { "name": "Git Bash", "commandline": "\"C:\\Program Files\\Git\\bin\\bash.exe\" --login -i" }
        ]
    }
}
```

## 5. PATH Management Strategy

### 5.1 System-Level PATH

Add to user environment variables:
```
C:\Program Files\PowerShell\7\
C:\Users\user\scoop\shims\
C:\Program Files\Git\bin\
C:\Program Files\Git\usr\bin\
```

### 5.2 Shell-Specific Paths

**Nushell config.nu:**
```nu
$env.PATH = ($env.PATH | split row (char esep) | prepend [
    'C:\Program Files\PowerShell\7',
    'C:\Users\user\scoop\shims',
    'C:\Program Files\Git\bin',
])
```

## 6. Pitfall Memo

### Pitfall 1: Git Bash PATH Truncation
Git Bash truncates the Windows PATH on startup. Append Windows paths explicitly in `~/.bashrc`:
```bash
export PATH="$PATH:/c/Users/user/scoop/shims"
```

### Pitfall 2: Nushell PATH Is a List
`$env.PATH` in Nushell is a List type, not a string. Use `split row` and `append`/`prepend`.

### Pitfall 3: PowerShell 7 Execution Policy
Set to RemoteSigned to load your profile:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/windows-terminal-overhaul.html
