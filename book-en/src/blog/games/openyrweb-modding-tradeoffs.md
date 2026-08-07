# Engine-Modding Tradeoffs: Playability First, Aesthetics Serve the Feel

> Date: 2026-08-07

### 1. Why Keep Modding Inside a Browser

OpenYRWeb is a browser-based Red Alert engine. One might ask: why not rewrite the game as a native Rust window? The answer is practical:

- **Playability drives motivation**: the browser version runs, injects, and enters Skirmish; every change gets instant feedback. A rewrite would kill all iteration momentum;
- **Testability makes changes safe**: playwright headless can automate entering Skirmish, checking the canvas, and scanning errors — this is the confidence to modify the engine without fear;
- **Free ecosystem bonuses**: @2x hi-DPI assets, WebGL rendering, OPFS persistence, fetch loading — all free in a browser.

Rust windows and terminals are a more "personal" form factor, but this project is a "follow-the-ecosystem compromise" — the compromise buys playability and testability.

### 2. Three Tradeoff Principles

#### 2.1 Asset formats follow personal aesthetics

- Tiles/buildings as PNG (RGBA direct color), not SHP palettes — universal image toolchains, and @2x comes free;
- Voice as WAV (TTS-generated), not vanilla mix wavs — regenerating bilingual voice is a re-run away;
- Result: a clean, reproducible, versionable asset tree.

#### 2.2 Configs follow agents

- Rules, voice mapping, and MOD metadata are all JSON + JSON Schema;
- Schema locks enums (event names, factions, categories), `additionalProperties:false` blocks typos;
- The build script turns design JSON into flat INI the engine can read — humans read JSON, the engine reads INI, agents edit JSON.

#### 2.3 Playability is the regression baseline

Any render-chain change is regression-tested by "can you actually play Skirmish": select, box-select, deploy, attack. Crash chains usually end in dead interaction, not a red screen — "playable" is the most honest smoke test.

### 3. The Cost of the Tradeoffs

- More than a dozen engine source files changed; after every repack the browser needs a hard refresh (Cmd+Shift+R);
- PNG direct color and SHP palette are two render pipelines maintained side by side — more surface area;
- New engine files must be manually registered in `_module-map.json`, otherwise SystemJS 404;
- The browser form factor means the debugging toolchain is console/elements panels, not a Rust compiler and terminal — part of the compromise.

### 4. Conclusion

The modding tradeoff is not "technically optimal" but a three-way balance of aesthetics + agent collaboration + playability: PNG/WAV assets please yourself, JSON/Schema configs please agents, and "playable" regression pleases the feel. These principles keep the modding sustainable — every step has positive feedback, so there is always motivation to keep going.
