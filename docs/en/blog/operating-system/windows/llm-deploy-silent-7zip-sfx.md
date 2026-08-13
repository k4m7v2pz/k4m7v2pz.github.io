---
title: "LLM/CI Deployment Guide: Building Silent 7-Zip SFX Installers (No Dialogs)"
date: 2026-06-03
tags: [7-Zip, SFX, silent-install, Windows, Automation, CI, LLM]
description: "Reproducible steps: select the correct 7zSD.sfx stub, write a BOM-free config, use PowerShell to concatenate a single-file EXE, and run a minimal self-check to prevent regression to Extract-to behavior."
---

# LLM/CI Deployment Guide: Building Silent 7-Zip SFX Installers (No Dialogs)

## 1) Input/Output Contract

- **Stub (fixed)**: `tools/7z/7zSD.sfx` (installer type, ~128KB)
- **Config**: `configs/sfx_config.txt` (UTF-8 **without BOM**)
- **Payload**: Packaged into `temp.7z` (**must** be 7z, not zip)
- **Output**: `dist/deploy.exe` (double-click = extract + execute)

---

## 2) Config (Fully Silent Template)

```ini
;!@Install@!UTF-8!
Title="Silent Deploy"
InstallPath=".\\ "
GUIMode="2"
Silent="2"
OverwriteMode="2"
RunProgram="setup.bat"
;!@InstallEnd@!
```

Notes:

- `GUIMode="2"` + `Silent` suppress all UI
- `InstallPath=".\\ "` → extract to EXE's directory
- `setup.bat` must exist inside the archive and use `%~dp0` to locate itself

---

## 3) Build Script (Agent/CI reproducible)

```powershell
param(
  [string]$Stub    = "tools\7z\7zSD.sfx",
  [string]$Cfg     = "configs\sfx_config.txt",
  [string]$Archive = "build\temp.7z",
  [string]$Out     = "dist\deploy.exe"
)

[byte[]]$bin =
  [IO.File]::ReadAllBytes($Stub) +
  [IO.File]::ReadAllBytes($Cfg) +
  [IO.File]::ReadAllBytes($Archive)

[IO.File]::WriteAllBytes($Out, $bin)
Write-Host "Built: $Out"
```

---

## 4) Validation Protocol (CI-checkable)

- **PE header sanity**: stub must start with `MZ`
- **Stub size sanity**: `7zSD.sfx` is typically 100–200KB
- **Runtime smoke test**: use `RunProgram=cmd.exe` to verify it doesn't regress to Extract-to

---

## 5) Constraints (Avoid Hallucination)

- **The internal archive MUST be 7z** (`-t7z`), not zip
- Windows Explorer will **not** treat it as a zip; but 7-Zip/WinRAR can unpack it
- For "right-click extract" behavior, distribute a **zip portable package** instead — don't try to disguise SFX as zip

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/llm-deploy-silent-7zip-sfx.html
