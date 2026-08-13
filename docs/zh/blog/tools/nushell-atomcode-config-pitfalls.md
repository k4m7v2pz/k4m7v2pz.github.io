---
title: Nushell + AtomCode 配置踩坑记录
date: 2026-07-07
tags: [nushell, atomcode, macOS, shell-config, PATH]
description: 记录在 macOS 上配置 Nushell 0.113.1 与 AtomCode 时遇到的 5 个典型坑，包括配置目录路径错误、验证方式误区、PATH 继承问题、配置项名称混淆以及默认值覆盖问题
categories: tools
---

<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

**摘要：** 本文记录了在 macOS 上配置 Nushell 0.113.1 与 AtomCode 时遇到的 5 个典型坑，包括配置目录路径错误、验证方式误区、PATH 继承问题、配置项名称混淆以及默认值覆盖问题，并给出最终生效配置。

## 1. 背景

日期：2026-07-07

环境：macOS，Nushell 0.113.1（Homebrew），`nu` 在 `/opt/homebrew/bin/nu`

目标：① nushell 里能用 `atomcode` 命令；② 启动不显示 welcome message；③ 行末不显示时间

## 2. 坑 1：nushell 实际加载的配置目录不是 `~/.config/nushell/`

### 2.1 现象

在 `~/.config/nushell/env.nu` 里写 `$env.PROMPT_COMMAND_RIGHT = {|| "" }`，毫无效果——行末时间照旧显示。

### 2.2 真相

macOS 上 nushell 0.113 加载的默认配置目录是：

```
~/Library/Application Support/nushell/
```

**不是** `~/.config/nushell/`（后者是 Linux 的路径）。确认当前实际加载目录：

```nu
nu
$nu.default-config-dir
# => /Users/<user>/Library/Application Support/nushell
```

`~/.config/nushell/` 里那两个文件根本没被加载，写了等于白写。

### 2.3 修复

所有改动都放到 `~/Library/Application Support/nushell/` 下的 `env.nu` / `config.nu`。

## 3. 坑 2：`nu -c` 不加载 `config.nu`，用它验证配置会误判

### 3.1 现象

在 `config.nu` 里设了 `$env.config.show_banner = false`，跑 `nu -c '$env.config.show_banner'` 返回 `true`，看似没生效。

### 3.2 真相

`nu -c '...'`（非交互式脚本模式）**根本不加载 `config.nu`**，它读的是内置默认值。所以用 `nu -c` 查 `$env.config.show_banner` 永远是默认的 `true`，会让人误以为设置没生效。

### 3.3 正确验证方式

用 `nu -e '...'`：执行命令后进入交互式 shell，**会加载 `config.nu`**。

```bash
nu -e 'print $"banner=($env.config.show_banner)"'
# => banner=false
```

或者用 `expect` 模拟 TTY 启动真交互式会话来肉眼确认。

## 4. 坑 3：新开终端标签页报 `atomcode not found`，但旧会话里好好的

### 4.1 现象

在已开的终端里 nushell 能找到 `atomcode`（`which atomcode` 命中 `~/.local/bin/atomcode`）。但**新开一个终端标签页**后启动 nushell，跑 `atomcode` 报：

```
Error: nu::shell::external_command
  × External command failed
   · Command `atomcode` not found
```

### 4.2 真因

`atomcode` 在 `~/.local/bin/`，该目录是被 `~/.zshrc` 里 `export PATH="~/.local/bin:$PATH"` 加进 PATH 的。但 macOS 终端 App（Terminal/iTerm）新开标签页时未必重跑 `~/.zshrc`——尤其当 shell 被设成「非登录」模式，或只读 `~/.zprofile`（而该文件是空的）时，新标签页拿到的是 GUI 进程继承来的精简 PATH，**不含 `~/.local/bin`**。

佐证：`launchctl getenv PATH` 输出为空，说明 GUI 进程层根本没设 PATH，新标签页的 PATH 全靠 zsh 启动文件，不保证跑 `~/.zshrc`。

### 4.3 修复

不依赖外部 shell 是否跑过 `~/.zshrc`，在 nushell 的 `env.nu`（每次启动无条件加载，早于 `config.nu`）里自己加 PATH：

```nu
# ~/Library/Application Support/nushell/env.nu
use std/util "path add"
path add "~/.local/bin"
```

验证（故意给个不含 `~/.local/bin` 的精简外部 PATH，模拟最坏情况）：

```nu
PATH=/opt/homebrew/bin:/usr/bin:/bin nu -e 'which atomcode | get command | print'
# => atomcode   ← 仍可见
```

## 5. 坑 4：配置项名是 `show_banner`，不是 `banner`

### 5.1 现象

跑 `nu -c '$env.config.banner'` 报：

```
Error: nu::shell::name_not_found
  · `-- did you mean 'show_banner'?
```

### 5.2 真相

关闭 welcome message 的配置项叫 `show_banner`（bool|string）：

```nu
$env.config.show_banner = false      # 不显示
$env.config.show_banner = true       # 显示完整 banner（默认）
$env.config.show_banner = "short"    # 只显示启动耗时
```

查文档：

```bash
config nu --doc | nu-highlight | less -R
```

## 6. 坑 5：GitHub issue #8698——`show_banner` 被文件末尾的默认值覆盖

### 6.1 现象

有人在 `config.nu` 开头写 `$env.config.show_banner = false`，banner 依然出现。

### 6.2 真因

nushell 安装时生成的默认 `config.nu` 文件**末尾自带** `$env.config.show_banner = true`，写在开头的 `false` 被末尾的 `true` 覆盖。

### 6.3 修复

把自己的设置放在文件**末尾**，或删掉默认那行 `true`。可用 `config nu` 命令打开编辑器修改。

## 7. 最终生效配置

### 7.1 `~/Library/Application Support/nushell/env.nu`

```nu
# 每次启动无条件加载，早于 config.nu
# 不依赖外部 shell 是否跑过 ~/.zshrc，自己确保 ~/.local/bin 在 PATH 里
use std/util "path add"
path add "~/.local/bin"
```

### 7.2 `~/Library/Application Support/nushell/config.nu`（在注释段后追加）

```nu
# 关闭启动 welcome message
$env.config.show_banner = false
# 清空右侧 prompt，去掉行末时间段
$env.PROMPT_COMMAND_RIGHT = {|| "" }
```

## 8. 总结

- 配置放对目录：macOS 是 `~/Library/Application Support/nushell/`，不是 `~/.config/nushell/`
- 验证用 `nu -e`，别用 `nu -c`（后者不加载 `config.nu`）
- PATH 相关的放 `env.nu`（无条件加载），不依赖外部 shell 的 `~/.zshrc`
- 关 banner 的配置项是 `$env.config.show_banner`，注意被文件末尾默认值覆盖

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/nushell-atomcode-config-pitfalls.html
