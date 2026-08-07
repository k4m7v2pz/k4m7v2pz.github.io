# mix/SHP/ini → PNG/WAV/JSON: Modernizing an Old Engine's Data Formats

> Date: 2026-08-07

### 1. Why Migrate Three Formats

The OpenYRWeb engine inherited Red Alert 2's classic data formats: binary mix archives, 8-bit palette SHP images, and unstructured ini rules. These were the performance-optimal choices in the 2000s, but they are unfriendly to modern development and agent collaboration. The modernization chose three replacements:

| Original | New | Rationale |
|---|---|---|
| mix (binary archive) | directory + OPFS injection | incremental edits, version control |
| SHP (palette indices) | PNG (RGBA direct color) | universal image toolchains, @2x support |
| ini (untyped) | JSON + JSON Schema | validatable, enumerable, generated, IDE completion |

### 2. SHP → PNG Migration Path

SHP is 8-bit palette-indexed and rendered through a palette; PNG is 32-bit RGBA. Migration is not just swapping files — it is adapting the render pipeline:

1. **Tile layer**: added `PngTileset`, which reads `meta.json` (tile number → PNG file + subTile layout), decodes, and plugs into the terrain tile system;
2. **Building layer**: added `PngShpFile` (wrapping RGBA into a ShpFile-compatible object); `ImageFinder` falls back to same-name `.png` when `.shp` is missing;
3. **Material layer**: `ShpBuilder` supports RGBAFormat direct-color materials (MeshBasicMaterial), skipping the palette and batching paths.

Key pitfall: SHP has a "main frame + shadow half-frame" layout (`frameCount = numImages * (hasShadow ? 0.5 : 1)`); a PNG has one frame, so applying that formula directly turns 1 frame into 0 frames and aggregates an empty file. RGBA direct-color frames must be special-cased.

### 3. Adding WAV Voice

Voice originally lived as ceva/csof wav inside mix, played via the `[DialogList]` table in `eva.ini`. Adding custom WAV voice:

- Batch-synthesize with TTS (Qwen-TTS, Neil voice), output `audio/voice/{lang}/EVA_*.wav`;
- `design/voice/{lang}/event_voice_mapping.json` maps event → filename → text;
- Event keys align with the 64 EVA events the engine actually triggers, so the mapping is validatable.

### 4. ini → JSON Migration Path

Rules move from "hand-written flat ini sections" to "design JSON → generated ini":

```json
// design/entities/buildings/通用/油井.json
{
  "extends": null,
  "id": "oil-well",
  "abstract": true,
  "techLevel": 1,
  "cost": 800,
  "produceCash": { "startup": 500, "amount": 25, "delay": 5 }
}
```

- Object inheritance supported (abstract base → faction entities extends);
- JSON Schema locks the structure: required fields, `additionalProperties:false`, event-name enums;
- `build-json-rules.mjs` resolves inheritance, validates reference integrity, and generates flat INI sections;
- The engine only reads rulesmd.ini, so generated sections must be merged into the `[BuildingTypes]` registry (currently the generator emits them; the merge step is follow-up work).

### 5. Payoff and Remaining Work

**Payoff**: reproducible (re-run the generator), validatable (Schema + playwright), agent-friendly (JSON is enumerable and hintable).

**Remaining**: auto-merging generated flat INI sections into rulesmd.ini's `[BuildingTypes]` registry is not yet automated; the engine consumption side of voice mapping (event trigger → play custom wav) is still pending — vanilla eva.ini voice keeps serving as fallback. Both are recorded in `docs/PORTING.md` as next iterations.

### 6. Conclusion

Format modernization is essentially "adapting three pipelines one by one": data loading (mix → OPFS), resource wrapping (SHP → PngShpFile), and render materials (palette → RGBA). Every layer hides assumptions; change one layer and one breaks. Once those assumptions are written into the pitfall log (`docs/PORTING.md`), future migrations of the same kind can reuse the debugging path.
