# 修复 SSH 进 Windows 输出逐字累积：\r 回车被当换行，winpty 与 Win10 1607 无 ConPTY

> 日期：2026-08-05

### 一、场景重现：逐字累积的诡异现象

环境如下：一台 Windows VPS，运行着 Win10 1607 LTSB（build 14393），安装了 OpenSSH for Windows 9.5，sshd.exe 位于 `C:\Program Files\OpenSSH`，登录 shell 设置为 `rvs`（rust-verb-shell）。从 Mac 上的 wezterm 终端通过 SSH 登录后，一切看似正常——直到我运行一个交互式 TUI 程序（以 atomcode 为例），画风就变了。

想象一下：你问 AI 一个问题，正常情况下屏幕应该回显一行不断刷新的答案。但在这里，AI 的回复像是一台老式打字机在不断地敲出新行——“你”、“你好”、“你好，”、“你好，我”、“你好，我是”……每刷新一次，屏幕上就多出一行，而不是回到行首覆盖上一次的文本。滚屏时完全没有“回车回行首重绘”的效果。更糟糕的是，登录 banner、命令表格也出现了文本重叠错位，整个终端界面让人看得头晕。

这种现象，就是本文要深入排查的“逐字累积”问题。它看起来像是一个简单的显示 bug，但背后牵扯到终端渲染、PTY 伪终端以及 Windows 平台上一些微妙的行为差异。

### 二、谬误溯源：三个常见的误判

遇到这类问题时，直觉往往会把人引向几个方向。我们先来看看哪几条路是死胡同，免得你也绕弯子。

#### 误判一：编码问题

最先映入眼帘的，往往是乱码。由于系统代码页默认是 936（GBK），UTF-8 字符在传输过程中被双重编码，导致屏幕上出现一片不可读的字符。第一反应当然是执行 `chcp 65001` 切换到 UTF-8 代码页。乱码确实消失了——但逐字累积的现象纹丝不动。

**结论：排除编码问题。**如果乱码修好后现象依旧，就不要在编码上浪费时间了。

#### 误判二：终端问题

第二个容易怀疑的，是客户端终端模拟器。毕竟 wezterm 配置复杂，是不是它没正确解析 ANSI 转义序列？或者它没有正确处理 `\r`（回车回行首）？但验证起来很简单：在本地启动同一个 TUI 程序，一切完美，`\r` 的回行首效果完全正常。终端侧无责。

**结论：排除终端问题。**同样的程序在本地能正常渲染，说明客户端的 ANSI 解析是健全的。

#### 误判三：程序问题

既然终端没问题，那是不是 atomcode 这个 TUI 程序本身在 Windows 上渲染有 bug？为了验证这一点，我用了一个关键对比：非交互方式执行同一程序。

执行命令：`ssh host 'command'`（不分配 PTY，即管道模式）。在这种模式下，程序的输出直接通过管道流回客户端，中间不经过伪终端层。结果呢？输出完美无累积，`\r` 的回车覆盖效果完全正常。

这直接说明了一个关键事实：**程序自身的渲染逻辑没有问题**。同一个程序，在管道模式下（无 PTY）正常，在交互模式下（有 PTY）异常——问题被锁定在了 PTY 层。

### 三、直击症结：PTY 层在中间做了什么

PTY（Pseudo Terminal，伪终端）是 SSH 交互会话中的关键组件。它的工作是在服务端进程（你的 shell 或程序）和客户端之间建立一条虚拟的终端链路，负责处理终端控制字符、窗口大小变化、信号处理等。

在正常情况下，当 TUI 程序输出 `\r`（回车，ASCII 码 13），PTY 应该原样转发给客户端，终端收到后会将光标移回行首，后续内容覆盖当前行——这就是“原地刷新”效果。但如果 PTY 层对 `\r` 做了某种转换——比如把它变成了 `\n`（换行），或者在某些条件组合下丢弃了它——那么 TUI 程序每次刷新都会从新的一行开始，逐字累积就出现了。

在 Windows 平台上，这个问题更加微妙。Win32 的控制台 API 和 POSIX 的终端行为之间存在根本差异。OpenSSH for Windows 在实现 PTY 时，需要在这两者之间架一座桥。Windows 的 console 模式下，输出到控制台的字符会经过 conhost.exe 的处理；但通过 PTY 转发的字符，则绕过了这一层。OpenSSH 内部使用 ConPTY（Windows 伪终端 API）来模拟 Unix 风格的终端行为，但在某些版本或配置下，对于特定控制字符的处理规则可能与标准 Unix PTY 不完全一致。

一个值得关注的细节是：在 `rvs`（rust-verb-shell）作为登录 shell 的场景下，shell 本身对输入输出的处理也会与 PTY 层产生交互。如果 PTY 的终端模式标志（termios flags）没有正确设置——比如 `ONLCR`（将换行映射为回车换行）的映射方向与预期相反——就会出现控制字符被意外转换的情况。

### 四、解决路径：从绕过到根治

#### 4.1 快速绕过：强制分配 PTY 并设置终端类型

如果只是想让当前的交互会话恢复正常，可以尝试在 SSH 客户端侧显式指定终端类型：

```bash
ssh -t -o "SendEnv TERM" host
```

在服务端的 shell 配置文件（如 `.bashrc` 或 `.profile`）中确保：

```bash
export TERM=xterm-256color
```

这个组合会让 OpenSSH 在分配 PTY 时使用标准的终端能力数据库，提高控制字符处理的正确性。

#### 4.2 较彻底的缓解：调整 OpenSSH 配置

