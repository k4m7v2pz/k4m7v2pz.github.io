
# 7-Zip SFX Standard Packaging Guide: Why 7zSD.sfx Is the Only Correct Installer Stub

## 1) Golden Rule (Cache this for agents and newcomers)

- **`7z.sfx` (Standard SFX) extracts only** — it does not parse `RunProgram` or execute any install workflow.
- **`7zSD.sfx` (Installer SFX) extracts + executes** — it supports `RunProgram / InstallPath / Silent / GUIMode`.

> 90% of "config not working / Extract-to dialog" issues have exactly one root cause: **the wrong stub**.

---

## 2) Selection Comparison Table

| Attribute | Standard (DO NOT USE) | **Installer (RECOMMENDED)** |
|---|---|---|
| Filename | `7z.sfx` | **`7zSD.sfx`** |
| Typical Size | ~38 KB | ~120–160 KB |
| Capability | Extract only | Extract + Execute |
| `RunProgram` | ❌ Ignored | ✅ Supported |
| Typical Symptom | **Always** shows "Extract to…" dialog | Can run silently or with GUI per config |

---

## 3) Minimal Correct Config File (UTF-8 **without BOM**)

```ini
;!@Install@!UTF-8!
Title="Internet Cafe Customizer"
InstallPath=".\\ "
RunProgram="scripts\\batch\\sfx_entry.bat"
;!@InstallEnd@!
```

Key constraints:

- `InstallPath=".\\ "`: Extract to the **same directory as the EXE** (SFX uses its own path as base)
- `RunProgram` path: relative to the extraction root
- Config file **must** be **UTF-8 without BOM** (BOM causes parse failure)

---

## 4) Standard Build (PowerShell, deterministic)

```powershell
$stub    = "tools\7z\7zSD.sfx"
$cfg     = "configs\sfx_config.txt"
$archive = "build\temp.7z"
$outExe  = "dist\installer.exe"

# 1) Create 7z archive
& "tools\7z\7za.exe" a -t7z $archive (Join-Path PWD payload) -mx=9

# 2) Binary concatenation: stub + config + 7z
[byte[]]$bin =
  [IO.File]::ReadAllBytes($stub) +
  [IO.File]::ReadAllBytes($cfg) +
  [IO.File]::ReadAllBytes($archive)

[IO.File]::WriteAllBytes($outExe, $bin)
Write-Host "Built: $outExe"
```

> Do not rely on `copy /b`'s implicit encoding behavior; PowerShell concatenation is auditable and reproducible.

---

## 5) 30-Second Self-Check

Use this minimal config:

```ini
;!@Install@!UTF-8!
RunProgram="cmd.exe"
;!@InstallEnd@!
```

After building, double-click:

- **CMD window opens** → Installer stub ✅
- **"Extract to" dialog appears** → You used `7z.sfx` — switch to `7zSD.sfx` ❌

---

## 6) Quick Troubleshooting Matrix

| Symptom | Root Cause | Fix |
|---|---|---|
| Always shows Extract-to | Stub = `7z.sfx` | Replace with official `7zSD.sfx` |
| RunProgram appears ignored | Same as above (stub doesn't process install params) | Same fix |
| Double-click does nothing | Stub is non-official, corrupted, or wrong architecture | Use `7zSD.sfx` from 7-Zip install dir or LZMA SDK `bin\` |
| Extracted OK but script can't find files | Working directory / relative path mismatch | Add `cd /d "%~dp0"` at top of bat; verify archive paths |

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/7zip-sfx-stub-selection.html
