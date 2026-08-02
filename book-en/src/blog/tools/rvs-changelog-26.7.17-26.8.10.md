# rvs (rust-verb-shell) Changelog Overview 26.7.17 – 26.8.10

> Date: 2026-08-02

### 1. New Core Capabilities

#### 1. .rvs Script Control Flow Support (26.7.20)

Previously, rvs scripts executed line by line, linearly. This round introduces an AST parser + executor (parser.rs / executor.rs under crates/rvs-repl), so scripts now support four control-flow constructs: for / if / while / block, with chained variable scoping (entering a for/block pushes a scope layer, exiting pops one).

This is a qualitative leap for batch ops scripts — where you previously had to split things into multiple commands and stitch them by hand, now you can write loops and branch on conditions.

#### 2. Automatic Local Proxy Port Reporting (26.8.9 / 26.8.10)

Targeting the pain point of "an agent operating remotely needs to know the machine has a proxy":

- A new `~/.config/rvs/proxy.json` declaration file; rvs uses netstat to verify the actual listening state of ports and only reports ports that are "declared AND currently listening".
- Results go to two places:
  - The human REPL banner shows "proxy: 127.0.0.1:7890 (http/socks) [lan]";
  - The `session.proxy` field of `--json` output is automatically carried in every response, so agents don't need to be fed manually.
- 26.8.10 upgraded host to a hosts address array, supporting IPv4 / IPv6 / mDNS / hosts domain names, IPv6 auto-wrapped in square brackets, and backward-compatible with the old single-value host format.

### 2. Table Output Overhaul (ls Readability Rework)

26.7.18-19 focused on reworking the "Human size column" of listing tables, aiming for compact, scannable, and decimal-free:

- **Column alignment**: Human/Bytes/Size right-aligned, digits and units aligned in separate columns.
- **Compact format**: no decimals, no extra whitespace, starting at 1KiB (<1KiB shows empty to avoid noise).
- **Binary-step rounding**: rounds to the nearest 1/2/4/8/16/32/64/128/256/512 step, e.g. 1.03KiB displays as "> 1KiB".
- **Direction markers**: evolved through +/- → ⬆️/⬇️ emoji → ↑/↓ → finally settled on > / < prefixes (e.g. "> 1KiB", "< 32KiB") — compact and free of emoji dependency.
- **Unit extension**: extended up to EiB/ZiB/YiB (2^80), so huge files still display.
- **Color**: only the direction markers in the Human column are colored (default red ↑ / green ↓), customizable via `~/.config/rvs/colors.json`.

Also:

- ls table column layout adjusted (Path first, IsDir uses Y/N, duplicate Name column removed).
- Header i18n (the Chinese header "是否为目录" is no longer truncated by column width).
- Command names unified to verb-noun (legacy PowerShell names such as Get-ChildItem kept only as aliases).

### 3. Interaction & Engineering Improvements

- **Clean stdout passthrough in non-interactive mode**: when passing args via ssh / piping / redirecting, metadata goes to stderr while stdout passes the command output through untouched, fixing binary streams (scp/sftp/tar-pipe) being polluted by rvs wrapper output.
- **Physical tty downgrade**: physical terminals with TERM=linux automatically downgrade to English + ASCII symbols (💡→* etc.) to avoid garbled output.
- **Banner shows NIC IPs**: the startup banner lists non-loopback NICs and IPs (en0=192.168.1.5/24), alongside the proxy line, giving agents addressing info for LAN operations.
- **Single-quoted literals**: exec/ssh remote commands support single-quoted full literals (no $ variable expansion), complementing double quotes (which allow && || chaining).
- **Small improvements**: `clear-host` alias (tolerates the "claer" typo), ssh alias delivered, POSIX redirection detection and ~ expansion.

### 4. Cross-Machine Deployment & Quick Reference for Three Reader Types

#### Deployment

rvs has been deployed to four machines — `<lan-host>` / LAN printer / Ubuntu VPS / remote Windows — and the default shell was switched to rvs on all of them (usermod + /etc/shells on Linux, OpenSSH DefaultShell registry on Windows). Unified verb-noun syntax + `--json` output across machines; no more shell dialect differences.

#### Human Developers

- Keep using POSIX muscle-memory aliases like `ls`, `cd`, `cat` in the REPL as usual;
- `show-version` shows the version at a glance;
- `list-items --chat-llm` outputs a plain-text listing meant for conversational AI;
- `enter-shell bash` temporarily returns to POSIX.

#### Conversational AI (ChatGPT/Yuanbao/Doubao)

- Paste the output of `list-items --llm` for an instant project-structure view;
- rvs table/plain-text output is directly consumable by LLMs — no secondhand re-telling needed.

#### Code Agents

- `rvs --json -c ''` for structured output;
- The `session.proxy` field automatically reports the local proxy (e.g. Mac's 7890 http/socks, LAN-capable), letting agents route remote requests through `http://<LAN-IP>:7890`;
- `exec  ""` to execute across machines;
- `search-content` as a grep replacement.
