<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Fixing SSH-into-Windows Character-by-Character Output Accumulation: \r Carriage Return Treated as Newline, winpty with Win10 1607 and No ConPTY

> Date: 2026-08-05

### 1. Reproducing the Scene: The Eerie Character-by-Character Accumulation

The environment: a Windows VPS running Win10 1607 LTSB (build 14393), with OpenSSH for Windows 9.5 installed, sshd.exe at `C:\Program Files\OpenSSH`, login shell set to `rvs` (rust-verb-shell). After SSH-ing in from wezterm on a Mac, everything looked normal — until I ran an interactive TUI program (atomcode in this example), at which point the picture changed.

Imagine: you ask the AI a question, and normally the screen should echo a single line that keeps refreshing with the answer. But here, the AI's reply is like an old typewriter constantly churning out new lines — "你", "你好", "你好，", "你好，我", "你好，我是"… each refresh adds another line to the screen instead of returning to the start of the line to overwrite the previous text. When scrolling, there is no "carriage-return-to-start-of-line redraw" effect at all. Worse, the login banner and command tables also show overlapping, misaligned text, making the whole terminal interface dizzying to look at.

This phenomenon is the "character-by-character accumulation" problem this article investigates. It looks like a simple display bug, but underneath it touches terminal rendering, the PTY pseudo-terminal, and some subtle behavioral differences on the Windows platform.

### 2. Tracing the Fallacy: Three Common Misjudgments

When you hit this kind of problem, intuition tends to lead you in a few directions. Let's first look at which paths are dead ends, so you don't take the detour too.

#### Misjudgment 1: Encoding problem

The first thing that catches the eye is usually garbled text. Because the system code page defaults to 936 (GBK), UTF-8 characters get double-encoded in transit, filling the screen with unreadable characters. The first reaction is of course to run `chcp 65001` to switch to the UTF-8 code page. The garbled text does disappear — but the character-by-character accumulation doesn't budge.

**Conclusion: encoding problem ruled out.** If the phenomenon persists after garbled text is fixed, don't waste time on encoding.

#### Misjudgment 2: Terminal problem

The second easy suspect is the client-side terminal emulator. After all, wezterm has complex configuration — maybe it's not parsing ANSI escape sequences correctly, or not handling `\r` (carriage return to start of line) correctly? But verification is simple: start the same TUI program locally, everything is perfect, and `\r`'s return-to-start-of-line effect works completely normally. The terminal side is not at fault.

**Conclusion: terminal problem ruled out.** The same program rendering correctly locally shows the client's ANSI parsing is sound.

#### Misjudgment 3: Program problem

If the terminal isn't the problem, is it the TUI program atomcode itself that has a rendering bug on Windows? To verify this, I used a key comparison: running the same program non-interactively.

Command: `ssh host 'command'` (no PTY allocated, i.e. pipe mode). In this mode the program's output flows back to the client directly through a pipe, without going through the pseudo-terminal layer. The result? The output is perfect, no accumulation, and `\r`'s carriage-return overwrite effect works completely normally.

This directly states a key fact: **the program's own rendering logic is not the problem**. Same program, normal in pipe mode (no PTY), abnormal in interactive mode (with PTY) — the problem is locked to the PTY layer.

### 3. Hitting the Crux: What the PTY Layer Is Doing in the Middle

PTY (Pseudo Terminal) is a key component of an SSH interactive session. Its job is to build a virtual terminal link between the server-side process (your shell or program) and the client, handling terminal control characters, window-size changes, signal handling, and so on.

Normally, when a TUI program outputs `\r` (carriage return, ASCII 13), the PTY should forward it as-is to the client; the terminal then moves the cursor back to the start of the line, and subsequent content overwrites the current line — this is the "in-place refresh" effect. But if the PTY layer transforms `\r` in some way — say turning it into `\n` (line feed), or dropping it under some combination of conditions — then every refresh of the TUI program starts from a new line, and character-by-character accumulation appears.

On the Windows platform this problem is even more subtle. There is a fundamental difference between the Win32 console API and POSIX terminal behavior. When OpenSSH for Windows implements PTY, it has to bridge these two. In Windows' console mode, characters output to the console go through conhost.exe processing; but characters forwarded through PTY bypass this layer. OpenSSH internally uses ConPTY (the Windows pseudo-terminal API) to emulate Unix-style terminal behavior, but under certain versions or configurations, the handling rules for specific control characters may not be fully consistent with a standard Unix PTY.

A detail worth noting: in the scenario where `rvs` (rust-verb-shell) is the login shell, the shell's own handling of input/output also interacts with the PTY layer. If the PTY's terminal-mode flags (termios flags) aren't set correctly — for example if the mapping direction of `ONLCR` (map newline to carriage-return + newline) is the opposite of what's expected — control characters can get accidentally transformed.

### 4. Solution Path: From Workaround to Root Fix

#### 4.1 Quick Workaround: Force PTY Allocation and Set Terminal Type

If you just want the current interactive session back to normal, try explicitly specifying the terminal type on the SSH client side:

```bash
ssh -t -o "SendEnv TERM" host
```

In the server-side shell config file (e.g. `.bashrc` or `.profile`), make sure:

```bash
export TERM=xterm-256color
```

This combination makes OpenSSH use the standard terminal-capability database when allocating the PTY, improving the correctness of control-character handling.

#### 4.2 More Thorough Mitigation: Adjust OpenSSH Configuration

In the server-side `sshd_config` (usually at `C:\ProgramData\ssh\sshd_config`), you can try the following configuration:

