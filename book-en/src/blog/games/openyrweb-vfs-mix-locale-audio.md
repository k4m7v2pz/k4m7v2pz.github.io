# OpenYRWeb Browser Engine Internals: VFS-mix Loading, Locale Detection, and the Audio Pipeline

> Date: 2026-08-02

### Trigger Scenario

To figure out why OpenYRWeb (the open-source, self-hostable RA2/YR browser port engine) "runs" and how to troubleshoot it, you need to understand several of its key mechanisms: how does game data (mix archives, ini, csf) get into the browser? Why does the engine only recognize `rulesmd.ini`/`artmd.ini` (the md variants)? How does the UI language automatically become Simplified Chinese? What paths do BGM and sound effects each take? This article breaks down these four mechanisms at the source-code level to help you build a complete mental model of the engine and know where to look when something goes wrong.

### Tracing the Misconceptions: Three Assumptions Taken for Granted

#### Assumption 1: The engine reads the server's file system directly

In fact, OpenYRWeb's data layer is **VFS (VirtualFileSystem) + browser OPFS**: `Engine.initRfs()` uses `navigator.storage.getDirectory()` to get the OPFS root directory, and `lookForGameFiles()` checks whether the 6 required mixes (language/langmd/multi/multimd/ra2/ra2md) exist; inside the VFS, standalone files (such as the injected `mods/yellow-alert/rulesmd.ini`) take priority over mix archives (files with the same name inside ra2md.mix), so MOD data can override the original game.

#### Assumption 2: Renaming the MOD's rules.ini to rulesmd.ini is all it takes

The engine is **YR-only**: `getFileNameVariant("rules.ini")` returns `rulesmd.ini`, `art.ini`→`artmd.ini`, `ra2.csf`→`ra2md.csf`, `theme.ini`→`thememd.ini` — RA2 non-md files are simply never read. And in `Engine.loadRules()`, `patchAudioVisualRules()` syncs the 35 keys of the `[General]` section into `[AudioVisual]`; if the MOD is in RA2 style (the keys only exist in `[AudioVisual]`), the synced values become empty and trigger an initialization crash.

#### Assumption 3: The language is a switch in a config file

In fact, the UI language is **auto-detected from the CSF content**: `CsfFile.autoDetectLocale()` looks at the value of `THEME:Intro` — "開場"→ChineseTW, "开场"→ChineseCN, `getIsoLocale()` returns `zh-CN`, and `Application` then loads `locale/zh-CN.json` to override the UI text. So "making the UI Simplified Chinese" is essentially editing the `THEME:Intro` value in `ra2md.csf`, not flipping any config switch.

### Source-Code Verification and Actionable Conclusions

The verification points are spread across modules in the engine source: `data/vfs/VirtualFileSystem.ts.js` (standalone priority, `getFileNameVariant`), `engine/Engine.ts.js` (`initRfs`/`loadRules`/`patchAudioVisualRules` 35-key sync/`getActiveMod`), `data/CsfFile.ts.js` (parse/autoDetectLocale/getIsoLocale), `Application.ts.js` (`loadTranslations(locale)` loading `locale/{lang}.json`, `updateViewportSize` resolution clamping), `engine/sound/AudioSystem.ts.js` (`new AudioContext()` + `decodeAudioData` playback, `createChannels` building Gain nodes by ChannelType).

Full pipeline: startup → `loadConfig` (config.ini's `defaultLanguage`) → `GameRes.init` (OPFS detection → a locating dialog pops up when data is missing) → `Engine.initVfs` (mount mix archives + standalone mod files) → `loadRules` (rulesmd.ini merge + patchAudioVisualRules) → CsfFile detects the language → load locale json → main menu.

Dual audio pipelines: BGM goes through `Music.ts` (`getMp3File()` appends `lowercase sound name + .mp3` and reads from OPFS `music/`; the theme table lives in the thememd.ini `[Themes]` section); sound effects go through `AudioBagFile` (audio.idx parses entries → buildWavData generates WAV → `decodeAudioData` plays it, with ChannelType splitting into Master/Effect/Ui volume channels).

Suggested troubleshooting order: for data issues check the VFS first (`vfs.fileExists("xxx")` verified directly in the console) → for config issues check the merged rules (`Engine.getRules()`) → for language issues check the CSF's THEME:Intro → for audio issues check whether decodeAudioData succeeds (failure shows `EncodingError` or `Failed to decode wav file`).

### Lessons Learned

OpenYRWeb's four keywords are **OPFS, VFS, YR-only, CSF self-detected language**; remember "standalone overrides mix, md variants are the only entry point, THEME:Intro decides the language, decodeAudioData decides sound effects" — most problems can be located within half an hour.

---

#### Human Developers Quick Reference

Four-step self-check: ① data gets into the browser via OPFS (`navigator.storage.getDirectory()`), and in the VFS standalone > mix archives; ② the YR-only engine only reads md variants (rulesmd/artmd/thememd/ra2md), RA2 non-md files are not read; ③ the UI language is auto-detected from the `THEME:Intro` value ("开场"→zh-CN), just edit the CSF; ④ the sound-effect pipeline is `AudioBagFile → decodeAudioData`, failure shows `EncodingError`.

#### Conversational AI Quick Reference

Question template: "Why does OpenYRWeb only read rulesmd.ini / how do I change the UI language / why is there no sound?" The answer should be: the YR-only engine's `getFileNameVariant` forces the md variant; the language is auto-detected by `CsfFile.autoDetectLocale` reading THEME:Intro (开场=Simplified); sound effects go through the OPFS audio bag + decodeAudioData, and on failure check the console for EncodingError.

#### Code Agents Quick Reference

Key anchors: `data/vfs/VirtualFileSystem.ts.js` (standalone priority/getFileNameVariant), `engine/Engine.ts.js` (initRfs/loadRules/patchAudioVisualRules), `data/CsfFile.ts.js` (autoDetectLocale), `engine/sound/AudioSystem.ts.js` (decodeAudioData/createChannels). To troubleshoot, first verify data with `Engine.vfs.fileExists()`, then verify config with `Engine.getRules()`, and finally check the console for audio decode errors.
