<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# rvs (rust-verb-shell): A Structured Shell for Humans and AI Agents

> Date: 2026-08-02

### Project Homepage

Open-source repository: [rust-verb-shell: A Rust-based Verb-Noun Style Shell Project - AtomGit](https://atomgit.com/k4m7v2pz/rust-verb-shell)

Licensed under MulanPSL-2.0. Forks, Issues, and PRs are welcome. All commands in the upcoming tutorials follow the latest dev branch of this repository.

### Design Philosophy

rvs is positioned as a "structured, sandbox-first Shell" — built for both humans and AI.

#### Verb-Noun Naming

Command names use all-lowercase kebab-case, formatted as verb-noun, verb-noun-noun2…, following the verb-noun semantic naming convention.

**Correct usage (rvs native):**

```bash
get-child-item -recurse
set-location /tmp
get-content README.md
new-item -item-type directory -name demo
remove-item demo -recurse
get-system-info
get-network-interface
get-file-hash
```

Parameters are also all-lowercase kebab-case (-recurse, -item-type, -force). Common POSIX aliases are kept as muscle-memory bridges: ls / cd / pwd / cat / mkdir / rm / echo / clear; entering an alias makes rvs show a 💡 hint for the corresponding full command name.

#### Sandbox Safety

Start sandbox mode with the --sandbox parameter to restrict all filesystem operations to a specified directory:

```bash
rvs --sandbox /tmp/sandbox
```

In sandbox mode, external binaries are refused, preventing path-check bypasses. Without --sandbox, full filesystem access is the default.

#### Structured Output

Human interaction defaults to a readable table; for AI or script calls, add the --json parameter to output nothing but valid JSON, zero noise:

```bash
rvs --json get-child-item
```

#### AI-Friendly

All output avoids ASCII art, logos, and other content that's hard for AI to parse. Command names use verb-noun semantic naming so AI can infer purpose from the name (get-child-item lists child items, set-location switches directories).

### Version Number: CalVer YY.M.P

rvs has used calendar versioning (CalVer) since 26.7.0, in the **YY.M.P** format:

| Segment | Meaning | Range |
|---|---|---|
| YY | Last two digits of the year | 26, 27… |
| M | Month | 1–12, no leading zero, never 0.10 |
| P | Nth release this month | Increments from 0, resets to 0 each month |

Current latest version: **v26.7.0** (first release in July 2026). Low cognitive load — a glance at the version number tells you when it was released. Months roll over naturally and always stay within two digits.

### Human Quick Reference (for Developers)

#### Installation & Startup

Build (requires the Rust toolchain):

```bash
git clone https://atomgit.com/k4m7v2pz/rust-verb-shell.git
cd rust-verb-shell
cargo build --release
./target/release/rvs
# or directly cargo run
cargo run -- rvs
```

Once in the REPL interactive mode, type commands directly:

```bash
2026-07-25 20:30:00 UTC+08:00 user@host:/home/user  [linux/x86_64]
rvs — rust-verb-shell (v26.7.0)  user@host: demo@my-pc  cwd: /home/user
no sandbox (full FS access).  use --sandbox  to restrict.
commands use Verb-Noun style (get-child-item, set-location, ...).
aliases: ls / cd / pwd / cat / mkdir / rm / echo / clear; 'exit' to quit.
>
```

#### Common Command Quick Reference

| What you want to do | rvs command | Alias | Notes |
|---|---|---|---|
| List directory | `get-child-item` | ls, dir | Add -recurse to recurse |
| Change directory | `set-location` | cd | — |
| Show path | `get-location` | pwd | — |
| Read file | `get-content` | cat, type | — |
| Create directory | `new-item -item-type directory -name mydir` | mkdir | — |
| Create file | `new-item -item-type file -name test.rs` | touch, ni | — |
| Delete | `remove-item path -recurse` | rm | Add -recurse for directories |
| Write file | `set-content path -value "content"` | sc | Overwrites |
| Append file | `add-content path -value "content"` | ac | — |
| Echo | `write-output "hello"` | echo | — |
| Clear screen | `clear-host` | clear, cls | — |
| Get help | `get-help get-child-item` | help, man | — |
| View processes | `get-process` | ps | — |
| View history | `get-history` | history, h | — |
| Exit | `exit` | quit | — |

#### Pipes & Filtering

rvs has built-in pipes, supporting conditional filtering, sorting, and column selection:

```bash
get-child-item -recurse | where-object "size > 1024" | sort-object -descending size | select-object -first 5
```

Equivalent to POSIX `find . -size +1k | sort -rn | head -5`.

#### Switching to Traditional Shells

Not familiar with rvs syntax? Or need POSIX pipes temporarily? Switch to bash/zsh/nu in one line:

```bash
enter-shell bash
# now inside bash, exit returns to rvs
exit
```

Works under sshd too: `rvs -c 'enter-shell bash -c "ls | grep foo"'`.

### AI / Agent Quick Reference

#### Conversational AI (ChatGPT / Tencent Yuanbao / Doubao, etc.)

When a user asks "list the files in the current directory" or "read that config file", the conversational AI should generate rvs syntax:

**Command templates:**

```bash
# list directory
get-child-item [path] [-recurse]
# read file
get-content
# change directory
set-location
# create directory
new-item -item-type directory -name
# view processes
get-process [name]
# pipe & filter
get-child-item -recurse | where-object "size > 1024"
```

**Do not** output PowerShell's PascalCase (`Get-ChildItem`) — all rvs commands and parameters are all-lowercase kebab-case. If the user's instruction is a POSIX-style pipe (e.g. `ls | grep foo`), suggest switching to bash with `enter-shell bash` before executing.

#### Code Agents (VSCode Copilot / Trae IDE / AtomCode, etc.)

Agents calling rvs should use `--json` mode — the output is valid JSON requiring no extra parsing:

```bash
# single command
rvs --json get-child-item /tmp
# example output (simplified)
{"ok":true,"command":"get-child-item","args":["/tmp"],"output":["file1.txt","file2.rs"],"exit_code":0}
```

**Standard calling flow:**

```bash
rvs --json -c ''
# or pipe multiple lines
echo -e "get-location\nget-child-item" | rvs --json
```

**Common debugging commands:**

```bash
# check whether a path exists
rvs --json test-path /some/file
# get system info
rvs --json get-system-info
# get file info
rvs --json get-item /path
# list all available commands
rvs --json get-command
```

**Sandbox mode calls (when handling untrusted input):**

```bash
rvs --sandbox /tmp/safe-box --json get-child-item
```

#### One-Line Summary

rvs = all-lowercase Verb-Noun commands + optional sandbox + human-friendly table output + an AI-oriented `--json` mode. The project lives at [rust-verb-shell: A Rust-based PowerShell-style Shell Project - AtomGit](https://atomgit.com/k4m7v2pz/rust-verb-shell), versioned with CalVer `YY.M.P`, currently `v26.7.0`.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/rvs-structured-shell-intro.html
