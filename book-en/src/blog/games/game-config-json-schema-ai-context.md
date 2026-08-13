# Game Config for AI Agents: JSON Schema and an ai_context Annotation-Layer Design

> Date: 2026-08-02

### 1. Background and Goals

When you bring an LLM (ChatGPT/Yuanbao/Doubao, etc.) or a code agent (Copilot/Trae/AtomCode) into game MOD development, the biggest pain point is not "the data can't be read", but **lost design intent**: a line like `Primary=SABOTZ, Secondary=FlakWeapon2` in `rulesmd.ini` — a human knows this means "the Construction Yard can fire at both ground and air, this MOD deliberately designed it that way, it feels great to play and you can focus on mowing down enemies", but an AI just sees an ordinary unit config — at best it gives off-topic answers, at worst it mistakes the deliberate design for a bug and suggests "fixing" it. We hate ini and toml (both humans and AIs spend ages parsing them), and what we want is: **talk to the Agent to get work done, ask the Agent questions directly** — and the Agent needs a config it can directly understand, reference, and validate. This article offers one approach: convert the game config into **json + json schema**, and define an **annotation layer (ai_context)** in the schema — using fields to explicitly write out "design intent, true state, unconventional behavior, interaction relationships", so an AI immediately sees "this is a feature, not a bug".

### 2. Tracing the Misconceptions: Three Assumptions Taken for Granted

The first assumption: "converting ini to plain json is enough, an AI will naturally understand it." In reality plain json only solves the parsing problem, not the **semantic problem** — for a key-value pair like `"Damage": 155, "ROF": 60`, the AI can't tell whether 155/60 was deliberately tuned up or a slip of the hand. The key is not the "format" but **where the annotations go**: when an AI reads json it won't go flip through a nearby README; the annotations must travel with the data. Look at two mature precedents: the piliplus-keywords project uses `keywords: [{word, note}]`, where note explains a pun's homophone and the intent to evade censorship (e.g. "炫压抑 = a homophone for 性压抑"); the python_arcade_endless_corridor story json uses `metadata: {ai_context: {true_state, character_motivation}, creator_hints: {for_streamers}}`, layering "surface plot" and "true intent". Conclusion: **the annotation layer must be structured, travel with each entry, and the field names themselves should be self-explanatory**.

The second assumption: "a schema is just a hard type constraint." In reality the schema plays two roles here: it is both a **validator** (after the agent edits the config it can run `jsonschema.validate`) and a **documentation contract** (the description field is itself a manual written for the AI).

The third assumption: "the more detailed the annotations, the better." In reality AI context is limited, so annotations should appear **only where things are counter-intuitive** — a Construction Yard carrying weapons, a unit name that's a homophone, numbers that look unbalanced but are deliberate — those need ai_context; common knowledge rules don't.

### 3. Schema Top-Level Structure

The schema's top level defines the following key fields:

- **schema_version**: config format version number.
- **meta**: metadata including id, engine, platform, data_files, etc.
- **design_philosophy**: contains core_loop, tone, non_obvious_designs — the AI must read this first before answering balance questions.
- **units / buildings / weapons**: three core data arrays.
- **design_notes**: supplementary design notes.

### 4. The ai_context Annotation-Layer Structure

`$defs.ai_context` defines the standard structure of the annotation layer, with four core fields:

- **design_intent**: why it was designed this way, in one sentence.
- **true_state**: the truth behind the surface values.
- **quirks**: a list of deliberate unconventional behaviors — if the AI finds these "anomalies" it should treat them as features, not bugs.
- **interactions**: how it interacts with other mechanics.

### 5. A Real Entry Example: the Construction Yard

Taking the Construction Yard as an example, here's how ai_context looks in practice:

```{
  "design_intent": "建造厂自备对地+对空武器，基地前期无需防御塔即可自保",
  "true_state": "Primary=SABOTZ 对地（155 伤害），Secondary=FlakWeapon2 对空（105 伤害），双武器自动切换",
  "quirks": ["建造厂会对靠近的敌人开炮（原版 RA2 建造厂无武器，这是本 MOD 的增强）"]
}```json

At the same time, the top-level `design_philosophy.non_obvious_designs[0].warning_for_ai` explicitly states:

> This is not a bug! Do not suggest removing the Construction Yard's weapons, and don't treat it as a config error to fix.

### 6. Data Key Names vs. ini Section Names

Data key names correspond one-to-one with rulesmd.ini section names (e.g. `GACNST`), making it easy for an Agent to cross-check against the original config. For example, the Construction Yard entry maps directly to the `GACNST` / `NACNST` sections in ini, and the weapon entries map to the `SABOTZ` / `FlakWeapon2` sections.

### 7. Implementation Steps

1. Extract key sections from rulesmd.ini: the Construction Yard's GACNST/NACNST Primary/Secondary/Owner/Strength, etc., and the weapons' SABOTZ/FlakWeapon2 Damage/ROF/Range.
2. Hand-write ai_context for every counter-intuitive entry.
3. Write the schema and self-check with `jsonschema.validate`.
4. Feed the generated json to the Agent as its "project overview" — afterwards, ask it "how is the Construction Yard designed" and it answers correctly, never mistaking the deliberate design for a bug.

### 8. Lessons Learned

For configs meant for AI, annotations matter more than data. Annotations should be structured (design_intent/true_state/quirks), travel with each entry, and appear only where things are counter-intuitive. The schema's description field is a ready-made manual for the AI.

### 9. Human Developers Quick Reference

Four-step self-check:

1. json only solves parsing; the ai_context annotation layer solves semantics — the AI needs to know "why it was designed this way".
2. Recommended annotation structure: design_intent / true_state / quirks / interactions, plus design_philosophy.non_obvious_designs[].warning_for_ai at the top level.
3. Data key names correspond one-to-one with ini section names for easy cross-checking.
4. After producing the output, validate with `jsonschema.validate`, then use it as the Agent's project overview.

### 10. Conversational AI Quick Reference

Question template: "Why can this MOD's Construction Yard fire?" The answer should be: check `design_philosophy.non_obvious_designs` and `buildings[].ai_context` — the Construction Yard carrying SABOTZ (ground) + FlakWeapon2 (air) is a deliberate design (true_state), intended for base self-defense so you can focus on mowing down enemies; it is not a bug.

### 11. Code Agents Quick Reference

Key anchors: `conf/ai/yellow-alert.schema.json` ($defs.ai_context structure + design_philosophy), `yellow-alert.mod.json` (GACNST/NACNST entries, SABOTZ/FlakWeapon2 weapons). After editing the config, run `python3 -m jsonschema -i yellow-alert.mod.json yellow-alert.schema.json` to self-check; when asked about design intent, read ai_context first rather than the raw numbers.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/game-config-json-schema-ai-context.html
