# From AtomCode Free Tier to Ascend NPU: Connecting Free NPU to My Mac

## Abstract

While monitoring the AtomCode free model countdown on ai.atomgit.com, I casually clicked the "Ascend Model Ecosystem" tab and discovered a hidden gem. This article documents how I turned the "Ascend Model Assistant" web page into a local Mac Agent backend — navigating container permission battles, pip dependency pitfalls, and network isolation challenges — ultimately running Qwen2.5-7B on a remote Ascend NPU and tunneling the OpenAI-compatible API back to the local Mac via SSH reverse tunnel.

## Preface: The AtomCode "Refill" Routine

As a developer heavily reliant on AI-assisted coding, I'm well-versed in AtomCode's rhythm:
- **Lite tier:** 30-day login refill, no rush. Just `/login` when due.
- **Pro tier:** Need to compete for GLM-5.2. But note — you can't refill while Pro is still active. Wait until it expires, then grab it the next morning at 10 AM.

The models accessible through AtomCode (DeepSeek-V4-Flash, GLM-5.2) don't run on your Mac — they're cloud API endpoints provided by AtomGit or the model vendors.

## Pitfall 1: Container Environment Constraints

1. **Read-only home directory** — `.ssh/config` can't be written, `pip install` to user site fails. All temporary files go to `/tmp` or `/opt/atomgit`.
2. **PEP 668** — Use `pip install --break-system-packages` on Debian 12-based containers.
3. **CANN/torch-npu environment variables** — `ASCEND_HOME` and `LD_LIBRARY_PATH` may not be fully loaded. Set `ASCEND_LOG_DIR=/opt/atomgit/ascend/log`.
4. **torch_dtype deprecation** — Use string form `torch_dtype="torch.float16"` instead of `torch_dtype=torch.float16`.

## Pitfall 2: Core Dependency Installation

```bash
pip install torch_npu==2.1.0.post1 --break-system-packages
```

Verify:
```python
import torch
import torch_npu
print(torch.npu.is_available())  # Should be True
```

## Pitfall 3: Network Isolation and SSH Reverse Tunnel

The container has no public IP, but SSH reverse tunnel exposes the service to localhost:

```bash
# Inside the container
ssh -R 8000:localhost:8000 user@your-mac-ip -N -f
```

Now `localhost:8000` on the Mac connects to the inference service inside the container.

## Result

- Local Mac uses zero memory for 7B model inference
- Remote Ascend NPU runs Qwen2.5-7B via SSH tunnel with OpenAI-compatible API
- Any local Agent tool can use this remote API
- Container expires? Re-apply — the NPU is free to refill

---
<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/atomcode-ascend-npu-free-tier.html
