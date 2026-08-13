<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# rvs (rust-verb-shell) Iteration Overview 26.7.0 – 26.7.12

> Date: 2026-07-12

This article covers what changed as rvs iterated from v26.7.0 to v26.7.12. All commands refer to the latest dev branch.

## 1. Two Design-Philosophy Corrections First

### 1.1 Breaking Away from PowerShell's New-Item Approach

rvs initially copied PowerShell's `New-Item`: one command with a `--type` parameter creating both files and directories. It sounded unified but was actually a trap:

```bash
new-item --path foo              # default --type file, creates file foo
new-item --path bar --type dir   # creates directory bar
```

The problem: the `mkdir` alias also pointed to `new-item`, and `new-item` defaults to `--type file`. So `mkdir demo` actually created a **file** named `demo`, not a directory — a silent, infuriating error.

The new version splits `new-item` into commands with clear semantics:

| Command | Alias | Description |
|---|---|---|
| `new-directory` | `mkdir` | Creates directories only; `--parents` (default true) controls recursion |
| `new-file` | `touch` / `ni` | Creates files only; `--value` provides initial content |

```bash
new-directory --path demo           # creates directory demo
mkdir demo                          # alias, equivalent
new-file --path test.rs             # creates empty file
touch test.rs --value "fn main(){}" # creates file with initial content
```

This split also leaves room for the future: `new-softlink`, `new-hardlink` can be added the same way without stacking more conditions on `--type`.

### 1.2 Verb-Noun in User-Visible Text Changed to verb-noun

The old banner said "commands use Verb-Noun style", contradicting rvs's own "all-lowercase kebab-case" design principle — if command names are lowercase like `get-child-item`, the hint text should not show PascalCase `Verb-Noun`.

The new version unifies to lowercase:

```
rvs — rust-verb-shell (v26.7.12)
no sandbox (full FS access).  use --sandbox  to restrict.
commands use verb-noun style (get-child-item, set-location, ...).
aliases: ls / cd / pwd / cat / mkdir / rm / echo / clear; 'exit' to quit.
```

It's a small thing, but it rests on a principle: examples in documentation must match exactly what the tool accepts, otherwise both AI and humans get misled.

## 2. Borrowing from ripgrep: search-content Rewrite

rvs's early `search-content` (aliases `sc` / `grep`) was a minimal viable version: a hand-written `collect_files` recursive walk, hardcoded to skip `.git` / `target` / `node_modules`, single-threaded search. It worked, but had two problems:

- Noise directories were hardcoded; they stopped matching in a different project
- It ignored `.gitignore`; one search could sweep hundreds of MB of build artifacts in `target/debug/`

The new version swaps in ripgrep's own `ignore` crate for directory traversal, plus `rayon` for multi-file parallelism. All of ripgrep's "four-layer default filtering" is in place:

- Respects `.gitignore` / `.ignore` / `.git/info/exclude` / global gitignore
- Skips hidden files by default (leading `.`)
- Skips binary files by default (heuristic NUL-byte detection)
- Does not follow symlinks

### Progressive Filtering Off (rg -u / -uu / -uuu)

ripgrep users know the `-u` stacking: `-u` turns off ignore, `-uu` adds hidden, `-uuu` equals `grep -r`. rvs's argument parser does not support `-u` stacking, so explicit switches map to it:

| rg form | rvs form | Semantics |
|---|---|---|
| `rg pat` | `sc --pattern pat` | default four-layer filtering |
| `rg -u pat` | `sc --pattern pat --no-ignore` | turn off .gitignore |
| `rg -uu pat` | `sc --pattern pat --no-ignore --hidden` | plus hidden files |
| `rg -uuu pat` | `sc --pattern pat --no-ignore --hidden --binary` | plus binaries |

`-u` is the short alias for `--no-ignore`, easy to remember.

## 3. Context Lines and Multi-File Parallelism

### Context Lines (--context N / --before N / --after N)

When an agent finds a match, it usually needs surrounding context to judge "is this what I'm looking for". The new version adds context lines; the output Table gains `Before` and `After` fields:

```bash
sc --pattern "pub struct" --path crates --include *.rs --context 1
```

`--context N` gives N lines both before and after; `--before N` / `--after N` control each side separately.

### Multi-File Parallelism

`rayon`'s `par_iter` searches multiple files in parallel. `--max-results` uses an `AtomicUsize` counter across threads, stopping early once the cap is hit. Single-file searches stay sequential to avoid thread overhead on small inputs.

## 4. get-version: rvs Self-Observability

This command came from a debugging session: source and locale were both changed, but new wezterm tabs still showed the old banner. It took several commands to figure out — the **old binary was never recompiled**, and rvs had no mechanism for an agent to see at a glance "which binary is running now".

The new version adds `get-version` (aliases `ver` / `version`), answering via build-time info injected by `build.rs`:

```bash
rvs --json -c 'get-version'
```

Output (simplified):

```json
{
  "Version": "26.7.12",
  "BuildTime": "2026-07-25T14:56:08Z",
  "GitCommit": "11e70c4",
  "GitDirty": "dirty",
  "BuildHost": "macos aarch64",
  "Profile": "debug"
}
```

The debugging decision tree becomes very short:

1. Run `get-version`, look at `BuildTime`
2. Compare against the source mtime
3. Source newer than BuildTime → old binary, need `cargo build`

`GitDirty` additionally tells you the binary was built from a workspace with uncommitted changes, letting agents judge whether the binary can be trusted.

