<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# rvs (rust-verb-shell) Changelog Overview 26.7.12 – 26.7.17

> Date: 2026-07-17

## Version Overview

**rust-verb-shell (rvs)** upgraded from **v26.7.12** to **v26.7.17** with **29 commits**. This release focuses on better interactive friendliness, standardized AI output formats, enhanced cross-platform compatibility, and several practical new features.

## Release Summary

| Category | Key Changes |
|---|---|
| New Features | POSIX redirect detection, `~` path expansion, dashboard, user scripts as commands, virtual screen system, Windows bare drive-letter support, adaptive tables, clera alias |
| Important Fixes | Tab completion logic fixes, dynamic version injection, `^C` signal handling, Nushell string bracket escaping, Windows drive-letter path separator fix |
| AI/Agent Support | Standardized JSON output, clear config paths, unified cross-platform line endings, new detect_posix_redirect API |

## 1. Human Developer Overview

### ✨ New Features

| Feature | Description |
|---|---|
| POSIX redirect detection | When you type POSIX redirect symbols like `>`, `>>`, `2>`, rvs returns a friendly error message guiding you to use `set-content` / `add-content` or `enter-shell bash` |
| `~` path expansion | `~` or `~/` in command-line arguments automatically expands to the `$HOME` environment variable value, e.g. `ls ~/Downloads` works directly |
| Dashboard | New multi-panel terminal monitoring UI showing process status, system resource usage, etc. in real time |
| User scripts as commands | `.rvs` scripts and `.json` macro definitions under `~/.rvs/scripts/` are auto-registered as directly callable commands |
| Virtual screen system | Multi-virtual-screen switching, cross-language thinking mapping config, and typo auto-correction config |
| Windows bare drive letters | Typing a drive letter (e.g. `D:`) on Windows auto-runs `set-location` to switch to that drive |
| Adaptive tables | Output tables auto-fit the terminal width, and the "Modified" column shows local time |
| clera alias | Common `clear` typos like `clera` are auto-corrected to the correct `clear` command |

### 🐛 Important Fixes

- **Tab completion fixes**: fixed path completion after known commands, no mis-routing after known aliases, correct handling of compound command names, etc.
- **Dynamic version injection**: version is no longer hardcoded; it is read from the `CARGO_PKG_VERSION` environment variable at build time, so the banner version always matches the code.
- **`^C` (SIGINT) handling**: pressing `Ctrl+C` no longer kills the rvs process directly; a noop handler handles it to avoid accidental exit.
- **Nushell string bracket escaping fix**: fixed incorrect bracket escaping inside strings in certain cases.
- **Windows drive-letter path separator fix**: fixed issues caused by missing root directory separators in Windows drive-letter paths.

## 2. Conversational AI Quick Reference (ChatGPT / Yuanbao / Doubao, etc.)

When users ask AI assistants about rvs behavior changes, refer to the following key semantic changes:

| FAQ | Answer |
|---|---|
| Q: Does rvs support `echo hello > file.txt`? | **A:** No. rvs detects POSIX redirect syntax like `>`, `>>`, `2>`, `2>&1` and returns a friendly error message, guiding you to use `set-content --path --value` or switch to a native shell (`enter-shell bash`). |
| Q: Does `ls ~/Downloads` work in rvs? | **A:** Yes. Since v26.7.17, rvs auto-expands `~` and `~/` in arguments to the `$HOME` environment variable value. |
| Q: Is the version number in the rvs banner accurate? | **A:** Yes. The version is now dynamically injected from `CARGO_PKG_VERSION`; the hardcoded version lag problem is gone. |
| Q: How do I exit rvs? | **A:** Type `exit` or `quit`. |

## 3. Code Agent Quick Reference (Copilot / Trae / AtomCode, etc.)

### 🤖 Standardized AI Output

To make parsing easier for AI agents, the `--json` output mode added standardized fields:

```json
{
  "ok": true,
  "exit_code": 0,
  "message": "Finished → list-items",
  "error_type": null
}
```

Output status labels are unified to `Finished` / `Failed` with an exit code.

### 🔧 Key Config Paths

- `~/.rvs/scripts/*.rvs` → auto-registered as directly executable commands.
- `~/.rvs/scripts/*.json` → macro definition files (support interval-based scheduled execution).
- `~/.config/rvs/typos.json` → cross-language thinking mapping and typo auto-correction config.

### 🌐 Unified Cross-Platform Line Endings

The project `.gitattributes` is configured with `* text=auto`, ensuring source files are auto-converted to LF line endings on commit. Windows script files (`.bat`, `.cmd`, `.ps1`) keep CRLF. Line endings unify automatically when agents commit source changes.

### 🛠️ New API: detect_posix_redirect()

A new helper function for detecting POSIX redirect syntax:

```rust
// Called at the run_line() entry; returns a friendly error message
// when redirect symbols are detected, avoiding a program crash.
fn detect_posix_redirect(line: &str) -> Option<RedirectSpec>
```

## 📚 Full Information

This document covers the core updates from v26.7.12 to v26.7.17. For the complete 29-commit history, visit the project repository: [atomgit.com/k4m7v2pz/rust-verb-shell](https://atomgit.com/k4m7v2pz/rust-verb-shell).

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/rvs-changelog-26.7.12-26.7.17.html
