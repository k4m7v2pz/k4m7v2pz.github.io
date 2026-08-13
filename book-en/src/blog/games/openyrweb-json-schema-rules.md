<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Locking Down Rules Config with JSON Schema: Event Enums and AI-Hallucination Guards

> Date: 2026-08-07

### 1. Why Rules Config Needs a Schema

The Red Alert engine's rules are ini (unstructured, untyped). When a MOD wants to express structured concepts like "oil-well economy", "three-faction inheritance", or "64-line voice mapping", hand-written ini is error-prone, hard to validate, and hard for agents to edit. The modernization: rules described as JSON, locked down by JSON Schema, with a build script generating the flat INI the engine reads.

### 2. Three-Layer Config System

```
design/
├── mod.json                    # MOD metadata (i18n bilingual)
├── economy.json                # oil-well economy (amount, delay, startup)
├── tech-tree.json              # tech tree (T1/T2/T3 progression)
├── entities/buildings/
│   ├── 通用/油井.json          # abstract base (cost, output, prereqs)
│   ├── 盟军/油井.json          # extends base, owner=[Allied]
│   ├── 苏军/油井.json          # extends base, owner=[Soviet]
│   └── 尤里/油井.json          # extends base, owner=[Yuri]
└── voice/{en,zh-CN}/event_voice_mapping.json
```

Each JSON under `schema/` has a matching Schema (draft-07, consistent with the engine side).

### 3. How the Schema "Locks Down"

Using `building.schema.json` as an example, the key constraints:

```json
{
  "required": ["id", "name"],
  "properties": {
    "extends": { "type": "string" },
    "abstract": { "type": "boolean", "default": false },
    "code": { "pattern": "^[A-Z0-9]{1,8}$" },
    "owner": { "items": { "enum": ["Allied", "Soviet", "Yuri"] } }
  },
  "if": { "properties": { "abstract": { "const": true } } },
  "then": { "description": "abstract template needs only id + name" },
  "else": { "required": ["code", "techLevel", "prerequisites", "buildCat"] },
  "additionalProperties": false
}
```

- `required` + `additionalProperties:false`: missing or extra fields both fail;
- `enum`: owner can only be the three factions; buildCat only fixed categories;
- `if/then/else`: abstract base and concrete entities require different fields;
- The voice Schema uses `propertyNames.enum` to pin event keys to the 64-EVA-event enum.

### 4. Guarding Against AI Hallucination

When an agent edits config, hallucinations (typoed field names, invented events, bad formats) are stopped by three walls:

1. **Editor real-time validation**: JSON carries a `$schema` pointer; IDEs auto-complete and report errors;
2. **Build-time validation**: `build-json-rules.mjs` resolves inheritance, validates reference integrity (unique id/code, existing prerequisites), runs Schema validation, and exits on failure;
3. **Runtime enums**: voice event keys must hit the 64-event enum the engine actually triggers — inventing a nonexistent EVA event is rejected by the Schema outright.

### 5. Object Inheritance

```
通用/油井.json (abstract: techLevel=1, cost=800, produceCash=500/25/5)
├── 盟军/油井.json → AILW (owner=Allied)
├── 苏军/油井.json → SILW (owner=Soviet)
└── 尤里/油井.json → YILW (owner=Yuri)
```

The build deep-merges overrides onto the base and generates flat INI sections (`ProduceCashStartup/Amount/Delay` etc.). Adding a faction is just duplicating an entity JSON and changing owner/code.

### 6. Conclusion

JSON Schema locks the contract between "human-readable JSON" and "engine-readable INI": structure errors surface at edit time, reference errors at build time, and enum errors at Schema time — three walls keep AI hallucinations out of the rules layer. This is also the foundation of the MOD being "agent-friendly": agents can edit config without breaking it, because the Schema is their guardrail.

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-json-schema-rules.html
