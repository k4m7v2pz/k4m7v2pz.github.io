<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 16GB Mac 本地跑大模型：ollama 局域网 OpenAI 兼容 API 实战

> 日期：2026-08-02

### 背景与需求

我有一台 MacBook Air M3 / 16GB，平时主力使用云端大模型，但**断网就抓瞎**。因此设定了三个核心目标：

1. **断网可用**：模型跑在本机，离线也能对话、写代码。
2. **OpenAI 兼容 API**：本机和局域网设备都能调用（如 AtomCode、自写脚本等，只需把 base_url 指向本机服务即可）。
3. **平时零内存占用**：不用时服务空载、内存压力保持绿色；调用时才加载模型，用完自动释放。

### 机器配置

- **芯片**：Apple M3，8 核 CPU
- **内存**：16GB 统一内存（实际可分配给模型约 12-13GB）
- **系统**：macOS 26.5（arm64）
- **工具链**：Homebrew 6.x

### 方案选型：为什么选择 ollama？

最终选择 **ollama 0.32.5**，理由如下：

- **一键安装**：一条命令装好，省去复杂配置。
- **自带 OpenAI 兼容端点**：提供 `/v1` 标准接口，兼容现有工具链。
- **模型懒加载**：不用不占内存，符合“零内存占用”目标。
- **支持局域网监听**：方便多设备调用。

通过 Homebrew 安装时，直连 ghcr.io 下载 bottle 可能很慢，建议挂本机代理（如 127.0.0.1:7890）实现秒下。

### 关键配置：两个决定成败的环境变量

| 变量 | 值 | 作用 |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0:11434` | 监听所有网卡，使局域网设备可访问 |
| `OLLAMA_CONTEXT_LENGTH` | `16384` | 上下文窗口大小；默认 4096 会拒绝大请求（坑1） |

### 开机自启：避免环境变量丢失

不推荐使用 `brew services`，而是通过自定义 LaunchAgent（`~/Library/LaunchAgents/com.user.ollama.plist`）实现开机自启。**关键点：环境变量直接写死在 plist 文件里**——因为通过 `launchctl setenv` 设置的环境变量重启后会丢失（坑2）。

### 模型清单

- **qwen3:8b（5.2GB）**：主力对话模型，中英文表现均衡。
- **deepseek-r1:8b（5.2GB）**：深度推理专用。
- **qwen3-chat:8b（自建无思考版）**：日常秒回，响应迅速。
- **nomic-embed-text（274MB）**：文本向量化，用于 RAG 场景。

### AI 与代码 Agent 速查手册

```# 安装 ollama
brew install ollama
Base URL
本机: http://localhost:11434/v1
局域网: http://<Mac-IP>:11434/v1
无需 API Key（服务端不校验）
curl http://localhost:11434/v1/chat/completions

-H "Content-Type: application/json"

