# Running LLMs Locally on a 16GB Mac: A Practical Guide to ollama's LAN OpenAI-Compatible API

> Date: 2026-08-02

### Background & Requirements

I have a MacBook Air M3 / 16GB and normally rely on cloud LLMs, but **without a network I'm stuck**. So I set three core goals:

1. **Works offline**: the model runs on the local machine, so I can chat and write code even offline.
2. **OpenAI-compatible API**: callable from both the local machine and LAN devices (e.g., AtomCode, my own scripts — just point `base_url` at the local service).
3. **Zero memory footprint when idle**: when not in use the service sits idle and memory pressure stays green; the model only loads when called and releases itself automatically afterwards.

### Machine Setup

- **Chip**: Apple M3, 8-core CPU
- **Memory**: 16GB unified memory (about 12-13GB actually available to the model)
- **OS**: macOS 26.5 (arm64)
- **Toolchain**: Homebrew 6.x

### Why ollama?

I settled on **ollama 0.32.5** for the following reasons:

- **One-command install**: a single command gets it set up, no complicated configuration.
- **Built-in OpenAI-compatible endpoint**: provides the standard `/v1` interface, compatible with existing toolchains.
- **Lazy model loading**: doesn't consume memory when unused, meeting the "zero memory footprint" goal.
- **LAN listening**: convenient for calling from multiple devices.

When installing via Homebrew, downloading the bottle directly from ghcr.io can be slow; I recommend routing through a local proxy (e.g., 127.0.0.1:7890) for instant download.

### Key Configuration: Two Environment Variables That Make or Break It

