# Reverse-Engineering the RA2/YR CSF File Format

> Date: 2026-08-02

### Trigger Scenario

When building a Chinese UI for a Red Alert 2 MOD (using Yellow Alert as the example here), you run into three kinds of problems:

1. Writing a Chinese `Name` directly into `thememd.ini` shows as mojibake (like `é»è²è­¦æ`), because the engine's `readString` decodes byte-by-byte as ASCII by default, and UTF-8 Chinese gets mangled;
2. The music list shows the raw key name `THEME:YellowBattle1` instead of "Yellow Alert - In-Game", because the list UI looks up CSF translation keys (`i.get(e.name)`), and a missing key returns the original string;
3. The whole UI is in Traditional Chinese when you want Simplified — the engine auto-detects the language from the `THEME:Intro` value ("開場"→zh-TW, "开场"→zh-CN), and whatever language is stored in the CSF is what gets displayed.

All three point to one core: the **binary format of CSF (Civilization String File)**. This article fully reverse-engineers the format and provides reproducible code from parsing and editing to re-serializing.

### Tracing the Misconceptions: Three Assumptions Taken for Granted

**Assumption 1**: "CSF is just a text file, so editing the strings is enough." In fact, CSF is binary: a header of 6 u32s (the first two are fixed — 0x02 for the version and 0 for reserved — and the 3rd is the entry count), followed by each entry: `' LBL'` (4-byte magic 0x4c424c20) | flags(u32) | nameLen(u32) | name bytes | value area. The value area exists only when bit0 of flags is set: `value magic(u32)` | `charCount(u32)` | value bytes.

**Assumption 2**: "The value is plain UTF-16LE text." In fact, the value bytes are UTF-16LE with **every byte bit-inverted** — `chr((~b0 & 0xff) | ((~b1 & 0xff) << 8))` is needed to recover the character; when writing, you also have to invert the high and low bytes of each code point.

**Assumption 3**: "Everything after the value area is the same for all entries." In fact, when the value magic is `WRTS` (0x53545257), the value bytes are followed by `elen(u32)` + extra bytes (extra data, such as language-related additional information); `' RTS'` (0x53545220) has no extra. When serializing, **elen must go after the value bytes** — I once put it before the value, which made the engine throw `Invalid typed array length`, parse out of bounds, and fail to initialize the game.

Also, `THEME:Intro` is the language-detection anchor: value "開場"→ChineseTW, "开场"→ChineseCN — this is what the engine's `CsfFile.autoDetectLocale()` bases its judgment on; changing the language essentially means changing this key's value.

### Source-Code Verification and Implementation

The verification points are all in the engine source:

- `data/CsfFile.ts.js`'s `parse()` (' LBL' magic, flags, nameLen, inverted-value reading, WRTS extra data)
- `autoDetectLocale()` (switches to a CsfLanguage based on the `THEME:Intro` value)
- `getIsoLocale()` (returns `zh-CN`/`zh-TW`, etc.)
- `gui/screen/options/component/MusicJukebox.ts.js` (`i.get(e.name)` looking up the CSF translation)

Implementation proceeds in five steps:

1. Parse the original `ra2md.csf` (332973 bytes, 5211 entries) to get the full `{name, flags, value, vm, extra}` entry set;
2. Use OpenCC (t2s) to convert all values from Traditional to Simplified Chinese (4216 entries change), and `THEME:Intro` automatically becomes "开场", triggering the zh-CN locale;
3. Append theme translation entries `THEME:YellowBattle1 = 黄色警戒 - 游戏内` and `THEME:YellowBattle2 = Frank Klepacki - Mud` (value magic ' RTS', no extra);
4. Re-serialize per `' LBL' | flags | nameLen | name | vm | charCount | inverted value bytes | [elen+extra]` and write to `mods/yellow-alert/ra2md.csf`;
5. After injecting into the browser OPFS (this file overrides the cd-overrides version) and refreshing the page, verify `isoLocale=zh-CN`, a fully Simplified-Chinese UI, and the music list showing Chinese track names.

Lessons learned: CSF is a binary format of "inverted UTF-16 + magic-number chunks"; before touching it, confirm four things against the engine source — the 6-u32 header, the ' LBL' entry magic, the inverted value bytes, and the location of WRTS's extra; after editing, always re-parse it with the engine's own CsfFile for a self-check — don't just eyeball it.

---

#### Human Developers Quick Reference

Four-step self-check:

1. Header of 6 u32s, the 3rd is the entry count;
2. Each entry is `' LBL'(0x4c424c20) | flags | nameLen | name | vm | charCount | value`;
3. Value bytes are UTF-16LE with per-byte inversion — remember to invert when writing;
4. `THEME:Intro` decides the language ("开场"→zh-CN), and `Name:XXX`/`THEME:XXX` are the translation keys.

#### Conversational AI Quick Reference

Question template: "How do I make RA2 CSF display Chinese / fix the mojibake?" The answer should be: CSF is binary — entries start with ' LBL' and values are stored as inverted UTF-16LE; writing Chinese directly into an ini gets mangled by ASCII decoding; the UI language is decided by the THEME:Intro value (开场=Simplified); music/unit names go through CSF translation keys.

#### Code Agents Quick Reference

Key anchors:

- `data/CsfFile.ts.js` (parse/autoDetectLocale/getIsoLocale)
- `gui/screen/options/component/MusicJukebox.ts.js` (i.get displays the translation)
- `data/IdxFile.ts.js` (similar chunked-reading reference)

Parse with a struct.unpack_from loop; when serializing, note that WRTS's elen goes after the value bytes; after editing, re-parse with CsfFile to self-check.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/ra2-yr-csf-format-reverse.html
