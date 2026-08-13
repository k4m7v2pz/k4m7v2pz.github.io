# Bilingual EVA Announcer: Letting Custom Voice Take Over from Vanilla

> Date: 2026-08-07

### 1. Background

The engine's EVA announcer voice is part of the game experience. Vanilla plays ceva/csof wav from mix via the `[DialogList]` table in `eva.ini`. Making the announcer speak Chinese or custom English requires two things: first, knowing exactly which EVA events the engine can trigger; second, designing a mapping structure for custom voice.

### 2. Mapping Out the Engine's 64 EVA Events

Don't guess — dig from source and vanilla data:

- Engine source `eva.play("EVA_xxx")` call sites: grep all literals, dedupe to get the EVA events the engine actually triggers;
- Extract `eva.ini` from `ra2.mix > local.mix`, parse `[DialogList]` (356 valid entries), and read `Text` (vanilla English) and `Allied/Russian` (voice files) per entry;
- Cross-check: all 64 engine-referenced events exist in eva.ini with Text + voice.

**Key insight: the engine only triggers 64 events; the mission-objective classes in the 356-entry full list (EVA_MissionAccomplished etc.) are unused.** So custom voice only needs the subset the engine actually fires.

### 3. Event Semantics Annotation

The 64 events were grouped by purpose to decide what to make:

| Group | Count | Notes |
|---|---|---|
| Economy/build/unit (core) | 30 | construction complete, insufficient funds, low power, unit ready |
| Capture/garrison | 4 | building captured, garrisoned, abandoned |
| Spy/infiltrate/upgrade | 12 | cash stolen, radar sabotaged, unit promoted |
| Alliance | 5 | formed, broken, requested |
| Superweapon | 13 | nuke, Iron Curtain, chrono, lightning (optional, MOD has none) |

Each entry has vanilla English + Chinese translation, forming a bilingual table.

### 4. Voice Mapping Structure (JSON + Schema)

`design/voice/{en,zh-CN}/event_voice_mapping.json`:

```json
{
  "events": {
    "EVA_ConstructionComplete": {
      "filename": "EVA_ConstructionComplete.wav",
      "text": "建造完成。"
    }
  }
}
```

`schema/voice.schema.json` locks down:

- Event keys must belong to the 64-event EVA enum (`propertyNames.enum`);
- Each entry requires `filename` + `text`, `additionalProperties:false`;
- `filename` must equal the event key + `.wav`.

Typos fail at edit time instead of runtime.

### 5. Engine Consumption Side (Pending)

Current state: voice files are generated and injected into OPFS; the mapping is in place and passes Schema validation. But the engine's `eva.play()` still goes through eva.ini → vanilla mix voice. Making custom voice actually play requires engine wiring: event trigger → read `design/voice/{lang}/mapping` → play custom wav (fall back to eva.ini vanilla if missing). This is the next candidate task, recorded in `docs/PORTING.md`.

### 6. Conclusion

The bilingual announcer skeleton is "event enum (64) + bilingual text + JSON Schema mapping + TTS generation". Map the engine's trigger surface first, so you don't synthesize 300 unused lines out of the 356-entry full set; the Schema locking the enum keeps the mapping in sync with engine reality — the first step toward letting vanilla voice step aside.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-bilingual-eva-voice.html