| Variable | Value | Effect |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0:11434` | Listens on all network interfaces so LAN devices can reach it |
| `OLLAMA_CONTEXT_LENGTH` | `16384` | Context window size; the default 4096 rejects large requests (Pitfall 1) |

### Autostart at Boot: Avoiding Lost Environment Variables

Instead of `brew services`, I use a custom LaunchAgent (`~/Library/LaunchAgents/com.user.ollama.plist`) for autostart. **Key point: hardcode the environment variables directly in the plist file** — because variables set via `launchctl setenv` are lost after a reboot (Pitfall 2).

### Model List

- **qwen3:8b (5.2GB)**: the main chat model, balanced between Chinese and English.
- **deepseek-r1:8b (5.2GB)**: dedicated to deep reasoning.
- **qwen3-chat:8b (custom no-thinking build)**: instant replies for daily use, very fast.
- **nomic-embed-text (274MB)**: text embedding for RAG scenarios.

### Quick Reference for AI & Code Agents

```# Install ollama
brew install ollama
Base URL
Local: http://localhost:11434/v1
LAN: http://<Mac-IP>:11434/v1
No API key required (the server doesn't validate one)
curl http://localhost:11434/v1/chat/completions

-H "Content-Type: application/json"

-d '{"model":"qwen3:8b","messages":[{"role":"user","content":"hi"}]}'
Autostart plist path: ~/Library/LaunchAgents/com.user.ollama.plist
Manual start/stop scripts: ollama-start / ollama-stop (in ~/bin, already on PATH)```bash

### Hands-On Experience: Speed, Memory & Model Choice

#### Measured Speed (Same Greeting)

| Model | Time | tokens | Notes |
|---|---|---|---|
| qwen3-chat:8b (no-thinking) | 1.2s | ~20 | Recommended for daily chat |
| qwen3:8b (default thinking) | 27.5s | 100+ | Even simple questions require thinking first |
| qwen3:8b (inside AtomCode) | 12s | 14.75K | plan mode input carries ~14K context |
| deepseek-r1:8b | 3m51s | 8.99K | Reasoning model; most tokens are thinking process |

Key takeaway: **the model's thinking mode is the biggest time killer**. The Qwen3 series has thinking enabled by default (responses carry a reasoning field), and even a "what's the weather today" query ponders for half a minute; with it disabled, the same input returns in 1.2s — about 22× faster. deepseek-r1:8b is a pure reasoning model, so slowness is a feature, not a bug — reserve it for deep math, logic, and code work.

#### Memory Behavior (The Critical 16GB Experience)

- The ollama service uses only ~34MB when idle; the memory pressure graph stays green
- **Lazy model loading**: nothing loads until called; the 5.2GB loads on demand and pressure turns yellow
- Models auto-unload after 5 minutes idle (keep_alive default) and memory returns to normal
- Conclusion: the service can live resident from boot with zero burden, perfectly meeting the "green when idle, yellow when in use" requirement

#### Model Selection Rules for 16GB

- **7-8B models at Q4 quantization (~5GB)**: the sweet spot for both speed and memory
- **14B (~9GB)**: runs but is slow, and memory is tight on 16GB
- **32B+**: forget it — the KV cache won't fit, and paging to disk makes it unusably slow

#### Hard-Learned Lesson: Big Editor + Model = Swap Disaster

I opened my entire home directory in Zed (7GB) and then loaded the model (7.7GB), which blew past 16GB: swap consumed 5.2GB and inference was dragged from 30 seconds to 4 minutes. **Close memory-hungry apps before running local models** — that's the law of physics on a 16GB machine.

#### Quick Reference for AI & Code Agents (cont.)

- Yellow memory pressure = model loading, perfectly normal
- Close memory hogs like Zed/browser before calling
- Models auto-unload after 5 minutes idle; no manual cleanup needed
- ollama keeps only one model resident at a time; switching reloads automatically

### Pitfall Checklist

#### Pitfall 1: num_ctx Defaults to 4096 — Large Requests Get a 400

- **Symptom**: a request of 8688 tokens fails with `exceed_context_size_error (n_ctx=4096)`.
- **Cause**: the ollama server defaults to a 4096 context; if the client doesn't pass num_ctx, that default applies.
- **Fix**: set `OLLAMA_CONTEXT_LENGTH=16384` (the 16GB balance point) and restart the service.
- **Verification**: send a request with 4096+ tokens; if it no longer errors, the fix is live.

#### Pitfall 2: launchctl setenv Lost on Reboot

- **Symptom**: after a reboot, LAN listening and the 16384 context both silently revert to defaults.
- **Cause**: `setenv` sets session-level environment variables that don't survive a reboot.
- **Fix**: put the environment variables in the LaunchAgent plist's `EnvironmentVariables` field so they take effect permanently.

#### Pitfall 3: Qwen3 Thinking Mode Is On by Default

- **Symptom**: even simple questions take 30s+, and responses carry a reasoning field.
- **Cause**: the Qwen3 series defaults to `enable_thinking=true`.
- **Fix**: the PARAMETER in a Modelfile doesn't support `enable_thinking` / `think` (tested — it reports unknown parameter); you must copy the original TEMPLATE, replace the think-toggle branch at the last user message with a hardcoded `/no_think` injection, then create it as a no-thinking model.
- **⚠️ Note**: the template ends with a range-closing block; omitting it raises `template error: unexpected EOF`.

#### Pitfall 4: AtomCode's Context Window Is Only a UI Guess

- Entering 8192/16384 in the UI is only the client's estimate; what actually takes effect is the server-side `num_ctx`.
- A mismatch can falsely report "near limit" or even show 107% overage, while the actual request succeeds.
- When adjusting configuration, the server side wins.

#### Pitfall 5: Embedding Models Can't Chat

- Calling nomic-embed-text through the chat endpoint reports `does not support chat`.
- Embedding models only accept `/v1/embeddings` and return 768-dimensional vectors; don't pick it in a chat UI.

#### Quick Reference for AI & Code Agents (cont.)

```# Verify the context takes effect (send a >4096-token request; OK if it doesn't error)
curl http://localhost:11434/v1/chat/completions \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"<大段文本>"}]}'
Check currently loaded models and residency
curl http://localhost:11434/api/ps
Embedding (for embedding models only)
curl http://localhost:11434/v1/embeddings

-d '{"model":"nomic-embed-text","input":"要向量化的文本"}'```bash

**Next article preview**: a detailed walkthrough of configuring the LaunchAgent plist file, writing the start/stop scripts, and a demo of calling the local OpenAI-compatible API from AtomCode and scripts.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/ollama-lan-openai-api-mac.html
