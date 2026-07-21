# 从 AtomCode 续杯到昇腾容器：我把免费 NPU 接进了 Mac

## 摘要

本来只是在 ai.atomgit.com 盯着 AtomCode 的免费模型续杯倒计时，随手点开旁边的"昇腾模型生态"选项卡，没想到挖到了宝。本文将记录如何把网页里的"昇腾模型助手"变成 Mac 本地 Agent 的后端，过程中充满容器权限的博弈、pip 的依赖坑和网络隔离挑战，最终在远端昇腾 NPU 上跑通 Qwen2.5-7B，并通过 SSH 反向隧道将 OpenAI 兼容的 API 服务穿透到本地 Mac，实现免本地内存压力的远端推理。

## 前言：AtomCode 的"续杯"日常与功耗焦虑

作为一名重度依赖 AI 辅助编程的开发者，我早已习惯了 AtomCode 官方客户端的节奏。平时盯着官方构建版，心里都有一本账：

- **Lite 版：** 30 天一登录一续，不用抢，到点 `/login` 一下就能续杯，主打一个佛系。
- **Pro 版：** 想用 GLM-5.2 就得抢。但要注意——Pro 没过期的时候点 `/login` 是续不了的，系统不让续，必须等当前 Pro 过期那一天、第二天早上 10 点准点去抢才能抢到 GLM-5.2 额度。

AtomCode 里能调到的 DeepSeek-V4-Flash、GLM-5.2 这类模型，并不是在 Mac 上跑的。它们更可能是 AtomGit 平台提供的中转 API，或者是模型方在 AtomGit / 华为云之上部署过的云端实例，atomcode 客户端只是走 HTTP 调远端。

直到那天，我盯着网页中的选项卡，目光从 AtomCode 移到了旁边的"昇腾模型生态"。出于好奇点进去，发现这不仅仅是静态页面，而是一个活生生的昇腾模型助手 Agent 页面——带 Web 终端的那种。我决定试试，能不能把这个网页里的算力"抠"出来，给本地 Agent 当后端。

## 踩坑实录一：容器环境的"镣铐"

申请容器、进终端，第一刻就意识到这不会一帆风顺——这是个典型的受限环境：

1. **家目录只读（Read-Only）：** .ssh/config 写不了，known_hosts 也落不下来，pip install 往用户目录写包也会炸。所有"临时物"只能往 /tmp 或 /opt/atomgit 塞。
2. **pip 的 PEP 668 坑：** 直接 pip install fastapi 会报 error: externally-managed-environment。必须用 `pip install --break-system-packages`，现代容器（Debian 12 系）基本都踩这个。
3. **CANN / torch-npu 的环境变量：** `ASCEND_HOME`、`LD_LIBRARY_PATH` 没全默认加载时，Torch-NPU 会找不到底层 .so；另外 `ASCEND_LOG_DIR` 如果指到家目录会报错，得手动 `export ASCEND_LOG_DIR=/opt/atomgit/ascend/log`。
4. **torch_dtype 弃用：** 新版 transformers 里 `torch_dtype=torch.float16` 已弃用，得用 `torch_dtype="torch.float16"` 字符串形式，或者用 `torch_dtype=torch.bfloat16`。

## 踩坑实录二：核心依赖安装

昇腾 NPU 的核心依赖是 `torch_npu`，它需要匹配特定版本的 PyTorch 和 CANN 工具包。安装命令：

```bash
pip install torch_npu==2.1.0.post1 --break-system-packages
```

验证 NPU 是否可用：

```python
import torch
import torch_npu
print(torch.npu.is_available())  # 应输出 True
print(torch.npu.device_count())  # 应输出 NPU 数量
```

## 踩坑实录三：网络隔离与 SSH 反向隧道

容器环境没有公网 IP，但可以通过 SSH 反向隧道把服务暴露到本地。

### 在容器内启动推理服务

```python
# app.py - 使用 FastAPI 提供 OpenAI 兼容 API
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    model: str
    messages: list
    stream: bool = False

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    # 调用昇腾 NPU 上的 Qwen2.5-7B
    ...
```

### 建立 SSH 反向隧道

在容器内执行：

```bash
ssh -R 8000:localhost:8000 user@your-mac-ip -N -f
```

这样本地 Mac 访问 `localhost:8000` 就相当于访问容器内的推理服务。

## 最终效果

- 本地 Mac 不消耗内存运行 7B 模型
- 远端昇腾 NPU 跑 Qwen2.5-7B，通过 SSH 隧道提供 OpenAI 兼容 API
- 任意本地 Agent 工具（如 Continue、Cursor 等）都可以配置为使用这个远端 API
- 容器到期后重新申请即可，NPU 算力免费续杯

## 总结

从 AtomCode 续杯倒计时出发，意外发现昇腾模型生态的免费 NPU 算力。通过容器环境的"镣铐舞蹈"（只读家目录、PEP 668、环境变量缺失），最终成功在远端 NPU 上跑了 Qwen2.5-7B，并用 SSH 反向隧道把 API 服务穿透到本地 Mac。整个过程让 Mac 的内存压力归零，推理性能却跑在云端 NPU 上。