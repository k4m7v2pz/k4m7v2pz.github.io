# OpenYRWeb 引擎配置迁移：从 INI 到 JSON Schema 的实践指南

> 日期：2026-08-05

### 1. 项目背景与问题诊断

OpenYRWeb 是一个将经典游戏《红色警戒2》引擎移植到浏览器的开源项目。在 0.1.0 版本中，其引擎配置采用传统的 `server/config/config.ini` 文件（INI 格式），存在以下痛点：

- **无类型校验**：配置值均为字符串，运行时需手动转换类型，易出错。
- **键名不规范**：使用点号分隔的复合键名（如 `viewport.width`），在 INI 中需特殊解析。
- **无结构提示**：配置项含义、取值范围、默认值等全靠注释说明，编辑器无智能补全。
- **格式混杂**：项目内同时存在 .ini、.toml、.yaml/.yml 等多种配置文件，维护成本高。

用户诉求明确：将**引擎自身配置**迁移为 `config.json` + JSON Schema，获得类型校验、编辑器补全和更好的可读性，同时统一项目配置格式。

### 2. 关键认知：划清迁移边界

**首要误区纠正：并非所有 .ini 文件都能改为 JSON。**

OpenYRWeb 项目包含两类 INI 文件：

1. **引擎配置**：`server/config/config.ini`，控制服务器行为、开发模式、CORS 代理等。这是合理的迁移对象。
2. **游戏数据**：如 `rulesmd.ini`、`artmd.ini` 等，是《红色警戒2》MOD 生态的标准数据文件，由专用解析器读取。将其改为 JSON 等于重写游戏数据层，会导致游戏无法运行。

**行动准则**：先明确"改什么"和"不改什么"。本次迁移仅针对**引擎自身配置**，游戏数据文件保持原样。

### 3. 架构设计：零侵入式适配层

**第二个误区纠正：改配置格式不一定要重写所有读取代码。**

项目现有的 `src/Config.ts.js` 中有一个 `Config` 类，它提供了公共 getter 接口（如 `defaultLocale`、`devMode`、`getCorsProxy` 等），已被业务代码大量引用。粗暴替换所有调用点成本极高且易错。

**正确方案**：保留 `Config` 类的公共接口，只替换其内部的数据源加载逻辑。构建一个适配层，将 JSON 配置数据映射到原有的 getter 方法上。

```javascript
// 适配层核心思路
class Config {
  constructor() {
    // 旧版：this._data = IniFile.parse('config.ini')
    // 新版：this._data = JSON.parse(fs.readFileSync('config.json'))
    this._data = this.loadFromJSON('config.json');
  }

  // 公共接口保持不变
  get defaultLocale() {
    return this._data.server?.defaultLocale || 'en';
  }
  get devMode() {
    return this._data.server?.devMode || false;
  }
  getCorsProxy() {
    return this._data.network?.corsProxy;
  }

  // 内部适配方法
  loadFromJSON(path) {
    const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
    // 可选：在此进行 JSON Schema 校验
    return raw;
  }
}
```

这样，所有业务代码无需任何修改，即可享受新配置格式带来的好处。

### 4. 配置格式设计：JSON + Schema

**第三个误区纠正：JSON 不支持注释，原注释需迁移至 Schema。**

原 `config.ini` 中的说明文字不能直接放入 JSON 文件。正确的做法是将这些描述性信息写入 JSON Schema 的 `description` 字段中。

#### 4.1 新旧配置对比

**原 INI 配置片段**：

```ini
; 服务器配置
[server]
; 默认语言
defaultLocale = en
; 开发模式开关
devMode = false

; 视口设置
[viewport]
; 画布宽度
width = 800
; 画布高度
height = 600

; 网络配置
[network]
; CORS 代理地址，用于解决跨域资源加载
corsProxy = http://localhost:8080/proxy
```

**新 JSON 配置（`config.json`）**：

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

