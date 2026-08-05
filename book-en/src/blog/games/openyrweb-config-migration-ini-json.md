# OpenYRWeb Engine Configuration Migration: A Practical Guide from INI to JSON Schema

> Date: 2026-08-05

### 1. Project Background and Problem Diagnosis

OpenYRWeb is an open-source project that ports the classic game Red Alert 2 engine to the browser. In version 0.1.0, its engine configuration used the traditional `server/config/config.ini` file (INI format), which had the following pain points:

- **No type validation**: All config values are strings; types must be manually converted at runtime, which is error-prone.
- **Non-standard key names**: Uses dot-separated compound key names (e.g., `viewport.width`), which require special parsing in INI.
- **No structural hints**: The meaning, valid ranges, and default values of config items are all explained only via comments, with no editor autocomplete.
- **Mixed formats**: The project simultaneously uses .ini, .toml, .yaml/.yml, and other config file formats, making maintenance costly.

The user's requirement is clear: migrate the **engine's own configuration** to `config.json` + JSON Schema to gain type validation, editor autocomplete, and better readability, while unifying the project's config format.

### 2. Key Insight: Draw Clear Migration Boundaries

**First misconception correction: Not all .ini files can be converted to JSON.**

The OpenYRWeb project contains two types of INI files:

1. **Engine configuration**: `server/config/config.ini`, which controls server behavior, development mode, CORS proxy, etc. This is a reasonable migration target.
2. **Game data**: e.g., `rulesmd.ini`, `artmd.ini`, which are standard data files in the Red Alert 2 MOD ecosystem, read by a dedicated parser. Converting them to JSON would mean rewriting the game data layer and would break the game.

**Action principle**: First clarify "what to change" and "what not to change." This migration targets only the **engine's own configuration**; game data files remain as-is.

### 3. Architecture Design: Zero-Intrusion Adapter Layer

**Second misconception correction: Changing the config format doesn't necessarily mean rewriting all the read code.**

The project's existing `src/Config.ts.js` contains a `Config` class that provides public getter interfaces (such as `defaultLocale`, `devMode`, `getCorsProxy`, etc.), which are heavily referenced by business code. Crudely replacing all call sites is extremely costly and error-prone.

**Correct approach**: Keep the `Config` class's public interface, and only replace its internal data-source loading logic. Build an adapter layer that maps JSON config data to the original getter methods.

```javascript
// Adapter layer core idea
class Config {
  constructor() {
    // Old: this._data = IniFile.parse('config.ini')
    // New: this._data = JSON.parse(fs.readFileSync('config.json'))
    this._data = this.loadFromJSON('config.json');
  }

  // Public interface unchanged
  get defaultLocale() {
    return this._data.server?.defaultLocale || 'en';
  }
  get devMode() {
    return this._data.server?.devMode || false;
  }
  getCorsProxy() {
    return this._data.network?.corsProxy;
  }

  // Internal adapter method
  loadFromJSON(path) {
    const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
    // Optional: JSON Schema validation here
    return raw;
  }
}
```

This way, all business code works without any modification, while enjoying the benefits of the new config format.

### 4. Config Format Design: JSON + Schema

**Third misconception correction: JSON does not support comments; original comments must be migrated to the Schema.**

The explanatory text in the original `config.ini` cannot be placed directly into a JSON file. The correct approach is to write this descriptive information into the `description` fields of the JSON Schema.

#### 4.1 Old vs. New Config Comparison

**Original INI config snippet**:

```ini
; Server configuration
[server]
; Default language
defaultLocale = en
; Dev mode switch
devMode = false

; Viewport settings
[viewport]
; Canvas width
width = 800
; Canvas height
height = 600

; Network configuration
[network]
; CORS proxy address, used for cross-origin resource loading
corsProxy = http://localhost:8080/proxy
```

**New JSON config (`config.json`)**:

```json
{
  "server": {
    "defaultLocale": "en",
    "devMode": false
  },
  "viewport": {
    "width": 800,
    "height": 600
  },
  "network": {
    "corsProxy": "http://localhost:8080/proxy"
  }
}
```

