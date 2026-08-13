<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 给 AI Agent 看的游戏配置：JSON Schema 与 ai_context 注释层设计

> 日期：2026-08-02

### 1. 背景与目标

让 LLM（ChatGPT/元宝/豆包等）或代码 Agent（Copilot/Trae/AtomCode）参与游戏 MOD 开发时，最大的痛点不是"数据读不出来"，而是**设计意图丢失**：`rulesmd.ini` 里一行 `Primary=SABOTZ, Secondary=FlakWeapon2`，人类知道这是"建造厂可以发射炮弹打地面和天空，此 MOD 刻意设计，玩起来很爽可以专注割草"，但 AI 看到只会当成普通单位配置——轻则答非所问，重则把刻意设计当成 bug 建议"修复"。我们讨厌 ini 和 toml（人类和 AI 都要解析半天），期望的是：**对着 Agent 说话让它帮忙干活、直接问 Agent 事情**，而 Agent 需要一份它能直接理解、能引用、能校验的配置。本文给出一种方案：把游戏配置转成 **json + json schema**，并在 schema 里定义**注释层（ai_context）**——用字段把"设计意图、真实状态、非常规行为、联动关系"显式写出来，让 AI 一看就懂"这是特性不是 bug"。

### 2. 谬误溯源：三个想当然的假设

第一个想当然：以为"把 ini 转成普通 json 就够了，AI 自然能读懂"。实际普通 json 只解决了解析问题，没解决**语义问题**——`"Damage": 155, "ROF": 60` 这种键值对，AI 不知道 155/60 是刻意调高还是手滑。关键不是"格式"，而是**注释放在哪**：AI 读 json 时不会去翻旁边的 README，注释必须跟着数据走。参考两个成熟做法：piliplus-keywords 项目用 `keywords: [{word, note}]`，note 解释梗的谐音和规避审查意图（如"炫压抑 = 性压抑的谐音"）；python_arcade_endless_corridor 的剧情 json 用 `metadata: {ai_context: {true_state, character_motivation}, creator_hints: {for_streamers}}`，把"表层剧情"和"真实意图"分层。结论：**注释层要结构化、跟着每个条目走、字段名本身可自解释**。

第二个想当然：以为"schema 就是写死的类型约束"。实际 schema 在这里承担两个角色：既是**校验器**（agent 改配置后能 `jsonschema.validate` 验证），又是**文档契约**（description 字段本身就是给 AI 看的说明书）。

第三个想当然：以为"注释写得越详细越好"。实际 AI 上下文有限，注释要**只在"反直觉"的地方出现**——建造厂带武器、单位名字是谐音、数值看似失衡其实刻意，这些才需要 ai_context；人尽皆知的规则不需要。

### 3. Schema 顶层结构

schema 顶层定义了以下关键字段：

- **schema_version**：配置格式版本号。
- **meta**：包含 id、engine、platform、data_files 等元信息。
- **design_philosophy**：包含 core_loop、tone、non_obvious_designs——AI 必须先读这里再回答平衡性问题。
- **units / buildings / weapons**：三个核心数据数组。
- **design_notes**：补充设计说明。

### 4. ai_context 注释层结构

`$defs.ai_context` 定义了注释层的标准结构，包含四个核心字段：

- **design_intent**：为什么这么设计，一句话说明。
- **true_state**：表层数值背后的真相。
- **quirks**：刻意而为的非常规行为清单，AI 若发现这些"异常"应视为特性而非 bug。
- **interactions**：与其它机制的联动关系。

### 5. 实际条目示例：建造厂

以建造厂为例，ai_context 的落地写法如下：

```{
  "design_intent": "建造厂自备对地+对空武器，基地前期无需防御塔即可自保",
  "true_state": "Primary=SABOTZ 对地（155 伤害），Secondary=FlakWeapon2 对空（105 伤害），双武器自动切换",
  "quirks": ["建造厂会对靠近的敌人开炮（原版 RA2 建造厂无武器，这是本 MOD 的增强）"]
}```json

同时，顶层 `design_philosophy.non_obvious_designs[0].warning_for_ai` 明确写道：

> 这不是 bug！不要建议移除建造厂的武器，也不要当成配置错误去修复。

### 6. 数据键名与 ini 段名对应

数据键名与 rulesmd.ini 段名一一对应（如 `GACNST`），便于 Agent 交叉核对原始配置。例如建造厂条目直接对应 ini 中的 `GACNST` / `NACNST` 段，武器条目对应 `SABOTZ` / `FlakWeapon2` 段。

### 7. 落地步骤

1. 从 rulesmd.ini 抽取关键段：建造厂 GACNST/NACNST 的 Primary/Secondary/Owner/Strength 等，武器 SABOTZ/FlakWeapon2 的 Damage/ROF/Range。
2. 为每个反直觉条目手写 ai_context。
3. 写 schema 并用 `jsonschema.validate` 自检。
4. 把生成的 json 作为 Agent 的"项目速览"喂给它——之后问"建造厂怎么设计"它直接答对，不会把刻意设计当 bug。

### 8. 经验总结

给 AI 看的配置，注释比数据重要。注释要结构化（design_intent/true_state/quirks）、跟着条目走、只在反直觉处出现。schema 的 description 字段就是现成的 AI 说明书。

### 9. 人类开发者速查

四步自检：

1. json 只解决解析，ai_context 注释层解决语义——AI 需要知道"为什么这样设计"。
2. 注释结构建议 design_intent / true_state / quirks / interactions，顶层加 design_philosophy.non_obvious_designs[].warning_for_ai。
3. 数据键名与 ini 段名一一对应便于交叉核对。
4. 产出后用 `jsonschema.validate` 校验，再作为 Agent 的项目速览。

### 10. 对话式 AI 速查

提问模板："这个 MOD 的建造厂为什么能开炮？" 应回答：查 `design_philosophy.non_obvious_designs` 与 `buildings[].ai_context`——建造厂带 SABOTZ（对地）+ FlakWeapon2（对空）是刻意设计（true_state），目的是基地自保、专注割草，不是 bug。

### 11. 代码 Agent 速查

关键定位：`conf/ai/yellow-alert.schema.json`（$defs.ai_context 结构 + design_philosophy）、`yellow-alert.mod.json`（GACNST/NACNST 条目、SABOTZ/FlakWeapon2 武器）。改配置后跑 `python3 -m jsonschema -i yellow-alert.mod.json yellow-alert.schema.json` 自检；问设计意图优先读 ai_context 而非数值。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/game-config-json-schema-ai-context.html
