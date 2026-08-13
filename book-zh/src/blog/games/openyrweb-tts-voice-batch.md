<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 128 条 TTS 语音注入红警引擎：Qwen-TTS + Neil 音色批量合成

> 日期：2026-08-07

### 1. 目标

给红警引擎配一套可复现的中英双语副官语音：64 条 EVA 事件 × 中英两版 = 128 条 WAV，全部由 TTS 批量合成，注入浏览器 OPFS。要点是「代码入库、Key 不落盘、随时可重生成」。

### 2. 为什么用 Qwen-TTS 的 Neil

调研了阿里云三个 TTS API 的音色：

- **CosyVoice / Qwen-Audio-TTS**：系统音色全是龙安/loong 系列；下载 1000+ 基础音色 Excel 全文搜过——没有 Neil；
- **MiniMax**：系统音色是 `male-qn-*` / `female-*` 格式，无 Neil；
- **Qwen-TTS**：**有 Neil**（音色名「阿闻」，男新闻主播，中英日韩等 10 语种），`qwen3-tts-instruct-flash` 支持。

Neil 的新闻主播声线适合「副官播报」风格，且支持 `instructions` 控制语速/情感，中英文本各配一条指令。

### 3. 批量生成脚本设计

`scripts/tts-generate.mts`（TypeScript，tsc 检查）：

```ts
const MODEL = "qwen3-tts-instruct-flash";
const VOICE = "Neil";
const INSTRUCTIONS = {
  en: "News anchor style, steady pace, calm and neutral emotion.",
  "zh-CN": "新闻播报风格，语速适中，吐字清晰，情感沉稳中性。",
};
```

流程：读 `design/voice/{lang}/event_voice_mapping.json` → 逐条调 DashScope 接口 → 下载 wav 写入 `audio/voice/{lang}/EVA_*.wav`。支持 `--lang / --event / --force` 增量重生成。

### 4. Key 永不落盘

- API Key 只从环境变量读取（`process.env.DASHSCOPE_API_KEY`），脚本内无硬编码；
- `.gitignore` 增加 `.env` / `.env.*`（保留 `.env.example`），防止 `git add .` 误提交；
- 请求头用运行时拼接的 `Bearer ${API_KEY}`，日志不回显 Key。

实测检查：全仓库 git 跟踪文件搜真实 Key 前缀 → 零匹配。

### 5. 语音如何接入引擎

- 生成结果：`audio/voice/{en,zh-CN}/EVA_1MinuteRemaining.wav` 等 128 条；
- 引擎的 EVA 副官播报走 `eva.ini` 的 `[DialogList]`（Allied=cevaXXX）→ 从 mix 读原版 wav；
- 自定义语音的引擎消费端（事件触发 → 读 design/voice mapping → 播自定义 wav）是后续接线工作，当前原版语音兜底。

### 6. 注入清单递归修复

`gen-inject-page.mjs` 原本只收集 `audio/` 根目录文件，不递归 `audio/voice/{lang}/` 子目录——新增语音不会被注入。改成递归收集（`collectFiles` 遍历子目录），并过滤 `.DS_Store`（macOS 垃圾文件会导致注入 404）。

### 7. 结论

128 条 TTS 语音的完整流水线：调研音色（Neil）→ 批量脚本（.mts + env Key）→ 生成 wav → 注入（递归清单）→ 引擎接线（待办）。核心原则：**代码可复现、Key 不落盘、输出随时重生成**——这套骨架同时服务了后续的语音迭代与引擎接线。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-tts-voice-batch.html