```bash
# Force PTY allocation
PermitTTY yes
Accept terminal type sent by client
AcceptEnv TERM
Disable compression or delays that might interfere with control characters
TCPKeepAlive yes
UseDNS no
```

After modifying, restart the sshd service (`Restart-Service sshd` or via the service manager). These configurations can ensure PTY-allocation consistency and correct passing of the terminal type, reducing the chance of control characters being mishandled.

#### 4.3 Source-Level Verification and Root-Cause Localization: winpty's CR/LF Handling Defect

After further source-level verification, the root cause is more specific than the initially-guessed "ConPTY compatibility boundary" — this machine has no ConPTY at all, OpenSSH falls back to winpty, and winpty has a deterministic defect in its handling of `\r`.

**Verification 1: pipe mode vs. interactive mode `\r` behavior comparison.** In pipe mode (`ssh` without `-t`, no PTY allocated), PowerShell outputs "AAA", carriage return, "BBB" in sequence, and the result shows only "BBB" — `\r` correctly returns to the start of the line and overwrites. In interactive mode (PTY allocated), the login banner's text repeatedly stacks, with overlapping phenomena like "当前目录: C:(v26.8.39) 用户@主机: administrator@..." — `\r` fails, content is appended rather than overwritten. Same program, same terminal, with-or-without PTY becomes the only variable, directly locking the problem to the PTY layer.

**Verification 2: expect-emulated PTY stable reproduction.** Using expect's `spawn ssh` to capture interactive output, both banner and prompt show overlap. This rules out "intermittent" or "specific-client behavior" and confirms the problem is a deterministic system-level defect.

**Verification 3: root-cause localization — [Win32-OpenSSH issue #1256](https://github.com/PowerShell/Win32-OpenSSH/issues/1256).** The official issue explicitly describes the defect: `\r` is treated as a newline ("CR worked as CR+LF, LF are ignored"). The key constraint is: ConPTY (Windows pseudo-console) was introduced only in Win10 1809 (build 17763); this machine runs Win10 1607 LTSB (build 14393) and has no ConPTY. OpenSSH therefore falls back to winpty to emulate PTY, and winpty has the above defect in CR/LF handling. The official answer explicitly states: the ConPTY version is bound to the Windows version and cannot be resolved by upgrading OpenSSH ("we can't service that one").

Based on the above root cause, here are a few practically feasible directions:

- **Upgrade Windows version to 1809+**: this is the fundamental solution. With native ConPTY support, the handling of control characters like `\r` will conform to the standard and no longer depend on the winpty fallback.
- **Use msys2 or Cygwin's SSH server**: they use an independent Unix-style PTY implementation that doesn't depend on winpty/ConPTY and handles control characters more standardly. This is a more thorough mitigation without upgrading the system.
- **Switch login shell for comparison verification**: you can temporarily switch to `cmd` or `powershell` as the login shell to confirm whether `rvs` has additional interaction problems with winpty. Note, however, that this can only narrow the problem's scope and cannot fix winpty's own CR/LF defect.

### 5. Summary

The core takeaway from this troubleshooting is a verification logic: when the interactive-mode TUI is abnormal but pipe mode is normal, the problem is not in the program's own rendering logic but in the PTY layer. Through cross-comparison (same program / PTY vs. pipe / Windows vs. Linux), you can quickly narrow the problem domain.

For SSH users on the Windows platform, it's worth remembering: although Windows' terminal infrastructure (ConPTY) has made great progress, in precise handling of control characters there are still subtle gaps versus mature Unix PTYs. When you encounter weird phenomena like `\r` not carriage-returning, backspace not deleting characters, or ANSI escape sequences being shown as literal text, don't rush to suspect the program — look at what's happening in the PTY layer, and you'll often save a lot of time.

### 6. Landing Conclusion

**1. Root-cause characterization:** `\r` failure is a CR/LF handling defect of OpenSSH using winpty to emulate PTY on old Windows (1607) without ConPTY; it is unrelated to encoding, terminal, or program rendering.

**2. Impact scope:** only interactive (PTY) sessions are affected; pipe/non-interactive sessions are normal.

**3. Workaround:** the TUI program switches to headless mode (e.g. `atomcode -p "你的问题"`); the output doesn't go through `\r` redraw, and in testing it's completely normal.

**4. Root-fix path:** upgrade to Windows 10 1809 or above (to get ConPTY), or switch to an SSH server with its own PTY implementation (e.g. Bitvise).

### 7. Quick Reference for Three Kinds of Readers

#### Human

Two-step self-check:

1. `ssh host '命令'` — execute via pipe and see if it's normal;
2. Run the same command interactively and see whether output accumulates character by character. If it accumulates, you're hit — work around it with headless mode.

#### Conversational AI

Prompt "what causes character-by-character accumulation of interactive terminal output when SSH-ing into Windows" — answer points: OpenSSH + old Windows (no ConPTY), the winpty PTY layer treats `\r` as a newline; it's not an encoding problem. Work around with headless; the root fix needs ConPTY (Win10 1809+).

#### Code Agent

Two verification commands you can run directly:

PowerShell `\r` test: `[Console]::Write("AAA"); [Console]::Write([char]13); [Console]::Write("BBB")` — normally only BBB is shown; if it fails, output accumulates.

expect reproduction: `spawn ssh host` then `send "命令\r"` — overlapping output means PTY `\r` has failed.

---

<!-- License statement -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright belongs to the author; attribution is required, but for enterprise compliance please retain the original statement.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/windows/ssh-windows-output-buffering.html
