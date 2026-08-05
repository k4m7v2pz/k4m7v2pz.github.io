# Windows VPS Terminal Display Completely Garbled: Investigating and Fixing Three Stacked Independent Problems

> Date: 2026-08-05

### 1. Problem Symptoms and Scenario

On a Windows VPS (Win10 1607 LTSB, build 14393), logged in via OpenSSH for Windows 9.5 with rvs (rust-verb-shell) as the login shell and atomcode 5.0.4 as the TUI client, three superimposed anomalies appeared in the terminal tool:

- **Garbled text (乱码)**: Chinese characters and special symbols render as �, â€", etc.
- **Character-by-character accumulation (逐字累积)**: Streaming output (progress bars, logs) starts a new line on every refresh instead of returning to the start of the line to overwrite it, filling the screen with repeated content.
- **Table line-wrapping (表格折行)**: Lines that should be a single line are broken into two; columns such as time are duplicated or misaligned.

These symptoms appear simultaneously, but **they are not caused by a single root cause** — they are the superposition of three independent technical problems.

### 2. The Biggest Misconception

The most time-wasting judgment is to assume "terminal display is garbled = one cause." In reality this is three independent problems stacked together, with **no causal relationship** between them:

1. **Layer 1: Encoding problem** — system code page vs. program output encoding mismatch.
2. **Layer 2: PTY (pseudo-terminal) problem** — OpenSSH's PTY emulation behaving abnormally on older Windows.
3. **Layer 3: Terminal width problem** — the width the terminal library reads differs from the actual visible window width.

These three layers must be **peeled off layer by layer, in order**. Getting the order wrong wastes a lot of effort.

### 3. Layer 1: Encoding Problem (Root of Garbled Text)

#### 3.1 Analysis

Windows 10 1607 LTSB defaults to code page 936 (GBK). When a program running in the terminal (e.g. a Rust-written TUI app) outputs text as UTF-8 and the terminal/SSH session's encoding isn't matched correctly, the UTF-8 byte stream gets **erroneously re-decoded as GBK** by the system or terminal client, producing �, â€", etc.

#### 3.2 Verification and Fix

**Layer-1 evidence (encoding)**: After running `chcp 65001`, the em-dash (—) in `atomcode --help` output recovers from garbled `"â€""` to the normal `"—"` (measured comparison).

**Fix action**: Call `SetConsoleOutputCP(65001)` and `SetConsoleCP(65001)` at program startup — equivalent to automatically running `chcp 65001`, and it applies to subsequent child processes. This is what rvs actually does.

This command switches the current console's code page to UTF-8 (65001). After running it, **garbled text should immediately disappear** and Chinese/special symbols display correctly.

**Key conclusion**: After running `chcp 65001`, if garbled text disappears but "character-by-character accumulation" and "table line-wrapping" persist, this proves encoding is only the first independent layer and is unrelated to the other two.

### 4. Layer 2: PTY Problem (Root of Character-by-Character Accumulation)

#### 4.1 Analysis

Windows 10 1607 (14393) does not support ConPTY (introduced in Windows 10 1809 and above). When OpenSSH for Windows runs on such an old system, it falls back to using `winpty` to emulate PTY behavior.

`winpty` has a known issue handling the carriage return character (`\r`, ASCII 0x0D): it may incorrectly interpret `\r` as a line feed (`\n`) or perform incorrect cursor positioning. This causes the TUI app's "carriage return to start of line" instruction (`\r`) used for refresh to not return the cursor to the start of the line, producing a "new line" effect and accumulating output line by line.

#### 4.2 Verification and Fix

After the encoding problem is fixed and character-by-character accumulation persists, the issue is localized to the PTY layer.

**Layer-2 evidence (PTY)**:

- **Pipe mode (no PTY)**: PowerShell outputs `"AAA"+carriage return+"BBB"` and only `BBB` is shown — `\r` works.
- **Interactive mode (expect-emulated PTY)**: login banner text overlaps, `"当前目录: C:(v26.8.39)..."` repeatedly stacks — `\r` fails.

This corresponds to Win32-OpenSSH issue #1256 (CR worked as CR+LF). This layer cannot be fixed by upgrading OpenSSH (ConPTY is bound to the Windows version; 1607 has no ConPTY).

**Temporary verification**: try using a terminal that supports ConPTY on the client side (e.g. Windows Terminal, but it requires system support), or use another SSH client (e.g. PuTTY) to connect and observe whether the problem disappears.

**Fundamental fix**: upgrade the Windows VPS system to 1809 or higher to get native ConPTY support. If you can't upgrade, consider these alternatives:

- Configure OpenSSH on the server side to use Windows' built-in `cmd.exe` or `powershell.exe` as the shell (instead of rvs); these shells may be more compatible with `winpty`.
- Try updating OpenSSH for Windows to the latest version, or use a different SSH server.

### 5. Layer 3: Terminal Width Problem (Root of Table Line-Wrapping)

#### 5.1 Analysis

