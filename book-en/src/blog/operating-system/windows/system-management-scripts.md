<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# System Management Script Archive

A collection of PowerShell scripts for Windows system management, covering file associations, context menu cleanup, and default application settings.

## 1. .bat Association (Double-Click to Run, Right-Click to Edit with Zed)

`scripts/powershell/set-bat-assoc.ps1`

```powershell
$zedPath = "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe"

# Preserve double-click execution
Set-ItemProperty -Path "HKCU:\Software\Classes\.bat" -Name "(default)" -Value "batfile" -Force

# Add right-click "Edit with Zed" menu item
$editPath = "HKCU:\Software\Classes\batfile\shell\EditWithZed"
New-Item -Path $editPath -Force | Out-Null
Set-ItemProperty -Path $editPath -Name "(default)" -Value "Edit with Zed" -Force

$commandPath = "$editPath\command"
New-Item -Path $commandPath -Force | Out-Null
Set-ItemProperty -Path $commandPath -Name "(default)" -Value "`"$zedPath`" `"%1`"" -Force

# Clear UserChoice cache (required)
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.bat\UserChoice" -Recurse -Force -ErrorAction SilentlyContinue

# Refresh Explorer
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## 2. Force Default App (.bat + .txt)

`scripts/powershell/set-zed-defaults-full.ps1`

```powershell
$zedPath = "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe"

function Set-FileAssociation {
    param($ext, $progId)
    Set-ItemProperty -Path "HKCU:\Software\Classes\.$ext" -Name "(default)" -Value $progId -Force
    Set-ItemProperty -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Name "(default)" -Value "`"$zedPath`" `"%1`"" -Force
    Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.$ext\UserChoice" -Recurse -Force -ErrorAction SilentlyContinue
}

Set-FileAssociation -ext "txt" -progId "Zed.txt"
Set-FileAssociation -ext "bat" -progId "Zed.bat"
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## 3. Clean Up Context Menu

`scripts/powershell/clean-bat-menu.ps1`

```powershell
$unwanted = @(
    "HKCU:\Software\Classes\batfile\shell\opennew",
    "HKCU:\Software\Classes\batfile\shell\runas"
)
foreach ($path in $unwanted) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force
    }
}
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## Usage Notes

- Run PowerShell as Administrator
- Set execution policy: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Modify `$zedPath` to match your Zed installation path
- Registry modifications carry risk — back up before editing

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/system-management-scripts.html
