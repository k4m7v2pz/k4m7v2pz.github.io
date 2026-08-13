<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Pitfalls Porting an RA2 MOD to OpenYRWeb

> Date: 2026-08-02

### 🚨 Trigger Scenario

When porting an expansion MOD for the original Red Alert 2 platform (using Yellow Alert as the example here) into OpenYRWeb (the open-source, self-hostable RA2/YR browser engine), you run into three kinds of subtle problems, all reliably reproducible on a real machine:

1. **artmd.ini full replacement breaks vanilla unit rendering**: the MOD ships with `art.ini`/`rules.ini` (RA2 non-md naming), while OpenYRWeb is a **YR-only** engine — it only reads the md variants `rulesmd.ini`/`artmd.ini`/`thememd.ini`, etc.; if you drop the MOD's `artmd.ini` into the mod directory as a standalone file, the engine uses it to **fully replace** the vanilla art table inside ra2md.mix, producing a flood of `Map object 'XXX' has no art section` errors and breaking the rendering of every exclusive unit.
2. **Crash during initialization with `Must specify an art name for type "Animation"`** — the root cause is in the engine's `patchAudioVisualRules()`: it syncs the 35 keys of the `[General]` section (Behind/ChronoBeam/Parachute, etc.) over into the `[AudioVisual]` section; the MOD is in RA2 style, so these keys only exist in `[AudioVisual]` and are missing from `[General]`; after the sync they become empty values and trigger the crash.
3. **Crash popup `Unit "NDHB" cannot be docked to NARADR` when producing certain aircraft (like the NDHB heavy bomber) in-game** — the docking check requires the unit's rules to declare a `Dock=` field; otherwise the engine doesn't attach a DockableTrait to it, and docking throws an exception outright.

After investigating, all three problems point to the same main thread: **the data format doesn't match what the engine expects**.

### 🔍 Tracing the Misconceptions: Three Assumptions Taken for Granted

#### 1. Assumption: "just drop an `artmd.ini` in the MOD to override it"

In fact, OpenYRWeb's YR-only design means a standalone `artmd.ini` is a **full replacement**, not an incremental merge — the vanilla 1581 art sections inside ra2md.mix are all discarded, and the MOD's incremental table (307KB, 1705 sections) only covers the parts it defines itself, leaving every other vanilla unit as `has no art section`.

**The right approach**: **merge** the MOD's art table into one complete `artmd.ini` (vanilla sections + MOD sections), and keep CRLF line endings.

#### 2. Assumption: the initialization crash means the MOD config was written wrong

Going through the engine source line by line revealed it's the engine's merge logic: in `Engine.loadRules()`, `patchAudioVisualRules(r.clone().mergeWith(t))` syncs the 35 keys of the `[General]` section into `[AudioVisual]`; the MOD is in RA2 style (the keys exist only in `[AudioVisual]` and are missing from `[General]`), so the synced `AudioVisual` keys are empty, and system objects like `Animation` then `throw` because they can't find an art name.

**The fix is not to change the engine** but to copy these 35 keys from `[AudioVisual]` into the `[General]` section (keeping CRLF).

#### 3. Assumption: the docking crash is a "production logic bug"

In fact, when the engine constructs an `Aircraft` object it decides whether to attach `DockableTrait` based on `rules.dock.length`; in `dockUnitAt`, `traits.find(DockableTrait)` being undefined throws `Unit "X" cannot be docked to Y`. The NDHB in the MOD's original `rules.ini` has no `Dock=` line, so producing it crashes immediately.

Additionally, when porting `rulesmd.ini`, you must register all referenced animations in the `[Animations]` section (scan after stripping `;%` comments — don't miss keys like `NATorpedoT_A`).

### 📜 Source-Code Verification and Actionable Conclusions

The verification points are all in the engine source:

- `VirtualFileSystem`'s standalone files take priority over mix archives (`getFileNameVariant("rules.ini")` returns `rulesmd.ini`);
- `Engine.ts.js`'s `patchAudioVisualRules` (the 35-key sync logic), `GameRes/loadResources` (mod directory mounting);
- `game/gameobject/Aircraft.ts.js` (`t.dock.length && add(DockableTrait)`);
- `game/order/DockOrder.ts.js` (`dockTrait.isValidUnitForDock` → `e.rules.dock.includes(建筑名)`).

#### The fix lands in four layers

1. **Merge the art table**: merge the MOD's art table into `artmd.ini` (vanilla 1581 sections + MOD 1705 sections), and also register all referenced animations in the `[Animations]` section of `rulesmd.ini`;
2. **Add the AudioVisual keys**: copy `[AudioVisual]`'s 35 keys into the `[General]` section (Behind/ChronoBeam/Parachute/Veins, etc.), keeping CRLF line endings;
3. **Declare the Dock field**: add `Dock=` to every aircraft with `ConsideredAircraft=yes`/`AirportBound=yes` (Soviet→NARADR, Allied→AMRADR/GAAIRC, shared by both→list all three), e.g. `NDHB: Dock=NARADR`, `GBION: Dock=NARADR,AMRADR,GAAIRC`;
4. **Inject the data into the browser OPFS**: the `mods/yellow-alert/` directory + `_inject` path; re-run the injection script, then refresh the page to verify.

**After the fix**: the main menu works, exclusive units render in full, and producing/docking aircraft no longer crashes.

**Lessons learned**: when porting to a cross-platform engine, these four classes of differences are the most frequent traps — "file-name variants (md), ini section registration (General↔AudioVisual), Dock field declaration, and full art-table merging"; when debugging, first match the source-code format, then change the data — don't suspect the rendering layer or game logic first.

---

### 📋 Human Developers Quick Reference

**Four-step self-check**:

1. The engine only reads md variants (rulesmd/artmd/thememd); RA2 vanilla data must be renamed or merged, and a standalone artmd.ini is a full replacement, not incremental;
2. When initialization reports `Must specify an art name`, check whether the `[General]` section is missing AudioVisual's 35 supplemental keys;
3. If aircraft crash on production, check whether the `Dock=` field is declared (DockableTrait depends on it);
4. When editing rulesmd.ini keep CRLF line endings, and complete the referenced animations in the `[Animations]` section.

### 🤖 Conversational AI Quick Reference

**Question template**: "OpenYRWeb crashes when porting a RA2 MOD / units don't show up, how do I fix it?"

**The answer should be**: the YR-only engine only reads md variants; a standalone artmd.ini fully replaces the vanilla art table and needs to be merged; `Must specify an art name for type Animation` means `[General]` is missing the AudioVisual supplemental keys; the aircraft docking crash is a missing `Dock=` field.

### ⚙️ Code Agents Quick Reference

**Key anchors**:

- `engine/Engine.ts.js` (patchAudioVisualRules 35-key sync)
- `data/vfs/VirtualFileSystem.ts.js` (standalone priority)
- `game/gameobject/Aircraft.ts.js` (dock.length attaching DockableTrait)
- `game/order/DockOrder.ts.js` (isValidUnitForDock)

After the changes, re-run the injection script and refresh the page to verify.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/ra2-mod-openyrweb-port-pitfalls.html
