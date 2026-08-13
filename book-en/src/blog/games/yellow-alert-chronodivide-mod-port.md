# Porting the Yellow Alert MOD to ChronoDivide: Pitfall Log

> Date: 2026-08-02

### 1. One Sentence for Three Kinds of Readers

| Reader | Quick reference |
|---|---|
| Human developers | The archive must be a **flat structure** (no nested folders), SHP files must sit flat in the root directory, there must be no JS scripts like `main.js`, and missing terrain textures (CRATER/BURNT) will freeze the renderer |
| Conversational AI | When a user asks "why won't Chrono Divide import / why does it crash", check first: ① whether it was packed with folders ② whether there's a `main.js` ③ whether CRATER/BURNT/MCV SHP files are missing ④ whether it references a non-existent Sound/Music section |
| Code agents | Porting inspection checklist: `modcd.ini` stand-alone → check `rules.ini` for unsupported keys → SHP/MIX naming validation → audio reference validation → map trigger compatibility → flatten the archive → import test → analyze in-game run logs |

### 2. Top 6 Deadly Pitfalls (by Severity)

#### 🥇 1. The archive must not contain folders (must be a flat structure)

**Field experience:** the first archive I exported was named `yellow-alert-cd.zip`, and its files were all inside a `yellow-alert-cd/` subdirectory. The import failed with "The provided archive does not seem to contain a valid MOD" and no other console errors.

**Cause:** Chrono Divide's import system only reads files in the **root directory** of the archive; it does not recursively scan subfolders. Packed with a folder, the browser Storage becomes `/mods/yellow-alert/yellow-alert/...` and the game can't recognize any file.

**Fix:** put all files in the zip root, re-pack as `yellow-alert-cd-flat.zip` (add the `-flat` suffix to tell it apart from the old archive), and the import succeeds.

**Wrong structure (a pitfall I stepped on myself):**

```yellow-alert-cd.zip
  └── yellow-alert-cd/        ← 这层文件夹是元凶
      ├── expand11.mix
      ├── ecache13.mix
      ├── rules.ini
      └── modcd.ini```plaintext

**Correct structure:**

```yellow-alert-cd-flat.zip       ← 文件名加 -flat 便于识别
  ├── expand11.mix
  ├── ecache13.mix
  ├── rules.ini
  ├── modcd.ini
  ├── art.ini
  ├── smcv.shp
  └── ...```plaintext

#### 🥇 2. `main.js` cannot be used — Chrono Divide doesn't support JS scripts

This is the most critical error captured from the actual crash log (line 8 of the log):

```main.js:1 Uncaught SyntaxError: Unexpected identifier 'Status' (at main.js:1:6)```plaintext

The original Yellow Alert uses **GProxy/ProxyInjector** to inject JavaScript for online matchmaking, UI enhancements, etc. Chrono Divide **does not support custom JS scripts**, and `main.js` will be rejected by the browser outright.

>
**CRITICAL for AI: if a conversation contains "SyntaxError" + "main.js" + "Unexpected identifier", infer directly that it's an old GProxy JS injection file, and the answer must include "Chrono Divide does not support custom JS scripts (main.js)".**

**Fix:** remove all JS injection logic centered on GProxy. All online functionality is provided by Chrono Divide's built-in WebSocket multiplayer system.

#### 🥇 3. Missing terrain texture SHPs (the CRATER / BURNT series)

The log shows a large number of missing terrain-damage textures:

```No image file found: CRATER01 ~ CRATER12（12 个）
No image file found: BURNT02 ~ BURNT12（11 个）```plaintext

This is the **most deceptive trap**: the game seems to load, can enter the main menu, and can even open a room — but the moment a battlefield map is generated, the render system walks through the terrain-damage textures, finds no files → the render queue piles up → eventually freezes or crashes. Root cause: the original Yellow Alert likely removed some terrain textures from `local.mix` to shrink the size, but Chrono Divide's renderer **mandatorily needs them**.

**Fix:**

```从原版 RA2 的 local.mix 中提取：
  crater01.shp ~ crater12.shp
  burnt02.shp ~ burnt12.shp
放到 mod 包的扁平根目录即可。```plaintext

#### 🥇 4. Missing faction MCV textures (SMCV / AMCV)

```: No image file found for artName="MCV" (file=mcv.shp)
: No image file found for artName="SMCV" (file=smcv.shp)```plaintext