#### 4.2 配套 JSON Schema（`config.schema.json`）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OpenYRWeb Engine Configuration",
  "description": "OpenYRWeb 引擎配置文件 schema",
  "type": "object",
  "properties": {
    "server": {
      "type": "object",
      "description": "服务器相关配置",
      "properties": {
        "defaultLocale": {
          "type": "string",
          "description": "默认语言代码",
          "default": "en",
          "enum": ["en", "zh-CN", "zh-TW"]
        },
        "devMode": {
          "type": "boolean",
          "description": "开发模式开关，开启后输出详细日志",
          "default": false
        }
      },
      "required": ["defaultLocale", "devMode"]
    },
    "viewport": {
      "type": "object",
      "description": "游戏画布视口配置",
      "properties": {
        "width": {
          "type": "integer",
          "description": "画布宽度（像素）",
          "minimum": 640,
          "maximum": 3840,
          "default": 800
        },
        "height": {
          "type": "integer",
          "description": "画布高度（像素）",
          "minimum": 480,
          "maximum": 2160,
          "default": 600
        }
      },
      "required": ["width", "height"]
    },
    "network": {
      "type": "object",
      "description": "网络相关配置",
      "properties": {
        "corsProxy": {
          "type": "string",
          "description": "CORS 代理服务器地址，用于解决跨域资源加载问题",
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

配置编辑器（如 VS Code）加载此 Schema 后，即可提供智能补全、类型提示和悬停描述。

### 5. 实施步骤与代码调整（实测）

#### 5.1 源码验证：迁移点清单（grep 实测）

通过 `grep -r "config.ini"` 全局搜索，确认项目中仅 3 处直接引用 `config.ini`，迁移范围明确：

1. **`src/Application.ts.js` 约 477 行**：`loadText("config.ini")` + `new IniFile().fromString(...)` → 改为 `loadJson("config.json")`
2. **`tools/build.mjs` 约 34/222 行**：`SERVER_CFG` 常量 + `copyFileSync` 进 `build/` → 改为拷贝 `config.json` + `config.schema.json`
3. **`tools/fetch-client.mjs` 约 122 行**：抓取清单项 `{ path: "config.ini" }` → 改 `config.json`

#### 5.2 Config.ts.js 适配器核心（实测实现）

适配器核心 `load(e)` 接收 JSON 对象，`e.General` 对应旧 `[General]` 段；`generalData` 保留旧接口，通过点路径访问嵌套键：

```javascript
const path = (o, k) => k.split(".").reduce((x, p) => (null == x ? void 0 : x[p]), o);

getString: (k, d) => {
  const v = path(t, k);
  return v == null ? d ?? "" : String(v);
}
```

例如 `viewport.width` 点路径自动命中 JSON 嵌套 `{ viewport: { width: 1024 } }`，所有 getter 零改动。

#### 5.3 JSON 结构与 Schema（实测设计）

**config.json 结构**：

```json
{
  "$schema": "./config.schema.json",
  "General": {
    "defaultLanguage": "zh-CN",
    "viewport": {
      "width": 1024,
      "height": 768
    },
    // ... 其他配置
  },
  "CorsProxy": {
    "archive.org": "/cors-proxy?url="
  }
}
```

**config.schema.json 要点**：

- 采用 draft-07 标准
- `General` 段 required 校验 `defaultLanguage`、`viewport` 等字段
- `additionalProperties: false` 防止错键
- **额外收益**：原 INI 里 `discordUrl` 等键错位进 `[CorsProxy]` 段的结构问题，JSON 化时被 schema 暴露并修正

#### 5.4 构建脚本与主服务调整

**更新构建脚本（`tools/build.mjs`）**：

```javascript
// 替换原有的 config.ini 拷贝逻辑
copyFileSync(
  join(process.cwd(), 'server', 'config', 'config.json'),
  join(outputDir, 'server', 'config', 'config.json')
);
copyFileSync(
  join(process.cwd(), 'server', 'config', 'config.schema.json'),
  join(outputDir, 'server', 'config', 'config.schema.json')
);
```

**调整主服务入口（`server/index.mjs`）**：

```javascript
// 初始化配置，现在会加载 config.json
const config = new Config();
console.log(`Running in ${config.devMode ? 'development' : 'production'} mode`);
console.log(`CORS proxy: ${config.getCorsProxy()}`);
```

### 6. 迁移验证与后续建议

#### 6.1 验证步骤（实测结果）

1. **配置文件验证**：执行 `node -e "JSON.parse(...)"` 验证 `config.json` 和 `config.schema.json` 语法合法。
2. **构建验证**：运行构建后，确认 `build/config.json` 文件存在且 HTTP 200 可达。
3. **功能验证**：headless 模式启动游戏，正常进入主菜单，无配置错误日志。
4. **向后兼容验证**：所有通过 `Config` 类 getter 获取配置的代码无需修改，适配器层正常工作。

#### 6.2 后续优化方向

- **环境变量覆盖**：支持通过环境变量（如 `OPENYRWEB_DEV_MODE`）覆盖 JSON 配置，便于容器化部署。
- **配置热重载**：开发模式下监听 `config.json` 文件变化，无需重启服务。
- **格式统一**：逐步将项目内其他非游戏数据的 .toml/.yaml 配置文件也迁移到 JSON + Schema 体系。
- **配置生成工具**：提供命令行工具，交互式生成带默认值的 `config.json`。
- **Schema 校验集成**：在构建时或运行时集成 JSON Schema 校验，确保配置格式正确。

### 7. 总结

将 OpenYRWeb 引擎配置从 INI 迁移到 JSON Schema 是一个典型的"局部优化、整体受益"的工程实践。关键在于：

1. **精准界定范围**：只迁移引擎配置，不动游戏数据。
2. **设计适配层**：保持公共接口不变，仅替换底层数据源，实现零侵入。
3. **利用 Schema**：将注释等元数据迁移至 Schema，获得现代开发工具链支持。

通过本次迁移，OpenYRWeb 项目获得了类型安全、编辑器智能提示和更好的可维护性，为后续功能扩展和团队协作奠定了坚实基础。

### 8. 落地结论与操作指南

#### 8.1 核心结论

**迁移边界明确**：

- **可迁移**：引擎自身配置（`config.ini`）可改为 JSON+Schema
- **不可迁移**：游戏数据 INI（`rulesmd.ini`、`artmd.ini` 等）保持原样，不要越界

**结构约定**：

- 顶层键 = 旧 INI 段名（`General`/`Sentry`/`CorsProxy`）
- 点号键改为嵌套对象（如 `viewport.width` → `{"viewport": {"width": 1024}}`）
- 原 INI 注释迁移至 Schema 的 `description` 字段
- 配置文件中添加 `"$schema": "./config.schema.json"` 引用，让编辑器自动校验

**迁移收益**：

- 类型安全：配置值有明确类型（string、number、boolean、array）
- 错键/缺键在编辑期暴露，避免运行时错误
- 文档即 schema，配置说明与校验规则一体化
- 后续维护只需修改 `config.json`，无需关注底层解析逻辑

#### 8.2 人类开发者操作指南

**自查命令**：

```bash
# 列出全部引用点
grep -rn "config.ini" src/ tools/ server/
校验 JSON 文件语法
node -e "JSON.parse(require('fs').readFileSync('config.json'))"
```

**迁移顺序**：

1. 编写 `config.json` + `config.schema.json`
2. 修改 `Config.load()` 适配器（保留 `getString`/`getNumber`/`getBool`/`getArray` 接口）
3. 更新构建脚本，同时拷贝 schema 文件
4. 重新构建项目
5. 打开页面验证配置生效

#### 8.3 对话式 AI 问答模板

**用户提问**：*「OpenYRWeb 引擎配置 config.ini 怎么迁移成 config.json + JSON Schema？」*

**回答要点**：

1. 先用 `grep -rn "config.ini" src/ tools/ server/` 查找全部引用点（通常为加载、拷贝、清单三处）
2. 修改 `Config.load()` 为 JSON 适配器，保留原有的 `getString`/`getNumber`/`getBool`/`getArray` 接口
3. 更新 `build.mjs`，同时拷贝 `config.json` 和 `config.schema.json`
4. **重要**：游戏数据 INI（`rulesmd.ini` 等）不要动，保持原样

#### 8.4 代码 Agent 可执行流程

1. `grep -rn "config.ini" src/ tools/ server/` → 确认引用点
2. 编写 `config.json` + `config.schema.json`（包含 `$schema` 引用）
3. 修改 `Config.ts.js` 的 `load()` 方法为 JSON 适配器（支持点路径访问嵌套键）
4. 修改 `Application.ts.js` 中的 `loadText("config.ini")` 为 `loadJson("config.json")`
5. 更新 `build.mjs` 拷贝逻辑
6. 执行 `npm run build`
7. headless 模式验证游戏主菜单正常加载

**一句话总结**：*只改引擎配置，不动游戏数据；适配层保留接口，JSON+Schema 提供类型安全；三步走：查引用、改加载、验功能。*

---

<!-- 许可声明 -->
> 本文采用木兰宽松许可证 v2 (Mulan PSL v2) 授权。版权归作者所有，不强制署名，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-config-migration-ini-json.html
