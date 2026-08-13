<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# From PowerShell to Nushell: Solving Cross-Platform Config Loading Slowdown

## Preface: The Cost of Cross-Platform

As a full-stack developer, I've always sought the perfect cross-platform shell. PowerShell 7 (PWSH) was my first choice — it runs seamlessly on both Windows and macOS. My goal was simple: one config, everywhere.

On macOS, I packed years of accumulated aliases, functions, and environment variables into `Microsoft.PowerShell_profile.ps1`. This file grew bloated over time, containing hundreds of lines of custom functions and business logic. The problem: **slow startup**. On my Mac, opening PWSH took several seconds — an embarrassing pause with a blinking cursor.

I eventually migrated my primary shell to Nushell (nu). Not just for speed, but for a fundamentally different data interaction paradigm.

## 1. Why Leave PowerShell 7?

1. **Startup performance bottleneck** — PWSH's just-in-time parsing and compilation of large profiles causes multi-second delays on macOS.
2. **Verbose data processing** — `Select-Object`, `Where-Object` syntax is overly verbose for everyday command-line use.

## 2. Nushell: Everything Is Data

Nushell treats all output as structured data — `ls` produces a table, not text. This paradigm shift is a game-changer. Plus, Nushell's startup speed is dramatically faster, thanks to lazy loading and modular configuration.

## 3. Migration Strategy

### 3.1 Phase 1: Dual Shells
Keep both shells, using Nushell only for data exploration while learning its syntax.

### 3.2 Phase 2: Nushell for Interaction, PWSH for System Tasks
Use Nushell as the primary shell, calling `^pwsh` for system administration.

### 3.3 Phase 3: Full Migration
Move custom functions to Nushell's module system. Keep PowerShell as a backup.

## 4. Nushell Config Optimization

### 4.1 Modular Configuration

```nu
# env.nu
$env.EDITOR = "zed"
$env.PATH = ($env.PATH | split row (char esep) | prepend [
    "~/.cargo/bin",
    "~/scoop/shims",
])
```

### 4.2 Lazy Loading

```nu
def --wrapped nvim [...args] {
    ^nvim ...$args
}
```

## 5. Cross-Platform Config Handling

```nu
if ($nu.os-info.name == "windows") {
    source ~/.config/nushell/env-windows.nu
} else if ($nu.os-info.name == "macos") {
    source ~/.config/nushell/env-macos.nu
}
```

## 6. Performance Comparison

| Scenario | PowerShell 7 | Nushell |
|----------|-------------|---------|
| Cold start | 2-3 seconds | 0.2-0.5 seconds |
| Warm start | 1-2 seconds | 0.1-0.2 seconds |
| 100-line config | 1-2 seconds | 0.1-0.3 seconds |
| 10MB JSON | 0.5-1 seconds | 0.3-0.5 seconds |

## 7. Summary

Key benefits of migrating from PowerShell 7 to Nushell:

- **10x faster startup:** from 2-3 seconds to 0.2 seconds
- **Intuitive data processing:** structured data pipelines
- **Better cross-platform consistency:** identical experience on macOS and Windows
- **Modular configuration:** load on demand, no bloat

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/powershell-to-nushell-migration.html
