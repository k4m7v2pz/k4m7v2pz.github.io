---
title: Set Zed as the Default Editor for .bat Files
date: 2026-06-06
tags: [Zed, Windows, Editor, .bat, Registry]
description: Configure Windows 10/11 to use Zed editor for the right-click "Edit" option on .bat files
categories: os
---

# Set Zed as the Default Editor for .bat Files

## Overview

This document describes how to configure the right-click menu for `.bat` files in Windows 10 to achieve the following effects:

- **Double-click .bat file**: Keep the default behavior, execute the script using Windows Terminal
- **Right-click menu "Edit"**: Open the file using Zed editor

## Implementation Principle

### Windows File Association Mechanism

Windows manages file associations through the registry, with priority order:

```
HKCU\Software\Classes > HKLM\Software\Classes
```

The default association for `.bat` files is `batfile`, which executes `cmd.exe /c xxx.bat` when double-clicked. We only need to modify the "Edit" option in the right-click menu without affecting the default execution behavior.

## Configuration Steps

### Method 1: Use PowerShell Script (Recommended)

Create and run the following PowerShell script:

```powershell
# Set right-click "Edit" for .bat files to open with Zed
$zedPath = "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe"

# Create right-click menu "Edit" option
reg add "HKCU\Software\Classes\batfile\shell\edit" /ve /d "Edit" /f
reg add "HKCU\Software\Classes\batfile\shell\edit\command" /ve /d "`"$zedPath`" `"%1`"" /f

Write-Host "Configuration completed!"
```

### Method 2: Manually Modify the Registry

1. Open Registry Editor: `regedit`

2. Navigate to the following path:
   ```
   HKEY_CURRENT_USER\Software\Classes\batfile\shell\edit
   ```

3. Set the default value to `Edit`

4. Create a `command` subkey under `edit` and set its default value to:
   ```
   "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe" "%1"
   ```

## Verification

### Check Registry Settings

```cmd
reg query "HKCU\Software\Classes\batfile\shell\edit" /s
```

Expected output:

```
HKEY_CURRENT_USER\Software\Classes\batfile\shell\edit
    (Default)    REG_SZ    Edit

HKEY_CURRENT_USER\Software\Classes\batfile\shell\edit\command
    (Default)    REG_SZ    "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe" "%1"
```

### Test the Effect

1. **Double-click .bat file**: Should open Windows Terminal and execute the script
2. **Right-click .bat file → Edit**: Should open the file with Zed

## Notes

### UserChoice Priority Issue

If the changes don't take effect, it may be because `UserChoice` settings override your configuration. Remove it:

```powershell
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.bat\UserChoice" -Force -ErrorAction SilentlyContinue
```

### Restart File Explorer

After modifying the registry, it's recommended to restart File Explorer for changes to take effect:

```powershell
Stop-Process -Name explorer -Force
Start-Process explorer
```

### Migrate to Another Editor

If you switch to another editor later (e.g., VS Code, Notepad++, etc.), simply modify the `command` path:

```powershell
reg add "HKCU\Software\Classes\batfile\shell\edit\command" /ve /d "`"C:\Program Files\Microsoft VS Code\Code.exe`" `"%1`"" /f
```

## Common Issues

### Garbled Text in Right-Click Menu

Cause: Menu text encoding error in the registry.

Solution:

```powershell
reg delete "HKCU\Software\Classes\batfile\shell\edit" /f
reg add "HKCU\Software\Classes\batfile\shell\edit" /ve /d "Edit" /f
```

### Double-Click Behavior Changed After Modification

Cause: May have incorrectly modified the default program for `.bat` files.

Solution: Restore the default association:

```powershell
reg add "HKCU\Software\Classes\.bat" /ve /d "batfile" /f
```

## Summary

By modifying the `HKCU\Software\Classes\batfile\shell\edit` registry key, we achieved:

- Keep the default execution behavior of `.bat` files (using Windows Terminal)
- Use Zed for the right-click "Edit" option
- Configuration doesn't affect system-level settings (only affects current user)

This approach meets editing needs without breaking the normal execution functionality of scripts.