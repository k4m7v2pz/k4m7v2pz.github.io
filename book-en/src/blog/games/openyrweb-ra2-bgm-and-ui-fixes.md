# Porting an RA2 MOD to OpenYRWeb: BGM Mounting and UI Overflow Fixes

> Date: 2026-08-02

### Trigger Scenario and Tracing the Misconceptions

When porting the "Yellow Alert" expansion MOD of Red Alert 2 into the OpenYRWeb browser engine, two subtle problems appeared.

**First:** the MOD ships 3 BGM tracks (1 for the main menu, 2 in-game, one of them Frank Klepacki's "Mud"), but the original data only has `art.ini`/`rules.ini` (RA2 non-md naming), while the engine is YR-only and reads only `artmd.ini`/`rulesmd.ini`/`thememd.ini` — even though the music files were placed, there is no sound on the main menu or in-game; and even when sound works, the music selection list shows raw keys like `01 - THEME:YellowBattle1` instead of "Yellow Alert - In Game".

**Second:** when playing windowed (not fullscreen), the main menu and freshly-entered gameplay look fine, but as soon as you click on the scene or UI in-game, the bottom command bar and menu buttons end up beyond the browser's visible area and are almost unclickable.

Both problems reproduce reliably on real hardware; after debugging, both point to one main thread: "the data format doesn't match what the engine expects".

### Source-Code Verification and Actionable Conclusions

#### Music problem: missing link and encoding misalignment

The initial assumption was "drop the mp3 into the browser filesystem and it plays". In reality OpenYRWeb's music playback is a complete chain:

1. **Music specs (`MusicSpecs`)** are read from the `[Themes]` section of `thememd.ini`; each theme has `Sound`, `Normal`, `Repeat`.
2. At playback, `Music.getMp3File()` concatenates `lowercase sound + ".mp3"` and loads it from the `music/` folder at the OPFS root.

The MOD is from the original RA2 platform; its art is defined in `art.ini` (a 307KB delta table inside `expand11.mix`), but the engine only reads `artmd.ini`, and the two don't match — so all the exclusive units' rendering collapses and the music goes silent.

The second assumption: "just write a Chinese Name straight into `thememd.ini`". The engine's `readString` decodes byte-by-byte as ASCII by default, so UTF-8 Chinese gets split into mojibake (`é»è²è­¦æ`); and the music list UI (`MusicJukebox`) displays `i.get(e.name)` — it treats Name as a CSF translation key, and a missing key returns the raw string.

#### Resolution problem: misaligned viewport baseline

It looked like an engine rendering bug, but testing showed the external Playwright script takes the window outer size via CDP `Browser.getWindowBounds` (including the title bar; measured 1440×846 vs a visible area of 1440×759, a difference of about 87px) and directly calls `page.setViewportSize`, making the page viewport larger than the browser's visible area; the main menu is DOM-adaptive so it works, but the in-game HUD is pixel-positioned (`x = viewport.width - sidebar width`, `N = viewport.height - command bar height`), so the bottom UI naturally gets pushed outside the visible area.

The verification points are all in the engine source:

- The non-fullscreen branch of `Application.updateViewportSize()` has `Math.min(window.innerWidth, config.viewport.width)` and `Math.max(800, ...)`/`Math.max(600, ...)` minimum clamps.
- `Gui.handleViewportChange` syncs the viewport to the renderer and UiScene.
- `HudFactory.create()` lays out the sidebar and command bar from `uiScene.viewport`.

### Three-Layer Fix Plan

#### 1. Merge and Register Data

Merge the MOD's art table into `artmd.ini` (original 1581 sections + MOD 1705 sections), and register every referenced animation in the `[Animations]` section of `rulesmd.ini` (remember to strip `;%` comments before scanning, so you don't miss keys like `NATorpedoT_A`).

#### 2. Complete Music Chain

Custom `thememd.ini` (example):

```[YellowBattle1]
Sound=YellowBattle1
Normal=yes
Repeat=yes

[YellowBattle2]
Sound=YellowBattle2
Normal=yes
Repeat=yes

[YellowMenu]
Sound=YellowMenu
Normal=yes
Repeat=yes```ini

Package it as `yellowmusic.mmx` and let the engine auto-mount it to override the original theme table. Transcode the mp3s at 22050Hz/96k and inject them into the OPFS `music/` directory.

For display names, switch to CSF translation instead: keep `THEME:YellowBattle1` as the Name key, and write "Yellow Alert - In Game" and "Frank Klepacki - Mud" into `ra2md.csf` (in the engine's CsfFile format: entry = `' LBL' | flags | nameLen | name | ' RTS' | charCount | UTF-16LE inverted bytes`).

#### 3. Fix the Resolution Script

Change it to first measure and cache the browser border delta (title bar height is constant; measured dy=87), then on every poll convert the CDP outer size into the content area size (`cw = w - dx`, keeping the 800×600 lower bound) before syncing it to the page.

### Fix Results and Lessons Learned

After the three fixes, the main-menu and in-game BGM work, the list shows the Chinese track names, and the bottom UI stays fully clickable no matter how the window is stretched.

**Lessons learned:** when porting to a cross-platform engine, "filename variants (md), ini section registration, CSF key translation, and the pixel-positioning baseline" are the four highest-frequency pitfalls; the troubleshooting order should be to match the source-code format first and then change the data — don't suspect the render layer first.

### Quick Reference for Three Kinds of Readers

#### Human Developers: Four-Step Self-Check

1. The engine only reads the md variants (rulesmd/artmd/thememd); RA2 original data needs renaming or merging.
2. Music files must be under the OPFS root `music/`, named = lowercase theme Sound + `.mp3`, and the theme table lives in the `[Themes]` section of `thememd.ini`.
3. In-game bottom UI overflowing = viewport larger than the visible area; check the outer/content conversion (title-bar delta) and mind the engine's 800×600 minimum clamp.
4. List showing raw keys = missing CSF translation; add the key-value pairs to `ra2md.csf`.

#### Conversational AI: Question Templates

- "OpenYRWeb music doesn't play / shows THEME:xxx — how to fix?" The answer should be: the theme table is in the thememd.ini `[Themes]` section, mp3s go in OPFS `music/`, and display names go through CSF key translation.
- "Windowed UI overflows the visible area" The answer should be: CDP returns the outer size, you need to subtract the title bar; the engine has an 800×600 minimum viewport clamp.

#### Code Agents: Key Anchors

- `engine/sound/MusicSpecs.ts` (theme parsing)
- `engine/sound/Music.ts` (getMp3File name building)
- `gui/screen/options/component/MusicJukebox.ts` (i.get display)
- `Application.ts` updateViewportSize (clamping)
- `gui/screen/game/component/Hud.ts` (pixel positioning)

After making changes, re-run `bun run scripts/inject-persist.mjs` to inject OPFS, then refresh the page.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-ra2-bgm-and-ui-fixes.html
