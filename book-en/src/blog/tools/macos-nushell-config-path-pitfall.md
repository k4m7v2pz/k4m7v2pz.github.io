<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# macOS Nushell Config Path Pitfall: Root Cause Analysis of Disappearing Custom Functions

> **One-liner summary:** On macOS, nushell reads its configuration from `~/Library/Application Support/nushell/config.nu`, **not** `~/.config/nushell/config.nu`. Editing the wrong file makes your custom functions "look updated but revert on new terminal tabs."

## 1. Background

I use nushell as my daily shell on macOS, with a custom Rust project called `creeper`. I wrote a nushell custom function `def creeper [...args: string] { ... }` in config.nu that automatically runs `cargo build --release --features gui` then executes the binary.

## 2. Symptom: Config Changes Don't Persist

After modifying `~/.config/nushell/config.nu`:

- `source ~/.config/nushell/config.nu` in the current tab → works fine
- **Opening a new tab** → the old function definition returns

## 3. Root Cause: Wrong Config Path on macOS

nushell's config path follows the OS convention:

| OS | Config Path |
|----|-------------|
| Linux (XDG) | `~/.config/nushell/config.nu` |
| macOS (Apple) | `~/Library/Application Support/nushell/config.nu` |
| Windows | `%APPDATA%\nushell\config.nu` |

On macOS, nushell reads `~/Library/Application Support/nushell/config.nu` on startup. Editing `~/.config/nushell/config.nu` has no effect on new terminals.

**Verify:**
```bash
echo $nu.config-path
# macOS: ~/Library/Application Support/nushell/config.nu
```

## 4. Why Did `source` Work?

`source` explicitly loads a file regardless of the default config path. It temporarily applied the changes to the current session, but new sessions still read the default path.

## 5. Fix Options

### Option 1: Edit the Correct File
Edit `~/Library/Application Support/nushell/config.nu` directly.

### Option 2: Source from the Correct File
Add this line to `~/Library/Application Support/nushell/config.nu`:
```
source ~/.config/nushell/config.nu
```

### Option 3: Always Use `$nu.config-path`
Before editing config, confirm the path:
```bash
echo $nu.config-path | path expand
```

## 6. Lesson

- macOS is not Linux — don't apply Linux directory conventions to macOS
- `$nu.config-path` is the authoritative source for config file location
- Cross-platform tools have different default paths on different OSes
- Always verify the config path on first setup

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/macos-nushell-config-path-pitfall.html
