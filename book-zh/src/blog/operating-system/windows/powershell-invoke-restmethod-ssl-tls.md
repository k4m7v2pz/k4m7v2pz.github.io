# PowerShell Invoke-RestMethod SSL/TLS 安全通道错误排查

> 日期：2026-08-02

### 一、平台环境摘要（System Profile）

| 维度 | 实际情况 |
|---|---|
| 主机名 | WIN-XXXXXXXXXXXX |
| 操作系统 | Microsoft Windows 10 企业版 2016 长期服务版 |
| 内部版本 | 10.0.14393 暂缺 Build 14393 |
| 系统类型 | x64-based PC，QEMU 虚拟机（Standard PC i440FX + PIIX, 1996） |
| 处理器 | Intel64 Family 6 Model 85 Stepping 4，1 颗 ~2.7 GHz |
| 物理内存 | 2,047 MB（约 2 GB），可用约 698 MB |
| 网络 | 静态 IP `10.x.x.x`，Intel PRO/1000 MT，无 DHCP |
| 补丁级别 | 6 个 Hotfix，最新为 2023 年 KB5023788 |
| 已装工具 | AtomCode 5.0.0 |
| PowerShell | 5.1，默认 TLS 栈需手动启用 TLS 1.2 |
| EOL | 2026-10-13（约 2.7 个月后终止支持） |

⚠️ **关键信号**：这是一台运行 Windows 10 LTSB 2016 的 QEMU 虚拟机，CPU 为 Intel64 Family 6 Model 85（1 颗 ~2.7 GHz），物理内存 2,047 MB（可用约 698 MB），且系统补丁停留在 2023 年。它不是一台现代开发机，而是"能跑、但处处是坑"的存量环境。

### 二、已遇到的问题与现象

#### 问题 1：PowerShell `irm` 下载脚本时 SSL/TLS 安全通道创建失败

执行安装命令时：

```irm https://raw.atomgit.com/.../install.ps1 | iex```powershell

报错：

```irm : 请求被中止: 未能创建 SSL/TLS 安全通道。
CategoryInfo : InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest)[FullyQualifiedErrorId : WebCmdletWebResponseException]```powershell

**根因**：Windows PowerShell 5.1 及更旧版本中，默认仅启用 SSL 3.0 与 TLS 1.0。而 `raw.atomgit.com` 等服务端已经只接受 TLS 1.2 或更高版本，协议协商失败，导致握手被中止。这在连接 GitHub 等现代 API 时是经典问题。

#### 问题 2：系统补丁与 TLS/Crypto 栈偏旧

- 系统 Build 14393 是 2016 年的 RTM 基线
- 仅安装了 6 个 Hotfix，绝大部分 2016–2023 年间发布的 TLS / Crypto / .NET 累积更新均未安装
- 这意味着即便手动开启 TLS 1.2，底层 Crypto 链仍可能存在信任根缺失、证书过期等问题

#### 问题 3：内存资源极度紧张

- 当前虚机配额：2 GB 内存 + 2 vCPU。这是 QEMU 虚机的资源分配上限，而非宿主机物理限制。如需提升，直接在虚拟化层调整配额即可，无需更换硬件。
- Windows 自身常驻占用 800–1000 MB
- 一旦 AtomCode 拉起模型推理、并行下载、或子进程（Git/Node/Python），极易触发内存压力甚至 OOM

#### 问题 4：LTSB 2016 的生命周期即将终结

- 微软对 Windows 10 LTSB 2016 的免费安全更新支持将于 2026 年 10 月 13 日结束
- 当前日期为 2026 年 7 月 22 日，距离 EOL 仅剩约 2.7 个月
- 此后不再有安全补丁，TLS/Crypto 漏洞将无法修复

### 三、已采取的缓解措施（Important）

为解决上述 SSL/TLS 问题，已在系统中执行以下操作：

```# 1. 当前会话启用 TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12```powershell

```# 2. 永久启用强加密（注册表）
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value 1 -Type DWord
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Wow6432Node\Microsoft\.NETFramework\v4.0.30319' -Name 'SchUseStrongCrypto' -Value 1 -Type DWord```powershell

**效果**：`irm` 安装命令在启用 TLS 1.2 后成功执行，AtomCode 5.0.0 已正确下载并安装到用户目录，PATH 已配置。

💡 **但需注意**：注册表修改后需重启 PowerShell 或系统才能对新会话永久生效；当前会话仍需手动执行第一条命令。

### 四、对 Agent / 对话式 AI 的协作约束建议

为避免后续给出的方案“看起来正确、实则不工作”，请 AI 在后续对话中遵守以下约束：

#### ✅ DO（推荐做法）

1. **所有涉及 `irm` / `Invoke-WebRequest` / `Invoke-RestMethod` 的命令，前置加入：**


```[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12```powershell

	或者建议用户升级到 PowerShell 7+（pwsh），其默认启用 TLS 1.2/1.3，从根本上规避问题。
2. **涉及外部 HTTPS 资源下载时，优先考虑：**

- 使用 `curl.exe`（Windows 10 自带）替代 `irm`
- 或先手动下载到本地再执行
- 或给出“离线安装”路径
3. **内存敏感操作要克制：**

- 避免建议同时启动多个重型进程
- 避免建议本地运行大模型推理（2 GB 内存不现实）
- AtomCode 的模型调用应走远程 API / CodingPlan，而非本地推理
4. **系统层面建议要务实：**

- 短期：补齐 TLS 1.2 强加密注册表项 ✅（已完成）
- 中期：升级到 Windows 10 LTSC 2021 或 Windows Server 2019+（2026 年 10 月前完成）
- 虚拟机：将内存提升至 4–8 GB

#### ❌ DON'T（避免的做法）

1. ❌ 不要假设系统具备现代 TLS 1.3 / 最新根证书 — 它不具备
2. ❌ 不要假设 PowerShell 是 7+ — 它是 5.1
3. ❌ 不要建议安装需要 .NET 4.7+ 或 WebView2 的现代工具 — 可能失败
4. ❌ 不要建议本地跑 Ollama / LLM 推理 — 内存不足
5. ❌ 不要忽略补丁滞后的现实 — 给出的方案要考虑 2023 年前的 Crypto 栈
6. ❌ 不要建议升级到 Windows 11 — LTSB 2016 + QEMU 老机型不满足硬件前提

### 五、典型故障的“标准应对模板”

如果后续在该平台上再次遇到类似 `未能创建 SSL/TLS 安全通道` 的错误，标准处置流程为：

```# Step 1: 强制 TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Step 2: （必要时）临时跳过证书校验——仅测试环境
⚠️ 警告：跳过证书校验会暴露于中间人攻击，仅可在隔离测试网络中使用
生产环境必须安装正确的根证书而非跳过校验
[Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
Step 3: 重试原命令
irm https://example.com/target-script.ps1 | iex```powershell

若仍失败，则改用 `curl.exe`：

```curl.exe -L -o install.ps1 https://example.com/target-script.ps1
.\install.ps1```powershell

### 六、一句话总结

>
这是一台 Windows 10 LTSB 2016 (Build 14393) + 2 GB 内存的 QEMU 虚拟机，TLS/Crypto 栈停留在 2016 年基线，已通过启用 TLS 1.2 强加密成功安装 AtomCode 5.0.0，但平台整体面临 协议栈老旧、内存紧张、补丁滞后、生命周期临近终结 四大挑战。后续给出的所有技术方案都必须以该平台的现实约束为前提，避免“现代最佳实践”式的建议。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/powershell-invoke-restmethod-ssl-tls.html
