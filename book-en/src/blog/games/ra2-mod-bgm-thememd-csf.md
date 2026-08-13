<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# BGM Mounting and Display-Name Translation for RA2 MODs

> Date: 2026-08-02

### Trigger Scenario

When adding background music to a Red Alert 2 expansion MOD (this article uses "Yellow Alert" as an example), you run into two problems:

1. The MOD ships 3 BGM tracks (1 for the main menu, 2 in-game, one of them Frank Klepacki's "Mud"), but once placed in the browser, there's no sound on the main menu or in-game;
2. Once the music does play, the music selection list shows raw keys like `01 - THEME:YellowBattle1` instead of "Yellow Alert - In Game".

Both problems stem from the engine's music chain:

- Music specs (`MusicSpecs`) are read from the `[Themes]` section of `thememd.ini`; each theme has `Sound`/`Normal`/`Repeat`;
- At playback, `Music.getMp3File()` lowercases the theme name and appends `.mp3` (e.g. `THEME:YellowBattle1` → `yellowbattle1.mp3`), loading from the `music/` folder at the OPFS root;
- The music list UI (`MusicJukebox`) displays `i.get(e.name)` — it looks up the theme name as a CSF translation key, and a missing key returns the raw string.

So "can't hear it" and "shows raw key" are two independent but same-origin mechanism problems.

### Tracing the Misconceptions: Three Assumptions Taken for Granted

#### Assumption 1: "Dropping the mp3 into the browser filesystem is enough for it to play"

In reality OpenYRWeb's music playback is a complete chain:

- The theme table must be declared in the `[Themes]` section of `thememd.ini` (`[YellowBattle1] Sound=YellowBattle1 Normal=yes Repeat=yes`) before the engine considers the theme to exist;
- The mp3 must be in the OPFS root `music/` directory and named = lowercase theme Sound + `.mp3` (`yellowbattle1.mp3`).

The MOD is from the original RA2 platform; its music is defined in the original `theme.ini`/art system (or has no md variant at all), and the YR-only engine reads only `thememd.ini` — the mismatch means silence.

#### Assumption 2: "Just write a Chinese Name straight into thememd.ini"

The result is mojibake or raw keys in the list — `MusicJukebox` displays via `i.get(e.name)` (a CSF translation-key lookup), and a missing key returns the raw string; worse, `readString` decodes byte-by-byte as ASCII by default, so UTF-8 Chinese gets shredded.

The correct approach is to keep `THEME:YellowBattle1`-style keys as Name and write "Yellow Alert - In Game" into the corresponding key of `ra2md.csf`.

#### Assumption 3: "mmx/mix mounting is complicated"

Actually, package the MOD's music theme table as `yellowmusic.mmx` (a single mmx archive) and put it in `mods/yellow-alert/`; the engine auto-mounts it when loading the mod and overrides the original theme table — the key point is the file must go into the `mods/yellow-alert/` directory in OPFS (standalone overrides mix), not just anywhere.

### Source-Code Verification and Actionable Conclusions

The verification points are all in the engine source:

- `engine/sound/MusicSpecs.ts.js` (parses the `[Themes]` section of thememd.ini, `Sound`/`Normal`/`Repeat` fields)
- `engine/sound/Music.ts.js` (`getMp3File()` builds `lowercase sound + ".mp3"`, read from `rfs.findDirectory("music")`)
- `engine/sound/MusicJukebox.ts.js` (`i.get(e.name)` display translation)
- `data/CsfFile.ts.js` (CSF key-value parsing, `' LBL'` magic number + UTF-16LE inverted values)

#### The landing flow has four steps

1. **Custom theme table**: create `thememd.ini` and declare 3 themes in the `[Themes]` section:

```[YellowMenu]
Sound=YellowMenu
Normal=yes
Repeat=no

[YellowBattle1]
Sound=YellowBattle1
Normal=yes
Repeat=yes

[YellowBattle2]
Sound=YellowBattle2
Normal=yes
Repeat=yes```ini

Package it as `yellowmusic.mmx` and put it in `mods/yellow-alert/`.
2. **Prepare the audio files**: transcode the 3 mp3s at 22050Hz/96k and inject them into the OPFS `music/` directory (named with lowercase theme Sound: `yellowmenu.mp3`/`yellowbattle1.mp3`/`yellowbattle2.mp3`).
3. **Add the Chinese display names**: display names go through CSF translation — set the value of the `THEME:YellowBattle1` key to "Yellow Alert - In Game", `THEME:YellowBattle2` to "Frank Klepacki - Mud", and inject them into `ra2md.csf` (a complete CSF based on cd-overrides; append entries in the engine's same format: `' LBL' | flags | nameLen | name | ' RTS' | charCount | UTF-16LE inverted bytes`).
4. **Verify**: the main menu plays `YellowMenu`, in-game plays `YellowBattle1`/`YellowBattle2`, and the music list shows the Chinese track names.

**Note**: the mod's `thememd.ini` overrides the original theme table wholesale; if you want to keep the original music, you must also declare the original themes in your custom theme table.

### Lessons Learned

The three essentials of BGM are all indispensable — **thememd.ini declares the themes, the `music/` directory holds the same-named mp3s, and CSF provides the display names**; if you can't hear anything, check the first two, and if keys show up in the list, check the third. All three are data-layer problems, unrelated to the engine's rendering.

---

#### Human Developers Quick Reference: Four-Step Self-Check

1. The theme table is in the thememd.ini `[Themes]` section (Sound/Normal/Repeat), packaged as an mmx and placed in `mods/yellow-alert/`;
2. The mp3s are in the OPFS root `music/`, named = lowercase theme Sound + `.mp3` (yellowbattle1.mp3);
3. Display names go through CSF: keep the `THEME:xxx` key as Name and write the Chinese text into the matching key of ra2md.csf;
4. 22050Hz/96k transcoding is recommended for compatibility with the engine's reading.

#### Conversational AI Quick Reference: Question Template

"OpenYRWeb RA2 MOD music doesn't play / the music list shows THEME:xxx — how to fix?" The answer should be: the theme table is in the thememd.ini `[Themes]` section (package it as an mmx and mount it), the mp3s are in OPFS `music/` named = lowercase Sound + `.mp3`; a list showing raw keys means the CSF translation is missing — add the `THEME:xxx` key-value pair to ra2md.csf (`' LBL'` format, UTF-16LE inverted).

#### Code Agents Quick Reference: Key Anchors

- `engine/sound/MusicSpecs.ts.js` (theme parsing)
- `engine/sound/Music.ts.js` (getMp3File name building)
- `engine/sound/MusicJukebox.ts.js` (i.get display)
- `data/CsfFile.ts.js` (CSF read/write)

After making changes, inject OPFS and refresh the page; music files go in the root `music/`, mod files in `mods/yellow-alert/`.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/ra2-mod-bgm-thememd-csf.html