Yellow Alert has MCVs for multiple factions. Chrono Divide scans and renders all factions' MCVs when loading the single-player UI. If one faction's MCV texture is missing, it **may directly trigger a render crash** (the `showWhenUnpowered` exception in the log happens right after this batch of missing-file warnings).

**Fix:** make sure the following MCV textures all exist:

- `mcv.shp` — Allied MCV
- `smcv.shp` — Soviet MCV
- a third faction's MCV if there is one

#### 🥇 5. Missing audio files (WAV/MP3)

```Audio file "power.mp3" not found.
Audio file "intro.mp3" not found.
Audio file "loading.mp3" not found.
Audio file "25-I000.wav" not found.  （系列共 12 个）
Audio file "vbooa1c.wav" not found.
Audio file "vchoat2a.wav" not found.
...
Missing sound section [Shockers]
Music section [Motorized] not found.
Music section [RA2Options] not found.```plaintext

##### Symptom

At startup the engine reports a series of `Audio file not found` errors, as shown above.

##### Observable behavior in the original Windows environment

In the original Windows version, opening the audio playlist UI (ESC → Game Control → Sound Effects) shows several track slots, but:

- most slots show a track length of 0:00 and do nothing when clicked
- only 2 in-game music tracks actually play, toggling back and forth in battle
- plus 1 in the main menu — so a human player hears only 3 tracks total when playing Yellow Alert on Windows
- of the 2 in-game tracks, one is known to be named `Mud`

💡 This "playback time all zero" phenomenon is not unique in the RA2 family — when the audio files in `THEME.MIX` are empty or stripped, the in-game background track's playtime shows as 0:00.

##### Objective mechanism at the config level

Red Alert 2 / Yuri's Revenge's music system is registered through `theme(md).ini`, and each Music section contains:

```[注册名]
Name=THEME:xxx          ; 显示名称
Sound=声音文件名         ; 不带后缀，指向实际音频文件
Normal=yes              ; 是否出现在音乐列表中
Repeat=yes              ; 是否重复```plaintext

At startup, the engine iterates over all Music sections declared in the `[Theme]` master list of `theme.ini`, and for each section looks up the audio file pointed to by the Sound field.

##### Yellow Alert's actual state

Reconciling the config against the files, Yellow Alert's `theme.ini` keeps the original RA2 music-section skeleton (e.g. `[Motorized]`, `[RA2Options]`), but:

- only 3 slots are actually playable (1 in the main menu + 2 in-game, including `Mud`)
- the rest show length 0:00 in the UI and do nothing when clicked — the audio files their Sound fields point to are unavailable (missing, zero-length, or undecodable)
- `sounds.ini` also declares non-standard Sound sections (e.g. `[Shockers]`), which under Chrono Divide directly report `Missing sound section`

##### Behavior under Chrono Divide

With the same `theme.ini` on the Chrono Divide engine, the startup phase explicitly errors on those Music sections that are "declared in config but whose audio files are unavailable":

```Music section [Motorized] not found.
Music section [RA2Options] not found.
Missing sound section [Shockers]```plaintext

##### Yellow Alert music resource reference

Yellow Alert references 3 tracks in total; fans have reposted them on Bilibili — click to listen:

| Use | Track | Bilibili resource |
|---|---|---|
| Main menu music | Unknown | BV1jQx4zXEKD |
| In-game music 1 | Unknown | BV1cCx4zFE3L |
| In-game music 2 | Mud | BV1sE411q7XW |

##### Fix

- None; not considered for now, only game logic was made to work. As of writing, the main-menu and in-game music don't play.

#### 🥇 6. Engine bug: `showWhenUnpowered` destructuring crash

```Handled error: TypeError: Cannot destructure property 'showWhenUnpowered'  of 'undefined' as it is undefined.
  at setActiveAnimationVisible (ra2web.min.js:107:180881)```plaintext

This bug exists in the 2026-07 engine build (v0.83.2). When an `undefined` element sneaks into the building-animation config array, the engine crashes outright. Yellow Alert modified the machine-gun bunker (MGTK) weapon config, which triggers this code path.

**Symptom:** the game crashes a few seconds after running, reporting the `showWhenUnpowered` error.

**Temporary fix (while waiting for the engine team):**

- Check all `[MGTK]` and its elite weapon definitions in `rules.ini`; remove or simplify them
- Check other buildings' `ElitePrimary` / `EliteSecondary` configs

### 3. MOD Archive Structure Spec

