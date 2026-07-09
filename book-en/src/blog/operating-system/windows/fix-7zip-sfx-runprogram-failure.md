
# Fix 7-Zip SFX RunProgram Failure: Correct Stub Selection and Diagnostic Matrix

## 1) Typical Error Description

- "I wrote `RunProgram`, but double-click only shows **Extract to**."
- "`Silent=2` / `GUIMode=2` are written but have no effect."
- "Double-click does **nothing** — no window at all."

---

## 2) The Single Most Important Cause

**`7z.sfx` (Standard SFX) does not implement the install execution pipeline.**
When the stub is `7z.sfx`, the following fields are effectively non-existent:

- `RunProgram`
- `ExecuteFile`
- `InstallPath` (not processed as installer semantics)
- `Silent / GUIMode / OverwriteMode`

You will always see the "plain extractor UI".

---

## 3) Diagnostic Matrix

| Symptom | Check Immediately | Conclusion |
|---|---|---|
| Always shows "Extract to…" | Stub filename/size (should be `7zSD.sfx` ~120–160KB) | Wrong stub → Replace |
| Double-click, no window, no error | Is stub official `7zSD.sfx`? | Unofficial/corrupted → Use LZMA SDK or 7-Zip official `bin\` |
| Extracted but script doesn't run | Does the file exist in archive? Case sensitivity? bat working directory? | Use `cd /d "%~dp0"` + verify relative path |
| "Parameters seem无效" | Config file encoding | **Must be UTF-8 without BOM** (BOM degrades parsing) |

---

## 4) Verify Config File Encoding (PowerShell)

```powershell
$b = [IO.File]::ReadAllBytes("configs\sfx_config.txt")
if ($b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
  Write-Warning "BOM detected — save as UTF-8 without signature"
} else { Write-Host "No BOM (OK)" }
```

---

## 5) Minimal Fix Steps (in order)

1. Obtain **official** `7zSD.sfx` (from 7-Zip installation `bin\7zSD.sfx` or LZMA SDK)
2. Ensure config = **UTF-8 without BOM**
3. Use **PowerShell concatenation** (don't trust `copy /b` magic)
4. Use the "cmd.exe self-check" below to confirm the stub is correct

---

## 6) Self-Check Stub (Diagnostic Anchor)

```ini
;!@Install@!UTF-8!
RunProgram="cmd.exe"
;!@InstallEnd@!
```

- **CMD opens** → Stub OK
- **Extract to dialog** → Stub WRONG (Standard edition)
