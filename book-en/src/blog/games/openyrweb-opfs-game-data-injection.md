# Injecting Game Data into the Browser via OPFS

> Date: 2026-08-02

### Trigger Scenario

OpenYRWeb reads all game data for Red Alert 2 / Yuri's Revenge and MODs on the browser side instead of from the server's file system. That raises an engineering problem: how do mix archives (`ra2.mix` is 200MB+, exceeding git's 100MB per-file limit, so it goes through Git LFS) and MOD files (`rulesmd.ini`/`artmd.ini`/`ra2md.csf`/`*.mmx`) get into the browser? Opening the game manually pops up the "Please locate your Red Alert 2 game files" dialog, requiring you to pick a folder/archive, or click "One-click download and extract" to pull from outside — slow and confusing for developers.

Worse still: re-running `npm run build` clears the `build/` directory, losing all the injected data you had placed; every Playwright headless test also has to go through the injection again.

This article presents two complementary paths: **Playwright OPFS persistent injection** (for automation/testing) and the splash screen's "Read project directory resources" button (for manual/demo use). Both boil down to writing the 9 required mixes + MOD files + music into the browser's OPFS (Origin Private File System).

### Tracing the Misconceptions: Three Assumptions Taken for Granted

**Assumption 1**: "Put the mix in the server's build directory and let the browser just fetch it." In reality, OpenYRWeb's data layer runs through OPFS: `Engine.initRfs()` uses `navigator.storage.getDirectory()` to get the root directory, and `lookForGameFiles()` checks whether the root directory simultaneously contains the 6 required files `language.mix`/`langmd.mix`/`multi.mix`/`multimd.mix`/`ra2.mix`/`ra2md.mix` (plus `theme`/`thememd`/`expandmd01` for a total of 9); only then does it skip the locating dialog. So the injection target is the **OPFS root directory**, not a server path.

**Assumption 2**: "An injection script that reads base64 from the repo into memory and writes it to OPFS each time is fine." That's true, but note: Playwright's `launchPersistentContext` locks the profile directory (`/tmp/pw-openyrweb-profile`); a second process startup reports `Failed to create a ProcessSingleton`; the script must be idempotent (re-running only overwrites files with the same name), and large files (`ra2.mix` 269MB) should not be read whole into memory — use `fetch + createWritable + stream` streaming writes.

**Assumption 3**: "Adding a 'One-click download' button for the user is enough." In real development scenarios the user already has all the files locally, just not in the browser; a better approach is to add a "Read project directory resources" button: clicking it pulls the 9 mixes, 23 MOD files, and 3 BGM tracks from `/_inject/gamedata/` (or the path given by the URL parameter `?gamedata=`), streams them into OPFS, then `location.reload()` auto-enters the main menu — zero manual selection, zero external downloads.

### Source-Code Verification and Actionable Conclusions

The verification points are all in the engine source and injection scripts: `engine/gameRes/GameRes.ts.js`'s `lookForGameFiles` (the 9-file list), `getBrowserFsHandle("native")`/`initRfs` (OPFS root), `GameResBoxApi.ts.js`'s `promptForGameRes` dialog (button callbacks); `scripts/inject-persist.mjs` (local base64 injection: `mods/yellow-alert/*` → OPFS `mods/yellow-alert/`, music → OPFS `music/`).

Implementation happens in three steps:

1. **Injection script** — open a persistent profile with `launchPersistentContext`, in `evaluate` use `navigator.storage.getDirectory()` to get the root, `getFileHandle(name, {create:true})` + `createWritable()` to write the base64-decoded bytes (or stream with fetch); music must go in the OPFS root `music/` directory (read by the engine's `rfs.findDirectory("music")`), MOD files go in `mods/yellow-alert/` (standalone overrides).
2. **Splash-screen button** — add a "Read project directory resources" button in `GameResForm` whose callback returns `{projectDir:true}`; `GameRes.ts.js` then pulls the 9 mixes from the `?gamedata=` parameter or `/_inject/gamedata/` into the OPFS root, then pulls `/_inject/mod/yellow-alert/` into `mods/yellow-alert/` and `/_inject/music/` into `music/`, and once everything succeeds calls `location.reload()`.
3. **Preparing the `_inject` directory** — put gamedata/mod/music subdirectories under `build/_inject/` in the serve directory, using symlinks pointing at the corresponding repo directories (`gamedata/*.mix`, `mods/yellow-alert/*`, `mods/yellow-alert/music/*`); note that `npm run build` clears `build/`, so the symlinks must be re-created **after** the build (write a `prepare-inject` command that loops `ln -sf`).

Verification: open the homepage in an empty browser profile → the Simplified-Chinese splash screen appears → click "Read project directory resources" → OPFS now contains 9 mixes + 23 mod files + 3 mp3s → auto-reload into the Simplified-Chinese main menu, with no file picker and no external download the entire time.

---

**Human developers quick reference:** four-step self-check: ① the OPFS root must contain the 9 mixes (ra2/ra2md/language/langmd/multi/multimd/theme/thememd/expandmd01), otherwise the locating dialog pops up; ② MOD files go in `mods/yellow-alert/`, music in the root `music/`; ③ `npm run build` clears `build/`, so symlinks must be re-created after the build; ④ a second Playwright process fails because the profile is locked — kill the old process first.

**Conversational AI quick reference:** question template: "How does OpenYRWeb give game files to the browser / why does the splash screen keep showing the locating dialog?" The answer should be: data goes through the browser's OPFS (`navigator.storage.getDirectory()`), and the 9 required mixes must be in the OPFS root; use Playwright persistent-profile injection for automation, and the splash screen's "Read project directory resources" button to pull from `/_inject/` manually; the build clears _inject, so the symlinks need to be re-created.

**Code agents quick reference:** key anchors: `engine/gameRes/GameRes.ts.js` (lookForGameFiles list, projectDir branch), `gui/component/GameResBoxApi.ts.js` (onLoadProjectDir callback), `scripts/inject-persist.mjs` (base64 injection reference). For injection use `getFileHandle(create:true)+createWritable` streaming writes; the splash-screen button path is `/_inject/{gamedata,mod/yellow-alert,music}/`, with support for the `?gamedata=` parameter.
