<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Windows 下通过 Scoop 安装 Nushell：完整指南

## 1. 环境基线

在开始安装 Nushell 之前，请确保系统环境满足以下要求：

- **操作系统**: Windows 10 或 Windows 11 (版本 22H2 或更高)
- **现有 Shell**: Git Bash (MINGW64)
- **目标 Shell**: Nushell 0.113.1
- **包管理器**: Scoop
- **网络环境**: 本地代理（例如: 127.0.0.1:PORT）

## 2. 核心安装逻辑

### 2.1 前置检查

首先，确认系统上是否已安装 Winget、Chocolatey 或 Scoop。本指南将使用 Scoop 作为包管理器。

### 2.2 Scoop 安装

在 Git Bash 中执行以下步骤：

1. **设置执行策略**：必须将 PowerShell 的执行策略设置为 RemoteSigned。
2. **配置网络代理**：这是关键步骤，必须同时设置 PowerShell 环境变量和 .NET 底层的代理。

安装 Scoop 的核心命令如下：

```powershell
# 在 Git Bash 中，必须通过 powershell.exe 调用 PowerShell 命令
powershell.exe -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
powershell.exe -Command "Invoke-RestMethod get.scoop.sh | Invoke-Expression"
```

### 2.3 Nu 安装

Scoop 安装成功后，使用以下命令安装 Nushell：

```bash
scoop install nu
```

### 2.4 IDE 集成

安装完成后，Nushell 的可执行文件位于 Scoop 的 shims 目录下。在 IDE（如 VS Code、Lingma 等）的终端设置中，需要指向此路径。

## 3. 关键路径变量

| 项目 | 路径 |
|------|------|
| Scoop 根目录 | `C:\Users\YourUserName\scoop\` |
| Nu 二进制文件 | `C:\Users\YourUserName\scoop\shims\nu.exe` |
| Nu 配置文件 | `C:\Users\YourUserName\AppData\Roaming\nushell\config.nu` |
| IDE 设置文件 | `C:\Users\YourUserName\AppData\Roaming\Lingma\User\settings.json` |

## 4. 核心踩坑点与解决方案

### 坑点 1: Shell 语法混淆

**现象**: 在 Git Bash 中直接执行 `$env:HTTP_PROXY=...` 报错。

**根因**: Git Bash 是 Unix-like Shell，不识别 PowerShell 的 `$env:` 语法。

**解法**: 在 Git Bash 中通过 `powershell.exe -Command` 调用 PowerShell 命令，不要直接在 Git Bash 里写 PowerShell 语法。

### 坑点 2: 代理配置不生效

**现象**: 设置 `HTTP_PROXY` 环境变量后，Scoop 下载仍然超时。

**根因**: Scoop 底层依赖 .NET 的 WebRequest，它不读取环境变量代理，需要单独设置 .NET 底层代理。

**解法**: 在 PowerShell 中同时设置环境变量和 .NET 底层代理：

```powershell
# 设置 .NET 底层代理（关键步骤）
$proxy = New-Object System.Net.WebProxy('http://127.0.0.1:7897')
$proxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials
[System.Net.WebRequest]::DefaultWebProxy = $proxy

# 设置环境变量代理
$env:HTTP_PROXY = 'http://127.0.0.1:7897'
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
```

### 坑点 3: 配置文件路径不同

**现象**: 修改了 `~/.config/nushell/config.nu` 后，新开标签页不生效。

**根因**: Windows 上 Nushell 的配置文件路径不在 `~/.config/nushell/`，而在 `%APPDATA%\nushell\config.nu`。

**解法**: 使用 `echo $nu.config-path` 确认实际路径，然后编辑正确的文件。

### 坑点 4: Scoop 安装卡在下载

**现象**: 运行安装脚本后卡在下载 GitHub Release 阶段。

**根因**: 国内网络环境访问 GitHub 不稳定。

**解法**: 使用代理，并确保 .NET 底层代理也配置了（见坑点 2）。

## 5. 安装验证

安装完成后，在新终端中运行以下命令验证：

```bash
nu --version
# 应输出: 0.113.1 或类似版本号
```

如果一切正常，Nushell 就成功安装并可以通过 `nu` 命令启动了。


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/scoop-install-nushell-windows.html
