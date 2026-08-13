# 128 TTS Voice Lines into a Red Alert Engine: Qwen-TTS + Neil Batch Synthesis

> Date: 2026-08-07

### 1. Goal

Give the Red Alert engine a reproducible bilingual commander voice: 64 EVA events × two languages = 128 WAVs, all batch-synthesized by TTS and injected into the browser's OPFS. The principles: code committed, keys never on disk, regenerate anytime.

### 2. Why Qwen-TTS's Neil

We surveyed voices across three Aliyun TTS APIs:

- **CosyVoice / Qwen-Audio-TTS**: system voices are all longan/loong series; downloaded the 1000+ base-voice Excel files and searched — no Neil;
- **MiniMax**: system voices use `male-qn-*` / `female-*` IDs, no Neil;
- **Qwen-TTS**: **has Neil** (voice name "阿闻", male news anchor, 10 languages incl. zh/en), supported by `qwen3-tts-instruct-flash`.

Neil's news-anchor voice suits "commander announcements", and `instructions` control pacing/emotion — one instruction per language.

### 3. Batch Generation Script

`scripts/tts-generate.mts` (TypeScript, tsc-checked):

```ts
const MODEL = "qwen3-tts-instruct-flash";
const VOICE = "Neil";
const INSTRUCTIONS = {
  en: "News anchor style, steady pace, calm and neutral emotion.",
  "zh-CN": "新闻播报风格，语速适中，吐字清晰，情感沉稳中性。",
};
```

Flow: read `design/voice/{lang}/event_voice_mapping.json` → call the DashScope API per line → download wav into `audio/voice/{lang}/EVA_*.wav`. Supports `--lang / --event / --force` for incremental regeneration.

### 4. Keys Never Touch Disk

- API key comes only from the environment (`process.env.DASHSCOPE_API_KEY`); no hardcoding in the script;
- `.gitignore` gained `.env` / `.env.*` (keeping `.env.example`) so `git add .` can't commit secrets;
- Request headers use a runtime `Bearer ${API_KEY}`; logs never echo the key.

Verified: searching all git-tracked files for the real key prefix → zero matches.

### 5. How Voice Reaches the Engine

- Output: `audio/voice/{en,zh-CN}/EVA_1MinuteRemaining.wav` etc., 128 files;
- The engine's EVA announcer plays via `eva.ini` `[DialogList]` (Allied=cevaXXX) → vanilla wav from mix;
- The engine consumption side of custom voice (event trigger → read design/voice mapping → play custom wav) is follow-up wiring; vanilla voice serves as fallback for now.

### 6. Injection Manifest Fix

`gen-inject-page.mjs` originally collected only files at the `audio/` root — it did not recurse into `audio/voice/{lang}/`, so new voice lines were never injected. Changed to recursive collection (`collectFiles` walks subdirectories), and filtered `.DS_Store` (macOS junk files caused injection 404s).

### 7. Conclusion

The full pipeline for 128 TTS lines: voice research (Neil) → batch script (.mts + env key) → generate wav → inject (recursive manifest) → engine wiring (pending). Core principles: **reproducible code, keys never on disk, output regenerable anytime** — this skeleton also serves future voice iteration and engine wiring.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-tts-voice-batch.html
