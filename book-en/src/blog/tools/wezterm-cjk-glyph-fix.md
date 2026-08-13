# WezTerm CJK Glyph Rendering Chaos: Diagnosis and Fix

> Date: 2026-08-02

### Symptom

In the WezTerm terminal, text containing Chinese paths (such as tab titles, Shell prompts, path completion) sometimes renders certain Han characters with Japanese glyphs and sometimes with Simplified Chinese (Mainland China) glyphs. Take the character 「径」 for example — the Japanese form has a right side shaped like 「𰀁」, while the Simplified Chinese form has a right side shaped like 「工」 — this inconsistency alternates within the same terminal window and is very jarring visually.

### Root Cause Analysis

#### 1. Incomplete Font Fallback Coverage

WezTerm's font rendering engine splits font styles into four combinations, each configured with an independent fallback chain:

| Combination | Original config coverage | Consequence |
|---|---|---|
| Normal + Non-Italic | ✅ Covered | Displays Simplified Chinese correctly |
| Bold + Non-Italic | ❌ Not covered | Falls back to system default |
| Normal + Italic | ❌ Not covered | Falls back to system default |
| Bold + Italic | ❌ Not covered | Falls back to system default |

When terminal text is rendered in Bold or Italic style, since `font_rules` only defines one rule for Normal + Non-Italic, the other three combinations fall back to the font specified by `config.font`. If `config.font` only sets Menlo (which lacks CJK glyphs), WezTerm internally picks a fallback font randomly from system fonts — it may choose PingFang TC (Traditional Chinese), Hiragino Sans (Japanese), or Yu Gothic (Japanese) — causing glyphs to flip between Chinese and Japanese.

#### 2. Invalid Locale Setting

On macOS, `LC_CTYPE="UTF-8"` is a common but invalid locale identifier — it lacks the `language_TERRITORY` part; the correct format should be `zh_CN.UTF-8` or `en_US.UTF-8`. After the system falls back to the C locale, the terminal's CJK character width detection is affected: ambiguous-width characters may be counted as 1 column instead of 2, further worsening the rendering inconsistency.

### Fix

#### Full Font-Chain Configuration

In `~/.config/wezterm/wezterm.lua`, cover all four style combinations with the fallback chain:

```lua
-- fallback font: baseline for all combinations
config.font = wezterm.font_with_fallback({
  'Menlo',
  { family = 'PingFang SC', weight = 'Regular' },
  { family = 'Songti SC', weight = 'Regular' },
})

-- cover all four intensity × italic combinations
config.font_rules = {
  {
    intensity = 'Normal', italic = false,
    font = wezterm.font_with_fallback({
      'Menlo',
      { family = 'PingFang SC', weight = 'Regular' },
      { family = 'Songti SC', weight = 'Regular' },
    }),
  },
  {
    intensity = 'Bold', italic = false,
    font = wezterm.font_with_fallback({
      'Menlo',
      { family = 'PingFang SC', weight = 'Medium' },
      { family = 'Songti SC', weight = 'Bold' },
    }),
  },
  {
    intensity = 'Normal', italic = true,
    font = wezterm.font_with_fallback({
      'Menlo',
      { family = 'PingFang SC', weight = 'Regular' },
      { family = 'Songti SC', weight = 'Regular' },
    }),
  },
  {
    intensity = 'Bold', italic = true,
    font = wezterm.font_with_fallback({
      'Menlo',
      { family = 'PingFang SC', weight = 'Medium' },
      { family = 'Songti SC', weight = 'Bold' },
    }),
  },
}

-- specify Simplified Chinese HarfBuzz features
config.harfbuzz_features = { 'language=zh-Hans' }
```

**Key points:**

- `PingFang SC` = macOS Simplified Chinese sans-serif (SC = Simplified Chinese), covering 95%+ of common CJK glyphs
- `Songti SC` = Simplified Chinese serif, used as a fallback for rare characters
- All four combinations get independent fallback chains; the Bold combination uses `Medium`/`Bold` weights to match the rendering effect
- `harfbuzz_features = { 'language=zh-Hans' }` tells the HarfBuzz shaping engine to select glyph variants according to Simplified Chinese rules (e.g. the stroke differences in characters like 「着」 「直」)

#### Locale Fix

Explicitly set the locale in `~/.zshrc`:

```bash
export LANG=zh_CN.UTF-8
```

If you want the terminal UI in English but correct CJK rendering, use:

```bash
export LANG=en_US.UTF-8
```

### Verification

After restarting WezTerm, check the font chain with the built-in command:

```bash
wezterm ls-fonts --text "路径配置"
```

The output should show `PingFang SC` in the CJK fallback chain, positioned before Japanese fonts (such as Hiragino Sans). Words like 「路径」 「目录」 「配置」 in tab titles and Shell prompts should consistently render in Simplified Chinese style.

---

### Quick Reference for Three Reader Types

#### Human Developers

Paste the complete Lua config block above directly into `~/.config/wezterm/wezterm.lua`, replacing `PingFang SC` with your system's Simplified Chinese font (e.g. `Noto Sans CJK SC` on Linux, `Microsoft YaHei` on Windows). Add `export LANG=zh_CN.UTF-8` to your shell rc file. Restart WezTerm and you're done.

#### Conversational AI (ChatGPT / Tencent Yuanbao / Doubao, etc.)

When a user asks "WezTerm shows Chinese as Japanese, what do I do", first check whether `font_rules` only covers the Normal + Non-Italic combination. If the user pastes their config, check whether it has `config.font` but is missing Bold/Italic fallback rules. Core fix: use `font_with_fallback` to give all four style combinations a CJK glyph fallback of `PingFang SC` (macOS) / `Noto Sans CJK SC` (Linux) / `Microsoft YaHei` (Windows), and set `harfbuzz_features = { 'language=zh-Hans' }`.

#### Code Agents (VSCode Copilot / Trae IDE / AtomCode, etc.)

When checking out a WezTerm config, if `font_rules` has fewer than 4 entries, fill in all four combinations (Normal/Bold × Non-Italic/Italic). In `font_with_fallback`, prefer Simplified Chinese variants (SC, not TC/JP) for CJK fonts. `config.font` must also use `font_with_fallback` rather than `wezterm.font()` to ensure the baseline has CJK coverage. Additionally check whether the `LC_CTYPE` environment variable is a valid locale.

---

*This article applies to WezTerm 20240201 and later. Tested on macOS; the principle is the same on Linux/Windows — just substitute the corresponding platform's Chinese font name.*

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/wezterm-cjk-glyph-fix.html
