<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# egui CJK Rendering Sits Too High: A FontTweak Baseline Alignment Fix Log

> Date: 2026-08-05

## 1. Trigger Scenario: Chinese "Floats" in a Log Viewer

I wrote a log viewer with Rust + egui (eframe) for a KeePass sync daemon. The logs contain both English and Chinese content (for example, the file path "密码数据库"). The first time I ran it, I noticed: **English is fine, but the Chinese text sits too high overall** — the CJK glyphs look like they are "floating" above the English baseline, and on the same line the Chinese and English do not share a baseline, which makes the layout jarring.

Environment: macOS (Apple Silicon arm64), Rust 1.81+ (host 1.96), eframe 0.31 (egui 0.31), monospace font for rendering logs.

## 2. Tracing the Fallacy: The Problem Is Not "Which Font to Pick", It's "Font Metrics"

Conclusion first: **this is a layout deviation caused by inconsistent metrics between the fallback font and the primary font. The root cause lies in egui's glyph-placement logic and has little to do with which CJK font you choose.**

The reasoning path:

1. egui's default fonts (Ubuntu-Light / UbuntuMono) **do not contain CJK glyphs**, so rendering Chinese directly produces tofu boxes □.
2. The conventional fix is therefore to manually load the system CJK font (PingFang.ttc on macOS), insert it into `FontDefinitions::font_data`, and append it to the end of the `Proportional` / `Monospace` families as a **fallback font**.
3. During layout: Latin characters hit the primary font, Chinese characters hit the fallback font. The **metrics of the two fonts are not consistent** (ascent / descent / em-box height all differ), and the glyphs are placed according to each font's own metrics, so the baselines are not aligned — and the CJK glyphs end up sitting too high overall.
4. Common trial-and-error: change the font, adjust line height, change the font size — none of it works, because none of it touches the real switch. The real switch is **`FontTweak`** exposed by egui: give the fallback font a vertical offset and push the CJK glyphs back onto the baseline shared with the English text. The fix is a single change, a single line of code; the complete code and the tuning method are given below.

## 3. Source Verification: Two Lines of Changes Fix the Problem

First, the "before fix" version — the one where Chinese sits too high. The font-loading function looks like this (problem reproduced):

```rust
// Before fix: CJK sits too high overall
fn install_cjk_fonts(ctx: &egui::Context) {
    let bytes = std::fs::read("/System/Library/Fonts/PingFang.ttc").unwrap();
    let mut fonts = egui::FontDefinitions::default();
    // As of egui 0.31 the value type of font_data is Arc<FontData>, needs .into()
    fonts.font_data
        .insert("cjk".to_owned(), egui::FontData::from_owned(bytes).into());
    for family in [egui::FontFamily::Proportional, egui::FontFamily::Monospace] {
        fonts.families.entry(family).or_default().push("cjk".to_owned());
    }
    ctx.set_fonts(fonts);
}
```

The fix only needs one change: set `tweak` on the `FontData` before inserting it:

```rust
// After fix: CJK aligned to the English baseline
let mut cjk = egui::FontData::from_owned(bytes);
cjk.tweak = egui::FontTweak {
    y_offset_factor: 0.2, // CJK glyph downward offset = font size × 0.2 (positive is screen-down)
    ..Default::default()
};
fonts.font_data.insert("cjk".to_owned(), cjk.into());
```

`FontTweak` has four fields; only one is used here:

| Field | Semantics |
|---|---|
| scale | Overall scale ratio, default 1.0 |
| y_offset_factor | Vertical offset, **as a proportion of font size** (0.2 = font size × 0.2) |
| y_offset | Vertical offset, absolute points |
| baseline_offset | Baseline offset, absolute points |

Why it works: "Chinese sits too high" means the glyphs need to be moved **downward** overall, and the positive direction happens to be screen-down; `0.2` is an empirically tuned value under which the English and Chinese align well at a 12pt monospace size. Choosing `y_offset_factor` over `y_offset` is deliberate: it scales with the font size, so if the font size is changed later the offset follows automatically and never needs re-tuning. Verified environment: macOS arm64 / rustc 1.96 (project MSRV 1.81) / eframe 0.31 / PingFang.ttc.

## 4. Bottom-Line Conclusion

**In one sentence**: after egui manually loads the system CJK font, the Chinese text sits too high overall; the root cause is that the fallback font's metrics are inconsistent with the primary font's and the glyphs are not aligned to a shared baseline. The fix is to set `y_offset_factor` on `FontData.tweak` to push the CJK glyphs down — no font change required.

**Tuning mnemonic**: too high → increase (0.2 → 0.25 / 0.3); too low → decrease (0.2 → 0.15); step by 0.05 each time, change only one constant at a time.

### Quick reference for human developers

```rust
let mut cjk = egui::FontData::from_owned(bytes);
cjk.tweak = egui::FontTweak { y_offset_factor: 0.2, ..Default::default() };
fonts.font_data.insert("cjk".to_owned(), cjk.into());
```

Three things to note: as of 0.31 the value of `font_data` is `Arc<FontData>` and needs `.into()`; `PingFang.ttc` is a font collection and egui takes index 0, which works; the recommended font fallback chain is PingFang → Hiragino Sans GB → Arial Unicode, degrading one at a time.

### Quick reference for conversational AI

Paste the following directly to ChatGPT / 腾讯元宝 / 豆包:

> I manually loaded the system CJK font as a fallback font in Rust egui (eframe 0.31), and now the Chinese text sits higher than the English text overall, with misaligned baselines. I already know that FontTweak's y_offset_factor can apply a vertical offset proportional to the font size. Please give me: 1) the complete function that loads PingFang and sets y_offset_factor; 2) how to adjust the parameter when the text is too high / too low.

### Quick reference for code Agents (Copilot / Trae / AtomCode, etc.)

Locating clues: `egui::FontTweak` (fields scale / y_offset_factor / y_offset / baseline_offset), `egui::FontData::tweak`, `egui::FontDefinitions::font_data` (as of 0.31 the value is `Arc<FontData>`). The fix point is after loading the font and before inserting into `font_data`, where you set the tweak; if the font size is being changed, prefer the proportional `y_offset_factor` over the fixed-point `y_offset` so the offset adapts to the font size.

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/egui-cjk-rendering-fonttweak.html
