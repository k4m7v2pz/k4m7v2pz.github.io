# Windows 终端环境终极改造：PowerShell 7、Nushell、Git Bash 并存指南

## 一、前言：为什么我的终端这么乱？

在 Windows 上做开发，我们往往会积累一堆 Shell，它们各自为政，互不相通：

- **CMD**：古老，但某些老脚本离不开。
- **PowerShell 5.1**：系统内置，兼容性好。
- **PowerShell 7**：跨平台，性能强，是现代开发的主力生产力工具。
- **Git Bash**：为了那一套 GNU 工具链（grep, sed, awk）和 SSH。
- **Nushell**：新兴的结构化 Shell，用来替代传统的 ls 和 find。

痛点在于：它们之间互相"隔阂"。在 Git Bash 里装的包，PowerShell 找不到；在 PowerShell 里设置的变量，Nushell 不认识。本文将分享如何将这些 Shell 整合成一套互不干扰、又能互相打通的高效环境。

## 二、环境基线：先理清现状

在开始改造前，首先要明确系统中存在的 Shell 及其路径。混乱往往源于路径不明确。

| Shell | 命令 | 路径 | 现状 |
|-------|------|------|------|
| PowerShell 7 | pwsh | `C:\Program Files\PowerShell\7\pwsh.exe` | ✅ 主力 |
| PowerShell 5.1 | powershell | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` | ✅ 保底 |
| Nushell | nu | `C:\Users\user\scoop\shims\nu.exe` | ✅ 新宠 |
| Git Bash | bash | `C:\Program Files\Git\bin\bash.exe` | ✅ 工具链 |
| CMD | cmd | `C:\Windows\system32\cmd.exe` | ⏸️ 备用 |

## 三、核心难点：跨 Shell 调用与 PATH 冲突

最大的坑在于跨 Shell 调用。例如，在 Nushell 里调用 Git Bash 的命令，或者在 PowerShell 里启动 Nushell。

### 1. 路径格式的差异

- PowerShell/Nu: `C:\Users\...`
- Git Bash: `/c/Users/...`

### 2. 命令查找机制

如果在 Git Bash 里直接敲 `nu`，它可能找不到，因为 Scoop 的 shims 目录没进 Git Bash 的 PATH。

### 3. 解决方案：封装与 Alias

为了保证在任何地方都能敲 `bash` 就能进 Git Bash，在 PowerShell 和 Nushell 中做了封装。

**PowerShell 7 配置 (Microsoft.PowerShell_profile.ps1)：**

```powershell
# 全局函数，确保在任何目录下都能调用 Git Bash
function global:bash {
    $bashPath = "C:\Program Files\Git\bin\bash.exe"
    if (Test-Path $bashPath) {
        & $bashPath @args
    } else {
        Write-Error "Git Bash not found at $bashPath"
    }
}
```

**Nushell 配置 (config.nu)：**

```nu
# 封装 Git Bash 调用
def bash [...args: string] {
    ^"C:\Program Files\Git\bin\bash.exe" ...$args
}
```

## 四、Windows Terminal 配置：统一启动入口

Windows Terminal 是统一管理多个 Shell 的最佳工具，通过 `settings.json` 配置：

```json
{
    "profiles": {
        "list": [
            {
                "name": "PowerShell 7",
                "commandline": "pwsh.exe",
                "icon": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
                "startingDirectory": "."
            },
            {
                "name": "Nushell",
                "commandline": "nu.exe",
                "icon": "C:\\Users\\user\\scoop\\shims\\nu.exe",
                "startingDirectory": "."
            },
            {
                "name": "Git Bash",
                "commandline": "\"C:\\Program Files\\Git\\bin\\bash.exe\" --login -i",
                "icon": "C:\\Program Files\\Git\\mingw64\\share\\git\\git-for-windows.ico",
                "startingDirectory": "."
            }
        ]
    }
}
```

## 五、PATH 统一管理策略

### 5.1 系统级 PATH（用户变量）

确保所有 Shell 的基础路径在系统级 PATH 中统一。编辑用户环境变量，添加：

```
C:\Program Files\PowerShell\7\
C:\Users\user\scoop\shims\
C:\Program Files\Git\bin\
C:\Program Files\Git\usr\bin\
```

### 5.2 Shell 专有路径

各 Shell 特有的路径在各自的 profile 中追加，不要污染系统级 PATH。

**PowerShell 7 - Microsoft.PowerShell_profile.ps1：**

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','User')
$env:Path += ";$env:LocalAppData\Microsoft\WindowsApps"
```

**Nushell - config.nu：**

```nu
$env.PATH = ($env.PATH | split row (char esep) | prepend [
    'C:\Program Files\PowerShell\7',
    'C:\Users\user\scoop\shims',
    'C:\Program Files\Git\bin',
])
```

## 六、最终效果

改造完成后，可以实现：

- 在 Windows Terminal 中一键切换 PowerShell 7 / Nushell / Git Bash
- 在任何 Shell 中敲 `bash` 即可进入 Git Bash 环境
- 在任何 Shell 中敲 `nu` 即可进入 Nushell
- 各 Shell 的 PATH 互不污染，但基础命令互通
- 跨 Shell 调用时路径格式自动适配

## 七、踩坑备忘

### 坑 1：Git Bash 的 PATH 截断

Git Bash 启动时默认会截断 Windows 系统 PATH，只保留 `/usr/bin` 等 Unix 路径。解决方案是在 `~/.bashrc` 中显式追加 Windows PATH：

```bash
export PATH="$PATH:/c/Users/user/scoop/shims"
```

### 坑 2：Nushell 的 PATH 是列表不是字符串

Nushell 的 `$env.PATH` 是 List 类型，不是字符串。不能用 `$env:PATH += ";"` 这种方式，必须用 `split row` 和 `append` / `prepend` 操作。

### 坑 3：PowerShell 7 的执行策略

PowerShell 7 默认执行策略是 Restricted，需要设为 RemoteSigned 才能加载 profile：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```