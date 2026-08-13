<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 从 PowerShell 到 Nushell：解决跨平台配置加载慢的终极方案

## 前言：跨平台的代价

作为一名全栈开发者，我一直在寻找完美的跨平台 Shell。PowerShell 7 (PWSH) 曾是我的首选，毕竟它是微软亲儿子，Windows 和 macOS 都能无缝运行。我的初衷很简单：一套配置，到处运行。

在 macOS 上，我将多年的积累——各种别名、函数、环境变量——全部塞进了 `Microsoft.PowerShell_profile.ps1`。这个文件随着时间推移变得臃肿不堪，包含了上百行自定义函数和业务逻辑。然而，问题随之而来：启动慢。在 Mac 上每次打开 PWSH，都需要等待数秒。那是一个令人尴尬的停顿，光标闪烁，仿佛 Shell 在艰难地消化那数百行代码。

最终，我决定将主力 Shell 迁移到 Nushell (nu)。这不仅是为了速度，更是为了一种全新的数据交互方式。

## 一、为什么离开 PowerShell 7？

PWSH 很强大，特别是对于 .NET 生态。但在实际使用中，遇到了两个难以逾越的障碍：

1. **启动性能瓶颈**：PWSH 在加载包含大量函数定义的 Profile 时，采用的是即时解析和编译。在 Windows 上尚可，但在 macOS 的资源限制下，几秒钟的启动延迟严重打断了心流。
2. **数据处理的"笨重"**：虽然 PWSH 是面向对象的，但在日常的命令行交互中，处理 JSON、CSV 或简单的文本过滤，其语法（`Select-Object`、`Where-Object`）显得过于冗长。

## 二、初识 Nushell：一切皆数据

Nushell 的设计哲学是结构化数据。它不再把 `ls` 的输出当作一堆文本，而是看作一张表格（Table）。这种理念上的降维打击，让我瞬间沦陷。

更重要的是，Nushell 的启动速度极快。它采用了不同的解析机制，配合懒加载（Lazy Loading）和模块化的配置思路，完美解决了在 Mac 上遇到的痛点。

## 三、迁移策略：逐步替换而非一刀切

### 3.1 第一阶段：双 Shell 并行

在迁移初期，同时保留 PowerShell 和 Nushell。PowerShell 用于日常开发，Nushell 仅用于数据探索。这个阶段的目标是熟悉 Nushell 的语法和心智模型。

### 3.2 第二阶段：Nushell 处理数据，PWSH 管系统

将 Nushell 作为主要交互 Shell，但仍然在 Nushell 中通过 `^pwsh` 调用 PowerShell 处理系统管理任务（如 Windows 注册表操作、COM 对象调用等）。

### 3.3 第三阶段：全面迁移

将大部分自定义函数迁移到 Nushell 的模块系统中。PowerShell 只保留作为"备用 Shell"。

## 四、Nushell 配置优化

### 4.1 模块化配置

将配置拆分为多个模块，按需加载：

```nu
# env.nu - 环境变量
$env.EDITOR = "zed"
$env.PATH = ($env.PATH | split row (char esep) | prepend [
    "~/.cargo/bin",
    "~/scoop/shims",
])

# alias.nu - 别名
alias ll = ls -l
alias grep = rg
alias find = fd

# completions.nu - 补全
source ~/.config/nushell/completions/git-completions.nu
```

### 4.2 懒加载

对于启动慢的外部工具，使用懒加载：

```nu
# 不立即加载，使用时才加载
def --wrapped nvim [...args] {
    ^nvim ...$args
}
```

## 五、Windows 与 macOS 的配置差异处理

### 5.1 条件判断

```nu
if ($nu.os-info.name == "windows") {
    source ~/.config/nushell/env-windows.nu
} else if ($nu.os-info.name == "macos") {
    source ~/.config/nushell/env-macos.nu
}
```

### 5.2 路径处理

```nu
# 跨平台路径
let config_dir = if ($nu.os-info.name == "windows") {
    $env.APPDATA
} else {
    $"($env.HOME)/.config"
}
```

## 六、性能对比

| 场景 | PowerShell 7 | Nushell |
|------|-------------|---------|
| 冷启动（首次加载） | 2-3 秒 | 0.2-0.5 秒 |
| 热启动（已有缓存） | 1-2 秒 | 0.1-0.2 秒 |
| 加载 100 行配置 | 1-2 秒 | 0.1-0.3 秒 |
| 处理 10MB JSON | 0.5-1 秒 | 0.3-0.5 秒 |

## 七、总结

从 PowerShell 7 迁移到 Nushell 的主要收益：

- **启动速度提升 10 倍**：从 2-3 秒降到 0.2 秒
- **数据处理更直观**：结构化数据管道操作
- **跨平台一致性更好**：macOS 和 Windows 上体验一致
- **模块化配置**：按需加载，不再臃肿

如果你也在为 PowerShell 的启动速度烦恼，且主要工作是数据处理和开发而非系统管理，Nushell 是一个值得尝试的替代方案。
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/powershell-to-nushell-migration.html