在服务端的 `sshd_config`（通常位于 `C:\ProgramData\ssh\sshd_config`）中，可以尝试以下配置：

```bash
# 强制分配 PTY
PermitTTY yes
接受客户端发送的终端类型
AcceptEnv TERM
禁用可能干扰控制字符的压缩或延迟
TCPKeepAlive yes
UseDNS no
```

修改后重启 sshd 服务（`Restart-Service sshd` 或通过服务管理器）。这些配置可以确保 PTY 分配的一致性和终端类型的正确传递，减少控制字符被误处理的可能性。

#### 4.3 源码验证与根因定位：winpty 的 CR/LF 处理缺陷

经过进一步源码级验证，问题的根因比最初推测的"ConPTY 兼容性边界"更具体——本机根本没有 ConPTY，OpenSSH 回退到了 winpty，而 winpty 对 `\r` 的处理存在确定性缺陷。

**验证一：管道模式 vs 交互模式的 `\r` 行为对照。**管道模式下（`ssh` 不带 `-t`，不分配 PTY），PowerShell 依次输出 "AAA"、回车、 "BBB"，结果只显示 "BBB"——`\r` 正常回行首覆盖。交互模式下（分配 PTY），登录 banner 中的文本反复叠加，出现"当前目录: C:(v26.8.39) 用户@主机: administrator@..."等重叠现象——`\r` 失效，内容追加而非覆盖。同一程序、同一终端，PTY 有无成为唯一变量，直接锁定问题出在 PTY 层。

**验证二：expect 模拟 PTY 稳定复现。**使用 expect 的 `spawn ssh` 捕获交互输出，banner 与提示符均出现重叠。这排除了"偶发"或"特定客户端行为"的可能性，确认该问题是确定性的系统级缺陷。

**验证三：根因定位——[Win32-OpenSSH issue #1256](https://github.com/PowerShell/Win32-OpenSSH/issues/1256)。**官方 issue 明确描述了该缺陷：`\r` 被当作换行处理（"CR worked as CR+LF, LF are ignored"）。关键约束在于：ConPTY（Windows 伪控制台）自 Win10 1809（build 17763）才引入，本机运行的是 Win10 1607 LTSB（build 14393），不具备 ConPTY。OpenSSH 因此回退到 winpty 模拟 PTY，而 winpty 的 CR/LF 处理存在上述缺陷。官方答复明确指出：ConPTY 版本与 Windows 版本绑定，无法通过升级 OpenSSH 解决（"we can't service that one"）。

基于以上根因，以下是几个实际可行的方向：

- **升级 Windows 版本至 1809+**：这是根本解决方案。获得原生 ConPTY 支持后，`\r` 等控制字符的处理将符合标准，不再依赖 winpty 回退方案。
- **使用 msys2 或 Cygwin 的 SSH 服务端**：它们使用独立的 Unix 风格 PTY 实现，不依赖 winpty/ConPTY，对控制字符的处理更加标准。这是在不升级系统的情况下较彻底的缓解方案。
- **切换登录 shell 进行对比验证**：可临时改用 `cmd` 或 `powershell` 作为登录 shell，确认 `rvs` 是否与 winpty 存在额外交互问题。但需注意，这只能缩小问题范围，无法解决 winpty 本身的 CR/LF 缺陷。

### 五、总结

这次排障的核心收获是一条验证逻辑：当交互模式的 TUI 异常而管道模式正常时，问题不在程序本身的渲染逻辑，而在 PTY 层。通过交叉对比（同一程序 / PTY vs 管道 / Windows vs Linux），可以快速缩小问题域。

对于 Windows 平台上的 SSH 使用者来说，值得牢记的是：Windows 的终端基础设施（ConPTY）虽然已经大幅进步，但在控制字符的精确处理上，与成熟的 Unix PTY 仍有细微差距。当你遇到 `\r` 不回车、退格不删字符、ANSI 转义序列被展示为字面文本等怪现象时，先不要急着怀疑程序——看看 PTY 层发生了什么，往往能节省大量时间。

### 六、落地结论

**1. 根因定性：**`\r` 失效是 OpenSSH 在无 ConPTY 的旧版 Windows（1607）上使用 winpty 模拟 PTY 的 CR/LF 处理缺陷，与编码、终端、程序渲染均无关。

**2. 影响范围：**仅交互式（PTY）会话受影响；管道/非交互会话正常。

**3. 规避方案：**TUI 程序改用 headless 模式（如 `atomcode -p "你的问题"`），输出不走 `\r` 重绘，实测完全正常。

**4. 根治路径：**升级 Windows 10 1809 以上（获得 ConPTY），或换用自带 PTY 实现的 SSH 服务端（如 Bitvise）。

### 七、三类读者速查

#### 人类

自查两步：

1. `ssh host '命令'` 管道执行看是否正常；
2. 交互式跑同一命令看是否逐字累积。累积即中招，用 headless 规避。

#### 对话式 AI

提问“SSH 进 Windows 交互终端输出逐字累积是什么原因”——回答要点：OpenSSH + 旧版 Windows（无 ConPTY）的 winpty PTY 层把 `\r` 当换行处理，非编码问题；规避用 headless，根治需 ConPTY（Win10 1809+）。

#### 代码 Agent

两条验证命令可直接执行：

PowerShell `\r` 测试：`[Console]::Write("AAA"); [Console]::Write([char]13); [Console]::Write("BBB")`，正常只显示 BBB，失效则累积；

expect 复现：`spawn ssh host` 后 `send "命令\r"`，输出重叠即 PTY `\r` 失效。

---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/ssh-windows-output-buffering.html
