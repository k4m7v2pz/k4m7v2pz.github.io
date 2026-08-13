<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 用 JSON Schema 锁死规则配置：事件枚举与 AI 幻觉防护

> 日期：2026-08-07

### 1. 为什么规则配置需要 Schema

红警引擎的规则是 ini（无结构、无类型）。MOD 要表达「油井经济」「三阵营继承」「64 条语音映射」这类结构化概念时，ini 手写容易错、难校验、Agent 改不动。改造方案：规则用 JSON 描述，JSON Schema 锁死结构，构建脚本生成引擎能读的 flat INI。

### 2. 三层配置体系

```
design/
├── mod.json                    # MOD 元数据（i18n 双语）
├── economy.json                # 油井经济（产出、延迟、启动资金）
├── tech-tree.json              # 科技树（T1/T2/T3 跃迁）
├── entities/buildings/
│   ├── 通用/油井.json          # abstract 基类（成本、产出、前置）
│   ├── 盟军/油井.json          # extends 基类，owner=[Allied]
│   ├── 苏军/油井.json          # extends 基类，owner=[Soviet]
│   └── 尤里/油井.json          # extends 基类，owner=[Yuri]
└── voice/{en,zh-CN}/event_voice_mapping.json
```

`schema/` 下每个 JSON 配一个 Schema（draft-07，与引擎侧一致）。

### 3. Schema 怎么「锁死」

以 `building.schema.json` 为例，几个关键约束：

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
  "then": { "description": "抽象模板只需 id + name" },
  "else": { "required": ["code", "techLevel", "prerequisites", "buildCat"] },
  "additionalProperties": false
}
```

- `required` + `additionalProperties:false`：缺字段、多字段都报错；
- `enum`：owner 只能是三阵营、buildCat 只能是固定分类；
- `if/then/else`：abstract 基类与具体实体的必填字段不同；
- 语音 Schema 用 `propertyNames.enum` 把事件键锁死在 64 条 EVA 枚举上。

### 4. 防 AI 幻觉的机制

Agent 改配置时的幻觉（拼错字段名、编造事件、格式错）被三层拦住：

1. **编辑器实时校验**：JSON 带 `$schema` 指针，IDE 自动补全 + 报错；
2. **构建时校验**：`build-json-rules.mjs` 解析继承、校验引用完整性（id/code 唯一、prerequisites 存在）、跑 Schema 校验，失败即退出；
3. **运行时枚举**：语音事件键必须命中引擎实际触发的 64 条枚举——编造一个不存在的 EVA 事件，Schema 直接拒绝。

### 5. 对象继承

```
通用/油井.json（abstract：techLevel=1, cost=800, produceCash=500/25/5）
├── 盟军/油井.json → AILW（owner=Allied）
├── 苏军/油井.json → SILW（owner=Soviet）
└── 尤里/油井.json → YILW（owner=Yuri）
```

构建时深合并覆盖基类，生成 flat INI 段（`ProduceCashStartup/Amount/Delay` 等油井经济键）。新增阵营只需复制一个实体 JSON，改 owner 与 code。

### 6. 结论

JSON Schema 把「人读的 JSON」和「引擎读的 INI」之间的契约锁死：结构错误在编辑期暴露、引用错误在构建期暴露、枚举错误在 Schema 期暴露——三道人墙把 AI 幻觉挡在规则层之外。这也是整个 MOD「Agent 友好」的根基：Agent 改配置不会改坏，因为 Schema 就是它的护栏。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-json-schema-rules.html