#### 4.2 Companion JSON Schema (`config.schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OpenYRWeb Engine Configuration",
  "description": "OpenYRWeb engine configuration file schema",
  "type": "object",
  "properties": {
    "server": {
      "type": "object",
      "description": "Server-related configuration",
      "properties": {
        "defaultLocale": {
          "type": "string",
          "description": "Default language code",
          "default": "en",
          "enum": ["en", "zh-CN", "zh-TW"]
        },
        "devMode": {
          "type": "boolean",
          "description": "Dev mode switch; when enabled, outputs detailed logs",
          "default": false
        }
      },
      "required": ["defaultLocale", "devMode"]
    },
    "viewport": {
      "type": "object",
      "description": "Game canvas viewport configuration",
      "properties": {
        "width": {
          "type": "integer",
          "description": "Canvas width (pixels)",
          "minimum": 640,
          "maximum": 3840,
          "default": 800
        },
        "height": {
          "type": "integer",
          "description": "Canvas height (pixels)",
          "minimum": 480,
          "maximum": 2160,
          "default": 600
        }
      },
      "required": ["width", "height"]
    },
    "network": {
      "type": "object",
      "description": "Network-related configuration",
      "properties": {
        "corsProxy": {
          "type": "string",
          "description": "CORS proxy server address, used for cross-origin resource loading issues",
          "format": "uri",
          "default": "http://localhost:8080/proxy"
        }
      },
      "required": ["corsProxy"]
    }
  },
  "required": ["server", "viewport", "network"]
}
```

Once a config editor (e.g., VS Code) loads this Schema, it can provide smart autocomplete, type hints, and hover descriptions.

### 5. Implementation Steps and Code Adjustments (Measured)

#### 5.1 Source Verification: Migration Point Checklist (grep measured)

A global search via `grep -r "config.ini"` confirmed that only 3 places in the project directly reference `config.ini`, making the migration scope clear:

1. **`src/Application.ts.js` around line 477**: `loadText("config.ini")` + `new IniFile().fromString(...)` → change to `loadJson("config.json")`
2. **`tools/build.mjs` around lines 34/222**: `SERVER_CFG` constant + `copyFileSync` into `build/` → change to copy `config.json` + `config.schema.json`
3. **`tools/fetch-client.mjs` around line 122**: fetch manifest item `{ path: "config.ini" }` → change to `config.json`

#### 5.2 Config.ts.js Adapter Core (Measured Implementation)

The adapter core `load(e)` receives a JSON object; `e.General` corresponds to the old `[General]` section; `generalData` preserves the old interface, accessing nested keys via dot-paths:

```javascript
const path = (o, k) => k.split(".").reduce((x, p) => (null == x ? void 0 : x[p]), o);