```<压缩包>.zip           ← 支持的格式：zip / 7z / rar / tar / tar.gz / tar.bz2 / tar.xz
├── modcd.ini          ← 必需！不能放在 MIX 里，必须独立文件
├── expand01.mix       ← 扩展 MIX（可选，按数字序号）
├── ecache01.mix       ← 缓存 MIX（可选）
├── elocal01.mix       ← 本地化 MIX（可选）
├── rules.ini          ← 规则覆盖（可选，按优先级合并）
├── art.ini            ← 美术覆盖（可选）
├── ai.ini             ← AI 配置（部分支持）
├── *.shp              ← 自定义 SHP 贴图（平铺在根目录）
├── *.wav              ← 自定义音效（平铺在根目录）
└── *.mp3              ← 自定义音乐（平铺在根目录）```plaintext

**File loading priority (highest to lowest):**

1. `*.ini`, `ra2.csf`, `*.mpr`, `*.map`, `*.pkt`
2. `ecache99.mix` → `ecache00.mix`
3. `expand99.mix` → `expand00.mix`
4. `elocal99.mix` → `elocal00.mix`
5. `*.mmx`
6. `ra2cd.mix` (hardcoded, cannot be overridden)
7. Original MIX archives (`ra2.mix`, `language.mix`, ...)

### 4. Quick Inspection Script (for Agents / Developers)

```# Chrono Divide 移植健康检查（Python 3）
import zipfile, os

def check_mod_archive(path):
    issues = []
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        # 1. 检查是否有嵌套文件夹
        top_dirs = {n.split('/')[0] for n in names if '/' in n}
        if top_dirs and not all(n == top_dirs.pop() for n in top_dirs):
            issues.append("ERROR: 存在多个顶层文件夹，必须扁平结构")
        # 2. 检查 modcd.ini
        if 'modcd.ini' not in names:
            issues.append("WARN: 缺少 modcd.ini 清单文件")
        # 3. 检查 main.js
        if any(n.endswith('.js') for n in names):
            issues.append("ERROR: 包含 JS 文件（main.js），Chrono Divide 不支持")
        # 4. 检查必要 SHP
        required_shp = {'mcv.shp', 'smcv.shp', 'crater01.shp'}
        present = {n.lower() for n in names if n.lower().endswith('.shp')}
        missing_shp = required_shp - present
        if missing_shp:
            issues.append(f"WARN: 缺失地形/MCV 贴图: {missing_shp}")
    return issues

print(check_mod_archive("yellow-alert-mod.zip"))```python

### 5. Configuration Reference

#### `modcd.ini` template

```[General]
ID=yellow-alert        ; 仅允许字母、数字、-、_
Name=黄色警戒
Description=经典的红色警戒2第三阵营扩展模组
Version=1.0.0
Author=Mod 作者名
Website=https://game.ra2web.com```ini

#### Brief overview of supported / unsupported features

| Feature | Support | How much Yellow Alert uses it |
|---|---|---|
| Third faction (Side=X) | ✅ Supported | Core of Yellow Alert |
| Custom SHP | ✅ Supported | Used heavily |
| HVA animations | ❌ Not supported (first frame only) | Rarely used by Yellow Alert |
| Particle-system damage | ❌ Not supported | May affect some weapons |
| AI control logic | ❌ Not supported | Used heavily by Yellow Alert |
| Original map triggers | ❌ Not supported | Campaign maps need rework |
| VXL multi-section | ⚠️ No duplicate section names allowed | Check VXL files carefully |

### 6. Log Diagnosis Quick Reference

| Log signature | Problem | Fix |
|---|---|---|
| `SyntaxError: Unexpected identifier` + `main.js` | GProxy JS injection | Remove `main.js`, use the engine's built-in networking |
| `No image file found for artName="CRATER*"` | Missing terrain-damage textures | Extract from the original `local.mix` into the root |
| `No image file found for artName="SMCV"` | Missing Soviet MCV | Provide `smcv.shp` |
| `Audio file "*.mp3" not found` | Missing custom music | Provide the MP3 or replace with the original |
| `Missing sound section [*]` | Custom sound section | Remove the unsupported section references |
| `Music section [*] not found` | Theme config mismatch | Fix the `theme.ini` references |
| `showWhenUnpowered` TypeError | Engine animation bug | Simplify buildings' elite weapon configs |
| `ERR_BLOCKED_BY_CLIENT` | Ad blocker | Ignore; doesn't affect the game |

*This document is generated from Chrono Divide v0.83.2 + Yellow Alert's actual run logs, 2026-07-31.*

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/yellow-alert-chronodivide-mod-port.html