## 5. get-child-item --llm: Respect .gitignore, Feed Conversational LLMs

A common scenario: you're in wezterm and want to ask ChatGPT/Claude/Yuanbao "what is this project roughly", and the natural approach is copying the current directory's file listing into the chat. But `ls` output is long and noisy — table borders, `target/`, `node_modules/`, hidden files all mixed together; pasting hundreds of lines makes the LLM dig signals out of noise.

The new version adds the `--llm` mode (`get-child-item --llm`, alias `ls --llm`) specifically for this:

```bash
rvs -c 'get-child-item --llm --path crates/rvs-commands'
```

Output:

```
[F] Cargo.toml
[F] build.rs
[D] src/
[F] src/lib.rs
```

`[D]` is directory, `[F]` is file, relative paths, one entry per line, no table borders. Under the hood it uses `ignore::WalkBuilder`, respecting `.gitignore` by default and skipping noise directories like `target/` / `node_modules/`.

The workflow becomes: `ls --llm` → select all, copy → paste into chat. The LLM gets a clean project structure view.

## 6. wezterm-rvs.sh: Bilingual Progress Hints During Compilation

This is an experience improvement for wezterm users. The old launcher script only compiled when the "binary did not exist", which caused the silent-stale problem above — source changed, but new tabs still ran the old binary.

The new strategy:

1. Every launch runs `cargo build --dry-run` to detect whether a rebuild is needed
2. When needed, first print bilingual progress hints to stdout (directly visible in wezterm, avoiding a black-screen freeze):
   ```
   rvs: source changed, rebuilding binary before launch…
   rvs：检测到代码更改，正在编译以获取最新二进制…
   ```
3. Print "launching" after compilation completes
4. On compile failure, print `[ERR]` + stderr and exit

`cargo build --dry-run` itself is fast (<0.5s); it skips directly when nothing changed; when something changed it hints first, then compiles — so both humans and agents know what is happening.

## 7. Quick Reference for Three Reader Groups

### Human Developers (wezterm / terminal)

| What you want to do | rvs command | Alias |
|---|---|---|
| List directory | `get-child-item` | `ls` |
| List directory (for LLM) | `get-child-item --llm` | `ls --llm` |
| Create directory | `new-directory --path demo` | `mkdir demo` |
| Create file | `new-file --path test.rs` | `touch test.rs` |
| Search code (ripgrep style) | `search-content --pattern foo` | `sc --pattern foo` / `grep foo` |
| Search code with context | `sc --pattern foo --context 3` | — |
| Search ignoring ignore rules | `sc --pattern foo --no-ignore` | `sc -u foo` |
| Show rvs version | `get-version` | `ver` / `version` |
| Switch to bash | `enter-shell bash` | — |

### Conversational AI (ChatGPT / Tencent Yuanbao / Doubao, etc.)

When a user describes a file-operation intent, conversational AI should generate rvs all-lowercase verb-noun commands — not PowerShell PascalCase (`Get-ChildItem`), not POSIX (`ls`); the latter are only aliases, and the rvs native form is `get-child-item`.

Command templates (v26.7.12+):

```bash
# List directory
get-child-item [path] [-recurse]

# List directory respecting .gitignore (for conversational LLMs)
get-child-item --llm [path]

# Read file
get-content <path>

# Create directory / file (note: new-item is split)
new-directory --path <path>
new-file --path <path>

# Search code (ripgrep style)
search-content --pattern <pat> [--path <path>] [--regex] [--include *.rs]
              [--no-ignore] [--hidden] [--binary]
              [--context N] [--before N] [--after N]

# Show rvs version (first debugging action)
get-version
```

If the user's instruction is POSIX-style piping (like `ls | grep foo`), suggest `enter-shell bash` to switch to bash, or use rvs-native `get-child-item | where-object "..."`.

### Code Agents (VSCode Copilot / Trae IDE / AtomCode, etc.)

Agents calling rvs should use `--json` mode; output is valid JSON, no extra parsing needed:

```bash
# Single command
rvs --json -c 'get-child-item --llm'

# Pipe multiple lines
echo -e "get-location\nget-version" | rvs --json
```

First action when rvs misbehaves:

1. Run `rvs --json -c 'get-version'`, check `BuildTime` / `GitCommit` / `Profile`
2. Compare against source mtime:
   - Source newer than `BuildTime` → old binary, run `cargo build`
   - `BuildTime` ≥ source mtime → binary is current; the problem is elsewhere

String search (grep replacement): when an agent wants to search code in rvs, do not jump out via `enter-shell bash` to use grep. Use rvs-native `search-content` (aliases `sc` / `grep`). It works inside the sandbox, and `--json` outputs a Table `{Path, Line, Content, Before?, After?}` that agents consume directly.

## 8. One-Sentence Summary

rvs v26.7.12 = ripgrep-inspired search (ignore + rayon + `-u` progressive + `--context`) + self-observability (`get-version` injecting BuildTime/GitCommit/BuildHost/Profile) + `--llm` output respecting `.gitignore` to feed conversational LLMs + `new-item` split into `new-directory` / `new-file` fixing the `mkdir`-creates-a-file bug. The project lives at [atomgit.com/k4m7v2pz/rust-verb-shell](https://atomgit.com/k4m7v2pz/rust-verb-shell); versioning is CalVer YY.M.P, currently v26.7.12.

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/rvs-iteration-26.7.0-26.7.12.html