getString: (k, d) => {
  const v = path(t, k);
  return v == null ? d ?? "" : String(v);
}
```

For example, the `viewport.width` dot-path automatically hits the JSON nesting `{ viewport: { width: 1024 } }`, so all getters need zero changes.

#### 5.3 JSON Structure and Schema (Measured Design)

**config.json structure**:

```json
{
  "$schema": "./config.schema.json",
  "General": {
    "defaultLanguage": "zh-CN",
    "viewport": {
      "width": 1024,
      "height": 768
    },
    // ... other config
  },
  "CorsProxy": {
    "archive.org": "/cors-proxy?url="
  }
}
```

**config.schema.json key points**:

- Uses draft-07 standard
- The `General` section's required validates `defaultLanguage`, `viewport`, and other fields
- `additionalProperties: false` prevents wrong keys
- **Extra benefit**: structural problems in the original INI where keys like `discordUrl` were misplaced into the `[CorsProxy]` section were exposed and fixed during JSON-ification by the schema

#### 5.4 Build Script and Main Service Adjustments

**Update build script (`tools/build.mjs`)**:

```javascript
// Replace the original config.ini copy logic
copyFileSync(
  join(process.cwd(), 'server', 'config', 'config.json'),
  join(outputDir, 'server', 'config', 'config.json')
);
copyFileSync(
  join(process.cwd(), 'server', 'config', 'config.schema.json'),
  join(outputDir, 'server', 'config', 'config.schema.json')
);
```

**Adjust main service entry (`server/index.mjs`)**:

```javascript
// Initialize config; now loads config.json
const config = new Config();
console.log(`Running in ${config.devMode ? 'development' : 'production'} mode`);
console.log(`CORS proxy: ${config.getCorsProxy()}`);
```

### 6. Migration Verification and Future Suggestions

#### 6.1 Verification Steps (Measured Results)

1. **Config file verification**: Run `node -e "JSON.parse(...)"` to verify that `config.json` and `config.schema.json` have valid syntax.
2. **Build verification**: After running the build, confirm that `build/config.json` exists and is reachable via HTTP 200.
3. **Functional verification**: Launch the game in headless mode, enter the main menu normally, with no config error logs.
4. **Backward compatibility verification**: All code that gets config via the `Config` class getters needs no modification; the adapter layer works normally.

#### 6.2 Future Optimization Directions

- **Environment variable overrides**: Support overriding JSON config via environment variables (e.g., `OPENYRWEB_DEV_MODE`) for containerized deployment.
- **Config hot reload**: In dev mode, watch `config.json` file changes without restarting the service.
- **Format unification**: Gradually migrate other non-game-data .toml/.yaml config files in the project to the JSON + Schema system.
- **Config generation tool**: Provide a CLI tool that interactively generates a `config.json` with default values.
- **Schema validation integration**: Integrate JSON Schema validation at build time or runtime to ensure config format correctness.

### 7. Summary

Migrating OpenYRWeb's engine configuration from INI to JSON Schema is a typical engineering practice of "local optimization, global benefit." The keys are:

1. **Precisely define scope**: Only migrate the engine config, don't touch game data.
2. **Design an adapter layer**: Keep public interfaces unchanged, only replace the underlying data source, achieving zero intrusion.
3. **Leverage Schema**: Migrate comments and other metadata to the Schema, gaining modern dev toolchain support.

Through this migration, the OpenYRWeb project gained type safety, editor smart hints, and better maintainability, laying a solid foundation for future feature extension and team collaboration.

### 8. Practical Conclusion and Operation Guide

#### 8.1 Core Conclusion

**Clear migration boundaries**:

- **Migratable**: The engine's own configuration (`config.ini`) can be changed to JSON+Schema
- **Not migratable**: Game data INI (`rulesmd.ini`, `artmd.ini`, etc.) stays as-is; don't cross the line

**Structural conventions**:

- Top-level keys = old INI section names (`General`/`Sentry`/`CorsProxy`)
- Dot keys become nested objects (e.g., `viewport.width` → `{"viewport": {"width": 1024}}`)
- Original INI comments migrate to the Schema's `description` field
- Add a `"$schema": "./config.schema.json"` reference in the config file so the editor auto-validates

**Migration benefits**:

- Type safety: config values have explicit types (string, number, boolean, array)
- Wrong/missing keys are exposed at edit time, avoiding runtime errors
- Documentation as schema: config descriptions and validation rules are unified
- Future maintenance only requires modifying `config.json`, with no need to care about the underlying parsing logic

#### 8.2 Human Developer Operation Guide

**Self-check commands**:

```bash
# List all reference points
grep -rn "config.ini" src/ tools/ server/
# Validate JSON file syntax
node -e "JSON.parse(require('fs').readFileSync('config.json'))"
```

**Migration order**:

1. Write `config.json` + `config.schema.json`
2. Modify `Config.load()` adapter (preserve `getString`/`getNumber`/`getBool`/`getArray` interfaces)
3. Update build script, also copy the schema file
4. Rebuild the project
5. Open the page to verify config takes effect

#### 8.3 Conversational AI Q&A Template

**User question**: *"How to migrate OpenYRWeb's engine config from config.ini to config.json + JSON Schema?"*

**Answer points**:

1. First use `grep -rn "config.ini" src/ tools/ server/` to find all reference points (usually three: load, copy, manifest)
2. Modify `Config.load()` to be a JSON adapter, preserving the original `getString`/`getNumber`/`getBool`/`getArray` interfaces
3. Update `build.mjs` to also copy `config.json` and `config.schema.json`
4. **Important**: Do not touch game data INI (`rulesmd.ini`, etc.); keep it as-is

#### 8.4 Code Agent Executable Flow

1. `grep -rn "config.ini" src/ tools/ server/` → confirm reference points
2. Write `config.json` + `config.schema.json` (including the `$schema` reference)
3. Modify `Config.ts.js`'s `load()` method to be a JSON adapter (support dot-path access to nested keys)
4. Modify `Application.ts.js` to change `loadText("config.ini")` to `loadJson("config.json")`
5. Update `build.mjs` copy logic
6. Run `npm run build`
7. Verify the game's main menu loads normally in headless mode

**One-line summary**: *Only change the engine config, don't touch game data; the adapter layer preserves interfaces, JSON+Schema provides type safety; three steps: find references, change loading, verify functionality.*

---

<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-config-migration-ini-json.html
