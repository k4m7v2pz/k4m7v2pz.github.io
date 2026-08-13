# Reshaping a Red Alert Engine: OpenYRWeb Modernization Overview

> Date: 2026-08-07

### 1. Why Modify an Old Engine That Runs in a Browser

OpenYRWeb is an open-source browser port of Red Alert 2 / Yuri's Revenge (Apache-2.0). Game data is injected via OPFS, and it runs inside a browser. Its upstream is nearly abandoned, so this repository is effectively the active fork — engine bugs get fixed here, and formats get modernized here.

The overall goal: make this 2000s-era engine fit two sets of standards — "personal format aesthetics" and "agent collaboration":

- **Personal aesthetics**: assets as PNG (tiles/buildings) and WAV (voice), not mix/SHP palette formats;
- **Agent-friendly**: configs as JSON + JSON Schema (validatable, enumerable, generated), not plain ini.

### 2. Four Layers of Modernization

#### 2.1 Data Injection Layer

Original game data (9 mix files) and MOD files are injected into the browser's OPFS. This required an injection page `inject.html` (with progress bar and result reporting back to a `/api/inject-report` endpoint) plus a playwright automated injection script.

#### 2.2 Tile Layer (PNG tileset)

The custom tile set `yuanbao` is provided as PNG (256×128 / @2x), with `meta.json` describing tile numbers and subTiles. The engine gained a `PngTileset` loader that decodes PNGs and plugs them into the terrain tile system.

#### 2.3 Building Rendering Layer (PNG direct color)

Buildings originally only accepted SHP (8-bit palette indices). We added `PngShpFile` (wrapping RGBA into a ShpFile-compatible object), ImageFinder `.shp` → `.png` fallback, and RGBAFormat direct-color materials in ShpBuilder. This path hit six layers of pitfalls — see "Why 'No Error, No Crash' Bugs Are the Hardest".

#### 2.4 Rules Configuration Layer (JSON Schema)

Custom buildings/tech tree/economy are described in `design/*.json`, locked down by JSON Schema (event enums, required fields, `additionalProperties:false`). The build script `build-json-rules.mjs` generates flat INI sections. Voice config `design/voice/*.json` follows the same pattern, with event keys aligned to the 64 EVA events the engine actually triggers.

### 3. The Modernized Shape

| Layer | Vanilla | After |
|---|---|---|
| Tiles | .tem in mix | PNG + meta.json (incl. @2x) |
| Buildings | artmd Image → .shp | Image → .png (ImageFinder fallback) |
| Voice | ceva/csof wav in mix | TTS-generated wav in OPFS (bilingual) |
| Rules | hand-written rulesmd.ini | design JSON → generated ini |
| Validation | none | JSON Schema (IDE real-time) |
| Verification | manual | playwright into Skirmish |

### 4. The Cost

- More than a dozen engine source files changed (render pipeline, bundle manifest, art parsing); every repack requires a hard refresh in the browser;
- PNG direct color and SHP palette are two render pipelines that must be maintained side by side;
- New engine files must be manually registered in `_module-map.json`, otherwise SystemJS 404;
- Any render-chain change needs regression against "playable": select, box-select, deploy, attack.

### 5. Conclusion

Reshaping an old engine into "my shape" means modernizing four layers (data injection, tiles, building rendering, rules config). The payoff is reproducible, validatable, agent-friendly assets; the cost is deep adaptation of the engine render pipeline. The whole effort is documented in `docs/PORTING.md` for reuse by future MODs.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-modernization-overview.html
