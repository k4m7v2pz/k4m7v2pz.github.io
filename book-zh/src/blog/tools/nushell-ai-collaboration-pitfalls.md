# NuShell 协作避坑实录：给 AI 助手看的 5 条铁律

> 本文记录在 macOS 环境下使用 NuShell (nushell) 配合远程 Arch Linux 服务器进行运维操作时，AI 助手（如 ChatGPT、Claude 以及各类 Copilot）因基于 Bash/Zsh 语料训练而频繁产生的语法"幻觉"错误。旨在为 AI 助手提供一份纠错样本，同时也帮助从 Bash 迁移过来的运维同学避雷。

## 坑 1：&& / || 并非命令连接符

在 Bash 中，我们用 `&&` 连接命令。但在 NuShell 中，`&&` 和 `||` 是布尔运算符，不能直接用于连接两条执行语句。

**❌ Bash 思维（错误）**

```bash
ssh user@host "mkdir -p ~/.ssh && cat >> authorized_keys"
```

**报错：** The '&&' operator is not supported in Nushell

**✅ NuShell 正确写法**

```bash
ssh user@host 'mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
```

或者使用布尔判断：

```bash
(cmd1); if $env.LAST_EXIT_CODE == 0 { cmd2 }
```

## 坑 2：内置命令不支持 GNU 风格的 `-p` 参数

NuShell 有自己的内置命令集，很多常见的 GNU 扩展参数并不支持。例如 `mkdir -p`。

**❌ 错误写法**

```bash
ssh user@host "mkdir -p ~/.ssh"
```

**报错：** The 'mkdir' command doesn't have flag '-p'.

**原因分析：** SSH 后的双引号字符串会先经过本地 NuShell 解析，触发了对内置 `mkdir` 的参数校验，导致命令在本地就失败，而非在远端执行。

**✅ 正确写法**

**方法1：调用远程 bash 解释器**

```bash
ssh user@host 'bash -c "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"'
```

**方法2：已知目录存在，直接操作**

```bash
ssh user@host 'cat >> ~/.ssh/authorized_keys'
```

## 坑 3：命令替换语法 `$(...)` 无效

Bash 使用 `$(...)` 进行命令替换，而 NuShell 使用 `(...)`。

**❌ 错误写法**

```bash
ssh-keygen -C "key-$(date +%Y%m%d)"
```

**后果：** 生成的 Key 注释会变成字面量 `key-$(date +%Y%m%d)`，而不是展开后的日期。

**✅ NuShell 正确写法**

```bash
ssh-keygen -C $"key-(date now | format date '%Y%m%d')"
```

## 坑 4：字符串引号嵌套规则不同

NuShell 的字符串解析规则与 Bash 不同。

**❌ 错误写法**

```bash
ssh user@host "echo "hello""
```

**报错：** 双引号嵌套导致字符串提前闭合。

**✅ 正确写法**

```bash
ssh user@host 'echo "hello"'
```

在 NuShell 中，外层单引号表示原始字符串，内层双引号被原样传递给远端 Shell。

## 坑 5：环境变量设置语法不同

Bash 使用 `export VAR=value`，NuShell 使用 `$env.VAR = "value"`。

**❌ Bash 思维（错误）**

```bash
export MY_VAR="hello"
```

**✅ NuShell 正确写法**

```bash
$env.MY_VAR = "hello"
```

### 在 SSH 命令中传递环境变量

```bash
# ❌ 错误：NuShell 不支持 VAR=value cmd 这种前置变量
MY_VAR=hello ssh user@host

# ✅ 正确：用 env 命令
env MY_VAR=hello ssh user@host
```

## 核心原则：给 AI 看的铁律

1. **NuShell 不是 Bash**——它有自己的语法体系，不要用 Bash 的语法去套
2. **SSH 后的字符串先经过本地 NuShell 解析**——如果 SSH 命令被本地 NuShell 拦截到内置命令，会在本地就报错
3. **远程执行用单引号包裹**——单引号字符串在 NuShell 中不解析，原样传递给远端 Shell
4. **使用 `bash -c` 兜底**——如果远程机器是 Linux 且远端 Shell 是 Bash，用 `bash -c "..."` 包裹远程命令
5. **先确认 NuShell 版本**——不同版本的 NuShell 语法差异大，确认版本后再给出配置建议
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/nushell-ai-collaboration-pitfalls.html