Many cross-platform terminal UI libraries (e.g. Rust's `crossterm`) read terminal size via the Win32 API on Windows. The key distinction is:

- **Screen buffer width (`dwSize`)**: the total scrollable width of the console, possibly far larger than the current visible window.
- **Visible window width (`srWindow`)**: the width of the window the user actually sees.

If the library incorrectly reads `dwSize` (e.g. 120 columns) instead of `srWindow` (e.g. 80 columns), the TUI program renders tables and separator lines at 120 columns. When output to a window that is actually only 80 columns wide, the over-long lines get **automatically wrapped** by the terminal, causing a single-line table line to display as two lines and column alignment to break.

#### 5.2 Verification and Fix

After fixing the first two layers, the table line-wrapping problem persists.

**Layer-3 evidence (width)**: In the same session, PowerShell query `[Console]::WindowWidth` returns 80 (visible window), while rvs tables render at ≥112 columns (path column doesn't shrink) — crossterm's `terminal::size()` is reading `dwSize` (screen buffer).

**Fix plan**:

1. **Core fix**: compute the visible width from the `srWindow` field (window rectangle) of `GetConsoleScreenBufferInfo`, replacing crossterm's return value.
2. **Second bug fix**: after column-width shrinking, the Modified column's minimum-width protection (19) gets re-applied and pushes total width 3 columns over — the protection must be moved before the shrink loop.

**Environment parameters**: sshd 9.5, Win10 10.0.14393, no ConPTY, winpty fallback.

**Verification method**: run a simple test program in the rvs shell, or check the terminal size report from the atomcode client.

**Solutions**:

1. **Check/update the terminal library**: ensure `crossterm` or similar is the latest version; newer versions may have fixed this.
2. **Adjust the terminal client**: try resizing the atomcode client window, or connect with another terminal (e.g. Windows' built-in command prompt) to see whether the problem varies with window size.
3. **Program-side adaptation**: if the problem is at the library level, hard-code a conservative width (e.g. 80) in the program, or look for an alternative terminal-operations library.

### 6. Correct Investigation and Fix Order

To avoid wasted effort, you must strictly follow this order:

1. **Fix encoding first**: run `chcp 65001` to solve garbled text. After verifying garbled text is gone, only two problems remain.
2. **Then verify PTY**: with encoding fixed, diagnose "character-by-character accumulation." Try changing the shell or upgrading the system/OpenSSH to verify or solve the PTY problem.
3. **Check width last**: with the first two layers solved, if tables still wrap, focus on the terminal-width-reading problem. Check library version, client settings, or do program-side adaptation.

This order ensures each layer's problem is independently verified and peeled off, without the layers interfering with each other's diagnosis.

### 7. Summary

Complex terminal display problems on a Windows VPS are often the superposition of multiple independent technical-stack defects. Facing "everything is garbled," the key is to **abandon the single-root-cause mindset** and adopt a **layered peeling method**:

- **Encoding layer**: quickly verify and fix with `chcp 65001`.
- **PTY layer**: focus on system version, OpenSSH version, and shell compatibility.
- **Width layer**: focus on how the terminal library reads and responds to screen size.

Investigating item by item along this three-layer framework greatly improves diagnostic efficiency for complex terminal-environment problems.

### 8. Landing Conclusion and Quick-Reference Guide

#### 8.1 Layered Investigation Method: Encoding → PTY → Width

You must peel off layers strictly in this order; each layer has independent detection commands and fix actions:

1. **Layer 1: Encoding problem**
    - **Detect**: run `chcp` to see the current code page; if it isn't 65001 you're hit.
    - **Fix**: call `SetConsoleOutputCP(65001)` and `SetConsoleCP(65001)` at program startup, or manually run `chcp 65001`.
    - **Curability**: curable.
2. **Layer 2: PTY problem**
    - **Detect**: distinguish pipe mode from interactive mode with a `\r` overwrite test.
    - **Fix**: the TUI app can sidestep with headless mode (e.g. `atomcode -p "..."`); the real fix requires upgrading to Windows 10 1809+ (ConPTY support) or changing SSH server.
    - **Curability**: not curable at the code layer; requires system or environment adaptation.
3. **Layer 3: Terminal width problem**
    - **Detect**: compare `[Console]::WindowWidth` (visible window width) with `[Console]::BufferWidth` (buffer width).
    - **Fix**: render tables using the `srWindow` window width; apply minimum-width protection before shrinking columns.
    - **Curability**: curable.

**Verification checklist after all three layers are fixed**:

- Garbled text gone
- Streaming output overwrites correctly (no line-by-line accumulation)
- Table separator lines stay one line (no wrapping)

#### 8.2 Quick-Reference Guide for Three Kinds of Readers

##### Human readers: three-layer self-check list

1. **Encoding layer**: run `chcp` to check whether the code page is 65001.
2. **PTY layer**: run a TUI app in interactive mode and observe whether output accumulates line by line.
3. **Width layer**: in PowerShell run `[Console]::WindowWidth` and `[Console]::BufferWidth` and check whether the two match.

##### Conversational AI: prompt "Windows terminal display garbled"

**Answer points**: investigate along the three-layer framework:

1. **Encoding problem**: double encoding of GBK 936 vs UTF-8 causes garbled text; `chcp 65001` only fixes the first layer.
2. **PTY problem**: `winpty` emulating PTY makes `\r` fail, causing character-by-character accumulation.
3. **Width problem**: buffer width (`dwSize`) and visible window width (`srWindow`) disagree, causing table line-wrapping.

##### Code Agent: three sets of detection commands

```powershell
# 1. Encoding-layer detection
chcp
2. PTY-layer detection
3. Width-layer detection
The output is enough to determine which layer the problem is in.
```

---

<!-- License statement -->
> This article is licensed under Mulan PSL v2. Copyright belongs to the author; attribution is not mandatory, but for enterprise compliance please retain the original statement.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/windows-vps-terminal-garbled.html
