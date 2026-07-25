---
title: WezTerm + Nushell + Cargo 找不到命令踩坑记录
date: 2026-07-06
tags: [nushell, wezterm, cargo, macOS, PATH, shell-config]
description: 记录在 macOS Apple Silicon 环境下 WezTerm 新标签页启动 Nushell 后找不到 cargo 命令的排查与修复过程，核心坑点包括 nushell 不自动 source ~/.cargo/env、默认配置目录错误及字符串插值语法差异
categories: tools
---

**摘要：** 本文记录了在 macOS（Apple Silicon）环境下，wezterm 新标签页启动 nushell 后无法找到 `cargo` 命令的排查与修复过程。核心坑点包括 nushell 不自动 source `~/.cargo/env`、默认配置目录不是 `~/.config/nushell/` 以及字符串插值语法差异。

## 1. 症状

在 wezterm 新开的 nushell 标签页里直接跑 `cargo run`：

```
~/Documents/Code.localized/ra2md> cargo run
Error: nu::shell::external_command
  × External command failed
   ╭─[repl_entry #3:1:1]
 1 │ cargo run
   · ──┬──
   ·   ╰── Command `cargo` not found
   ╰────
  help: `cargo` is neither a Nushell built-in or a known external command
```

每次都得手动 `source ~/.config/nushell/env.nu`（或类似文件）后才能用，新标签页里又失效。

## 2. 根因（三条叠加）

### 2.1 nushell 不自动 source `~/.cargo/env`

rustup 安装时往 `~/.cargo/env` 写的是一段 **sh 脚本**（`case ":${PATH}:"…esac`），只能被 bash/zsh 等 POSIX shell `source` 加载。nushell 语法不同，**不会也不能**去 source 这个文件。所以 `~/.zshrc` 里 `source "$HOME/.cargo/env"` 在 zsh 下有效，但 nushell 启动时什么也不做——cargo 路径根本没进 `PATH`。

### 2.2 nushell 的「默认 config 目录」不是 `~/.config/nushell/`

这是最大的坑。按照 XDG 习惯很多人（包括我）会去改 `~/.config/nushell/env.nu`，**改完发现根本没生效**。nushell 0.113 在 macOS 上的默认 config 目录是：

```
~/Library/Application Support/nushell/
```

不是 `~/.config/nushell/`。可以用下面命令核实：

```nu
echo $nu.default-config-dir
echo $nu.env-path          # ~/Library/Application Support/nushell/env.nu
echo $nu.config-path       # ~/Library/Application Support/nushell/config.nu
```

我曾在 `~/.config/nushell/env.nu` 里加了正确的 `path add "~/.cargo/bin"`，source 之后能跑——但 wezterm 启动 nushell 时加载的是默认路径那份文件，所以新标签页里永远看不到 cargo。**改错文件**是这个坑的核心。

### 2.3 nushell 字符串插值语法与 bash 不同

早期修 `~/.config/nushell/env.nu` 时还踩了一个语法坑。原本写的是：

```nu
$env.PATH = ($env.PATH | prepend "$env.HOME/.cargo/bin")
```

在 nushell 里，**双引号字符串不做变量插值**。`"$env.HOME/.cargo/bin"` 会被当作字面字符串 `$env.HOME/.cargo/bin`，加进 PATH 后是个不存在的目录，cargo 当然还是找不到。正确写法用 `$"..."` 字符串插值 + `(...)` 子表达式：

```nu
$env.PATH = ($env.PATH | prepend $"($env.HOME)/.cargo/bin")
```

或者更省事——用 nushell 自带的 `path add` 工具（来自 `std/util`），它会自动展开 `~`：

```nu
use std/util "path add"
path add "~/.cargo/bin"
```

## 3. 修复

改真正被加载的那个文件：`~/Library/Application Support/nushell/env.nu`，加上一行 `path add "~/.cargo/bin"`。完整改动：

```nu
# env.nu
# Always make ~/.local/bin visible (where atomcode lives), even when the
# terminal was started as a non-login shell and ~/.zshrc never ran.
use std/util "path add"
path add "~/.local/bin"
# cargo / rustup binaries — nushell 不自动 source ~/.cargo/env (那是 sh 脚本)
path add "~/.cargo/bin"
```

验证：

```bash
which cargo
# → /Users/<user>/.cargo/bin/cargo
cargo run
```

新开 wezterm 标签页无需再 source。

## 4. 总结

| 坑 | 关键点 |
|---|---|
| nushell 不继承 `~/.cargo/env` | 那是 sh 脚本，必须自己加 `path add "~/.cargo/bin"` |
| 改了 `~/.config/nushell/` 不生效 | macOS 上 nushell 默认读 `~/Library/Application Support/nushell/` |
| `"$env.HOME/..."` 字面化 | nushell 双引号不做插值，要用 `$"($env.HOME)/..."` |
| wezterm 新标签页 cargo 又没了 | 不是 wezterm 的问题，是 nushell 启动时没加载到改对的那份 env.nu |

## 5. 参考

- nushell 配置文档：[Configuration | Nushell](https://www.nushell.sh/book/configuration.html)
- nushell 字符串插值：<https://www.nushell.sh/language/_strings.html>
- rustup 文件 `~/.cargo/env`：仅 POSIX shell 可用
- nushell `std/util` 模块：`use std/util "path add"` 提供 `path add` 命令

---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/wezterm-nushell-cargo-not-found.html
