# Why "No Error, No Crash" Bugs Are the Hardest: A Six-Layer Crash Chain in PNG Building Rendering

> Date: 2026-08-07

### 1. Background

While integrating custom PNG building assets into OpenYRWeb (the browser port of Red Alert 2 / Yuri's Revenge), we hit a six-layer chain of failures. The surface symptom was "MCV deploys into a green/blue checkerboard placeholder", but underneath was a series of silently failing assumptions. This article walks through the whole chain — it is far harder than a bug that errors out and crashes, because every layer fails quietly.

### 2. The Crash Chain

The goal: make the MCV-deployed Construction Yard show our custom `construction_yard.png` instead of the original SHP. That requires the engine to support "PNG direct-color building rendering" — the vanilla engine only eats SHP (8-bit palette indices), while PNG is 32-bit RGBA.

#### 2.1 Layer 1: SystemJS 404

After adding `data/PngShpFile.ts.js` (a wrapper that makes decoded RGBA look like a ShpFile), the game failed with:

```
XHR error (404 Not Found) loading http://127.0.0.1:8080/data/PngShpFile
```

Root cause: `repack.mjs` bundles according to the module list in `src/_module-map.json`. The new file was not registered, so the bundle only contained Engine's dependency reference string — no module body. SystemJS then fetched it by path at runtime and got 404. Fix: insert the entry into `_module-map.json` manually. **Lesson: this engine's bundle manifest is hand-maintained; new files must be registered first.**

#### 2.2 Layer 2: Not a Single PNG Was Injected

The checkerboard showed up because the ImageFinder `.png` fallback always missed. After ruling out stale OPFS data and browser cache, reading the engine source finally revealed:

```js
// RealFileSystemDir.getEntries()
async *getEntries() {
  for (const name of this.handle.keys()) yield name; // ← yields plain strings!
}
```

My scan code read `fe?.name` — taking `.name` of a string is always `undefined`, so `fname = ""` and every PNG was filtered out by `endsWith(".png")`. **This was the most expensive bug: it does not error, does not crash, it just "does nothing"** — only found by reading the engine source.

#### 2.3 Layer 3: Empty Aggregated agg SHP

`Building.ts.js` aggregates mainShpFile + bib + animation frames into `agg_<name>.shp`. When the PNG fallback missed, `mainShpFile` was `undefined`, the aggregate input was empty → `agg_GACNST.shp` had `images.length=0` → `getImage(0)` threw RangeError → the render queue broke → selection and box-select stopped working.

Fix: when main art lookup fails, fall back to the original art (`objectRules.name`).

#### 2.4 Layer 4: RGBA Frame Count Halved

In `ShpAggregator.getShpFrameInfo`:

```js
frameCount: Math.floor(e.numImages * (t ? 0.5 : 1)) // SHP main+shadow half-frame layout
```

A PNG has only 1 RGBA frame (alpha included). With `hasShadow=true` it was computed as 0 frames → empty aggregate. Fix: detect `imageData.length === w*h*4` and never halve RGBA direct-color frames, and treat them as shadow-less.

#### 2.5 Layer 5: Material Format Assertion

```
Texture must have format THREE.AlphaFormat
```

The batched path `useMaterial` forces AlphaFormat (palette material); PNG direct-color textures are RGBAFormat. Fix: skip batching for RGBAFormat textures, go direct with `MeshBasicMaterial`.

#### 2.6 Layer 6: Missing BatchedMesh Methods

```
this.mesh.setPaletteIndex / setOpacity / setExtraLight is not a function
```

The direct-color material (MeshBasicMaterial) lacks those three BatchedMesh-only methods. Guard each with `typeof === "function"`.

### 3. Why "No Crash" Bugs Are Harder

| Feature | Errors and crashes | Silent failure |
|---|---|---|
| Locating | Stack trace points at the line | Need to read source to find "does nothing" |
| Search direction | Single point | Could be data, cache, or any render layer |
| Intuition | Follow the stack | Every layer looks "normal" |

Layer 2 (getEntries returning strings) is the classic case: all three intermediate steps were green (OPFS has files, bundle has code, load logs no error) — only the injection result was empty.

### 4. Reusable Debugging Methods

1. **Suspect "silent dropping" first**: in batch loops, `filter/continue` conditions swallow data quietly. Log what the loop actually sees.
2. **Read the implementation, don't guess the API**: whether `getEntries()` returns objects or strings is obvious the moment you read `RealFileSystemDir.ts.js`.
3. **Verify after each fix**: playwright into Skirmish (`verify-iow.mjs`) after every change — do not batch several fixes before testing.
4. **Treat "playable" as the regression baseline**: after render-chain changes, confirm interactions (select, box-select) still work — crash chains usually end in dead interaction, not a red screen.

### 5. Conclusion

Bugs that error and crash are like roadblocks — visible at a glance. Bugs that fail silently are like slow leaks — they need layer-by-layer inspection. When adding a new format (PNG direct color) to an old engine, the real cost is not "add one Image key" but understanding every layer's assumptions (bundle manifest, injection loop, aggregate frame count, material format, material methods). These assumptions are recorded in `docs/PORTING.md` so future PNG asset integration can reuse the same debugging path.
