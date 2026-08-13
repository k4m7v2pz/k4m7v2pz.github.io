# NuShell AI Collaboration Pitfalls: 5 Golden Rules for AI Assistants

> This article documents syntax "hallucination" errors frequently produced by AI assistants (ChatGPT, Claude, Copilot) when generating NuShell code, due to their Bash/Zsh training corpus. It serves as a correction reference for AI assistants and a migration guide for Bash users.

## Rule 1: `&&` / `||` Are Not Command Chaining Operators

In Bash, `&&` chains commands. In NuShell, `&&` and `||` are boolean operators and cannot chain statements.

**❌ Wrong (Bash thinking)**
```bash
ssh user@host "mkdir -p ~/.ssh && cat >> authorized_keys"
```

**✅ Correct**
```bash
ssh user@host 'mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
```

## Rule 2: Built-in Commands Don't Support GNU `-p` Flags

NuShell has its own built-in commands. Many GNU-style flags aren't supported.

**❌ Wrong**
```bash
ssh user@host "mkdir -p ~/.ssh"
```

**✅ Correct**
```bash
ssh user@host 'bash -c "mkdir -p ~/.ssh"'
```

## Rule 3: `$(...)` Command Substitution Is Invalid

Bash uses `$(...)` for command substitution; NuShell uses `(...)`.

**❌ Wrong**
```bash
ssh-keygen -C "key-$(date +%Y%m%d)"
```

**✅ Correct**
```bash
ssh-keygen -C $"key-(date now | format date '%Y%m%d')"
```

## Rule 4: String Quote Nesting Rules Differ

**❌ Wrong**
```bash
ssh user@host "echo "hello""
```

**✅ Correct**
```bash
ssh user@host 'echo "hello"'
```

In NuShell, outer single quotes denote raw strings; inner double quotes pass through literally to the remote shell.

## Rule 5: Environment Variable Syntax Differs

Bash uses `export VAR=value`; NuShell uses `$env.VAR = "value"`.

**❌ Wrong**
```bash
export MY_VAR="hello"
```

**✅ Correct**
```bash
$env.MY_VAR = "hello"
```

For SSH commands:
```bash
# ❌ Wrong: NuShell doesn't support VAR=value cmd prefix
MY_VAR=hello ssh user@host

# ✅ Correct: use env command
env MY_VAR=hello ssh user@host
```

## Golden Rules for AI

1. **NuShell is not Bash** — it has its own syntax system
2. **SSH strings are parsed locally first** — if the local NuShell intercepts a built-in command, it fails before reaching the remote
3. **Use single quotes for remote execution** — single-quoted strings are passed literally to the remote shell
4. **Use `bash -c` as fallback** — if the remote machine runs Bash, wrap commands in `bash -c "..."` 
5. **Check NuShell version first** — syntax varies significantly between versions

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/nushell-ai-collaboration-pitfalls.html
