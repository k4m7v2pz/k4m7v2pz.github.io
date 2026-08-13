<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# macOS 上 Nushell 自定义配置陷阱：一个让我的工具链函数突然消失的根因复盘

> **一句话总结：** macOS 上 nushell 实际读取的配置文件路径不是 `~/.config/nushell/config.nu`，而是 `~/Library/Application Support/nushell/config.nu`。改错地方会让你的自定义函数"看起来改好了，新开标签页又变回旧的"。

## 一、背景：我在干什么

我在 macOS 上用 nushell 作为日常 shell，自己写了一个 Rust 项目叫 `creeper`（Minecraft 网络安全工具箱）。每次调用 `creeper` 命令时，我希望 nushell 自动做三件事：

1. `cd` 到源码目录
2. 跑 `cargo build --release --features gui` 增量编译
3. 编译成功才执行新二进制；失败则报错退出

所以我写了一个 nushell 自定义函数 `def creeper [...args: string] { ... }`，放在 config.nu 里。

## 二、现象：改了配置，新开标签页却没生效

某天我给 `creeper` 函数加了三个改动：

1. `cargo build --release` → `cargo build --release --features gui`（启用 egui GUI 特性）
2. `def creeper` → `def --wrapped creeper`（让 `--help` / `--version` 等 flag 透传给底层二进制）
3. `exit 1` → `return`（编译失败时不要关掉整个终端标签页）

我改了 `~/.config/nushell/config.nu`，确认文件内容是对的。然后：

- 在当前标签页 `source ~/.config/nushell/config.nu` → 函数生效，`creeper webui` 能跑
- **新开一个标签页** → `creeper --help` 输出的还是旧函数的帮助，`creeper webui` 报 `unrecognized subcommand`

## 三、根因：macOS 上 nushell 的配置路径不是 XDG 那套

在 macOS 上，nushell 的配置文件路径遵循 Apple 的 **File System Basics** 规范，而不是 XDG Base Directory 规范。

| 操作系统 | 配置文件路径 |
|----------|-------------|
| Linux (XDG) | `~/.config/nushell/config.nu` |
| macOS (Apple 规范) | `~/Library/Application Support/nushell/config.nu` |
| Windows | `%APPDATA%\nushell\config.nu` |

macOS 上 nushell 启动时读取的是 `~/Library/Application Support/nushell/config.nu`。如果你只改了 `~/.config/nushell/config.nu`，新开的标签页根本不会读到这个文件，所以函数还是旧版本。

**验证方法：**

```bash
# 在 nushell 中运行，查看实际加载的配置路径
echo $nu.config-path
# macOS 应输出: ~/Library/Application Support/nushell/config.nu
```

## 四、为什么 `source` 一下就好了？

`source ~/.config/nushell/config.nu` 是**显式加载**指定路径的文件，它不管 nushell 默认读哪个路径。这就是为什么当前标签页 `source` 后函数生效了，但新标签页还是读默认路径。

## 五、修复方案

### 方案 1：改正确的文件（推荐）

编辑 `~/Library/Application Support/nushell/config.nu`，把自定义函数写在这里。以后所有改动都改这个文件。

### 方案 2：在正确的文件中 `source` 另一个文件

如果习惯把配置放在 `~/.config/nushell/` 下（比如为了和其他 Linux 工具统一），可以在 `~/Library/Application Support/nushell/config.nu` 中加一行：

```
source ~/.config/nushell/config.nu
```

这样 nushell 启动时先读 `~/Library/Application Support/nushell/config.nu`，然后通过 `source` 加载你的自定义配置。两全其美。

### 方案 3：永远用 `$nu.config-path` 确认

每次改配置前，先确认当前 nushell 读的是哪个文件：

```bash
echo $nu.config-path | path expand
```

然后编辑这个路径指向的文件。不会错。

## 六、教训

- macOS 不是 Linux，不要用 Linux 的目录规范去套 macOS 的行为
- 对 nushell 来说，`$nu.config-path` 是最权威的配置路径来源
- `source` 命令只能"临时加载"，不能"永久改变默认读取路径"
- 跨平台工具链（nushell 是跨平台的）在不同 OS 上的默认路径不同，第一次配置时需要确认
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/macos-nushell-config-path-pitfall.html