-d '{"model":"qwen3:8b","messages":[{"role":"user","content":"hi"}]}'
自启 plist 路径: ~/Library/LaunchAgents/com.user.ollama.plist
手动启停脚本: ollama-start / ollama-stop（位于 ~/bin，已加入 PATH）```bash

### 实战体验：速度、内存与选型

#### 速度实测（同一句问候）

| 模型 | 耗时 | tokens | 说明 |
|---|---|---|---|
| qwen3-chat:8b（无思考版） | 1.2s | ~20 | 日常对话推荐 |
| qwen3:8b（默认思考） | 27.5s | 100+ | 简单问题也要先想 |
| qwen3:8b（AtomCode 内） | 12s | 14.75K | plan 模式输入自带约 14K 上下文 |
| deepseek-r1:8b | 3m51s | 8.99K | 推理模型，多数 token 是思考过程 |

核心结论：**模型的思考模式是最大时间杀手**。Qwen3 系列默认开启思考（响应带 reasoning 字段），对“今天天气”也要沉思半分钟；关闭后同输入 1.2s，快约 22 倍。deepseek-r1:8b 是纯推理模型，慢是特性不是故障，适合留给数学、逻辑、代码深挖。

#### 内存行为（16GB 关键体验）

- ollama 服务空闲仅占约 34MB，内存压力图保持绿色
- **模型懒加载**：不调用不加载；调用时才载入 5.2GB，压力变黄
- 闲置 5 分钟自动卸载（keep_alive 默认），内存自动回落
- 结论：服务可以开机常驻，平时零负担，完美满足“平时绿、用时黄”的需求

#### 16GB 选型原则

- **7-8B 模型 Q4 量化（约 5GB）**：甜点，速度内存都舒服
- **14B（约 9GB）**：能跑但偏慢，16GB 下内存紧张
- **32B+**：别想，KV 缓存放不下，换页到磁盘慢到没法用

#### 血泪案例：大编辑器 + 模型 = swap 灾难

用 Zed 打开了整个家目录（占 7GB），再调模型（7.7GB），16GB 直接爆掉：swap 用掉 5.2GB，推理从 30 秒被拖到 4 分钟。**跑本地模型前先关掉大内存应用**，这是 16GB 机器的物理定律。

#### AI 与代码 Agent 速查（续）

- 内存压力变黄 = 模型加载中，正常现象
- 调用前关掉 Zed/浏览器等大户
- 模型闲置 5 分钟自动卸载，无需手动清理
- 同一时刻 ollama 只驻留一个模型，切换会自动换载

### 踩坑清单

#### 坑 1：num_ctx 默认 4096，大请求直接 400

- **症状**：请求 8688 tokens 报 `exceed_context_size_error (n_ctx=4096)`。
- **原因**：ollama 服务端默认上下文 4096，客户端没传 num_ctx 就按它算。
- **修复**：设 `OLLAMA_CONTEXT_LENGTH=16384`（16GB 平衡点），重启服务生效。
- **验证**：发一个 4096+ tokens 的请求，不再报错即生效。

#### 坑 2：launchctl setenv 重启即丢

- **症状**：重启后局域网监听、16384 上下文全部失效，悄悄退回默认。
- **原因**：`setenv` 是会话级环境变量，重启不保留。
- **修复**：环境变量写进 LaunchAgent plist 的 `EnvironmentVariables` 字段，永久生效。

#### 坑 3：Qwen3 思考模式默认开启

- **症状**：简单问题也要 30 秒+，响应带 reasoning 字段。
- **原因**：Qwen3 系列默认 `enable_thinking=true`。
- **修复**：Modelfile 的 PARAMETER 不支持 `enable_thinking` / `think`（实测报 unknown parameter）；需复制原 TEMPLATE，把最后一条 user 消息处的 think 开关分支替换为固定注入 `/no_think` 指令，再 create 成无思考模型。
- **⚠️ 注意**：模板结尾还有一段 range 闭合逻辑，漏掉会报 `template error: unexpected EOF`。

#### 坑 4：AtomCode 的 Context window 只是 UI 假设

- 界面里填 8192/16384 只是客户端的估算值，真正生效的是服务端 `num_ctx`。
- 两边不一致会误报“接近上限”甚至 107% 超量显示，实际请求能跑通。
- 改配置时服务端为准。

#### 坑 5：embedding 模型不能 chat

- nomic-embed-text 走对话接口报 `does not support chat`。
- 向量模型只认 `/v1/embeddings`，返回 768 维向量，别在聊天界面里选它。

#### AI 与代码 Agent 速查（续）

```# 验证上下文生效（发 >4096 token 请求，不报错即 OK）
curl http://localhost:11434/v1/chat/completions \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"<大段文本>"}]}'
查当前已加载模型与驻留情况
curl http://localhost:11434/api/ps
向量化（embedding 模型专用）
curl http://localhost:11434/v1/embeddings

-d '{"model":"nomic-embed-text","input":"要向量化的文本"}'```bash

**下一篇预告**：将详细介绍如何配置 LaunchAgent plist 文件、编写启停脚本，并演示如何在 AtomCode、脚本中调用本机 OpenAI 兼容 API。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/ollama-lan-openai-api-mac.html
