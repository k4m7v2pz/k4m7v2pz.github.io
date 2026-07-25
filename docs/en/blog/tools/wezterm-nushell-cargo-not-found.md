---
title: WezTerm + Nushell + Cargo Command Not Found
date: 2026-07-06
tags: [nushell, wezterm, cargo, macOS, PATH, shell-config]
description: Troubleshooting cargo not found in WezTerm new tabs launching Nushell on macOS Apple Silicon — root causes include nushell not sourcing ~/.cargo/env, wrong default config directory, and string interpolation differences
categories: tools
---

**Summary:** This article documents troubleshooting `cargo` not found in new WezTerm tabs running Nushell on macOS (Apple Silicon). Core issues include nushell not sourcing `~/.cargo/env`, the default config directory not being `~/.config/nushell/`, and string interpolation syntax differences.

## 1. Symptoms

Running `cargo run` in a new WezTerm tab with nushell:

```
~/Documents/Code.localized/ra2md> cargo run
Error: nu::shell::external_command
  × External command failed
   ╭─[repl_entry #3:1:1]
 1 │ cargo run
   · ──┬──
   ·   ╰── Command `cargo` not found
   ╰────
  help: `cargo` is neither a Nushell built-in or a known external command
```

Each time, manually sourcing `~/.config/nushell/env.nu` would temporarily fix it, but a new tab would break again.

## 2. Root Causes (Three Issues Stacking)

### 2.1 Nushell Doesn't Source `~/.cargo/env`

When rustup is installed, it writes a **shell script** to `~/.cargo/env` (a `case ":${PATH}:"…esac` block) that can only be sourced by bash/zsh and other POSIX shells. Nushell's syntax is different — **it cannot and will not** source this file. So while `source "$HOME/.cargo/env"` in `~/.zshrc` works for zsh, nushell does nothing on startup — cargo never makes it into `PATH`.

### 2.2 Nushell's Default Config Directory Isn't `~/.config/nushell/`

This is the biggest trap. Following XDG conventions, many people (myself included) modify `~/.config/nushell/env.nu`, only to find **their changes have no effect**. Nushell 0.113 on macOS uses:

```
~/Library/Application Support/nushell/
```

Not `~/.config/nushell/`. Verify with:

```nu
echo $nu.default-config-dir
echo $nu.env-path          # ~/Library/Application Support/nushell/env.nu
echo $nu.config-path       # ~/Library/Application Support/nushell/config.nu
```

I had correctly added `path add "~/.cargo/bin"` in `~/.config/nushell/env.nu`, and sourcing it worked — but when WezTerm launched nushell, it loaded the file from the default path instead. **Editing the wrong file** is the core of this pitfall.

### 2.3 Nushell String Interpolation Differs from Bash

While initially editing `~/.config/nushell/env.nu`, I also hit a syntax issue. The original attempt:

```nu
$env.PATH = ($env.PATH | prepend "$env.HOME/.cargo/bin")
```

In nushell, **double-quoted strings do NOT interpolate variables**. `"$env.HOME/.cargo/bin"` is treated as a literal string `$env.HOME/.cargo/bin`, adding a nonexistent directory to PATH. The correct syntax uses `$"..."` string interpolation with `(...)` subexpressions:

```nu
$env.PATH = ($env.PATH | prepend $"($env.HOME)/.cargo/bin")
```

Or better yet — use nushell's built-in `path add` utility (from `std/util`), which auto-expands `~`:

```nu
use std/util "path add"
path add "~/.cargo/bin"
```

## 3. Fix

Edit the file that is actually loaded: `~/Library/Application Support/nushell/env.nu`, and add `path add "~/.cargo/bin"`. Full change:

```nu
# env.nu
# Always make ~/.local/bin visible (where atomcode lives), even when the
# terminal was started as a non-login shell and ~/.zshrc never ran.
use std/util "path add"
path add "~/.local/bin"
# cargo / rustup binaries — nushell doesn't auto-source ~/.cargo/env (it's an sh script)
path add "~/.cargo/bin"
```

Verification:

```bash
which cargo
# → /Users/<user>/.cargo/bin/cargo
cargo run
```

New WezTerm tabs work without manual sourcing.

## 4. Summary

| Pitfall | Key Point |
|---|---|
| Nushell doesn't inherit `~/.cargo/env` | It's an sh script; you must add `path add "~/.cargo/bin"` yourself |
| Editing `~/.config/nushell/` has no effect | On macOS, nushell reads from `~/Library/Application Support/nushell/` |
| `"$env.HOME/..."` is literal | Nushell double quotes don't interpolate; use `$"($env.HOME)/..."` |
| WezTerm new tab loses cargo again | Not a WezTerm issue — nushell wasn't loading the correct env.nu |

## 5. References

- Nushell configuration docs: [Configuration | Nushell](https://www.nushell.sh/book/configuration.html)
- Nushell string interpolation: <https://www.nushell.sh/language/_strings.html>
- rustup file `~/.cargo/env`: POSIX shell only
- Nushell `std/util` module: `use std/util "path add"` provides the `path add` command

---

<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/wezterm-nushell-cargo-not-found.html
