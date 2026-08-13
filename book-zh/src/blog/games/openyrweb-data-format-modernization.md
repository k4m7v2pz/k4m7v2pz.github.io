# mix/SHP/ini → PNG/WAV/JSON：老引擎的数据格式现代化

> 日期：2026-08-07

### 1. 三种格式的迁移动机

OpenYRWeb 引擎沿用了红警2 的经典数据格式：二进制 mix 包、8-bit 调色板 SHP 图、无结构的 ini 规则。这些格式在 2000 年代是性能最优解，但对现代开发与 Agent 协作并不友好。改造选择了三组替代：

| 原格式 | 新格式 | 理由 |
|---|---|---|
| mix（二进制打包） | 目录 + OPFS 注入 | 可增量修改、可版本管理 |
| SHP（调色板索引） | PNG（RGBA 直色） | 图像编辑工具链通用、支持 @2x |
| ini（无类型） | JSON + JSON Schema | 可校验、可枚举、可生成、IDE 补全 |

### 2. SHP → PNG 的迁移路径

SHP 是 8-bit 调色板索引，渲染时按 palette 上色；PNG 是 32-bit RGBA 直色。迁移不是简单换文件，而是渲染管线的适配：

1. **图块层**：新增 `PngTileset`，读 `meta.json`（tile 编号 → PNG 文件 + subTile 布局），解码后注入地形图块系统；
2. **建筑层**：新增 `PngShpFile` 把 RGBA 包装成 ShpFile 兼容对象，`ImageFinder` 在 `.shp` 缺失时回退同名 `.png`；
3. **材质层**：`ShpBuilder` 支持 RGBAFormat 直色材质（MeshBasicMaterial），跳过调色板路径与批处理路径。

关键坑：SHP 有「主帧 + 阴影半帧」布局（`frameCount = numImages * (hasShadow ? 0.5 : 1)`），PNG 只有一帧，直接套用会把 1 帧算成 0 帧，聚合出空文件。必须对 RGBA 直色帧特判。

### 3. WAV 语音的接入

语音原本在 mix 里的 ceva/csof wav，引擎按 `eva.ini` 的 `[DialogList]` 查表播放。接入自定义 WAV 的方式：

- 用 TTS 批量合成（Qwen-TTS，Neil 音色），输出 `audio/voice/{lang}/EVA_*.wav`；
- `design/voice/{lang}/event_voice_mapping.json` 描述事件 → 文件名 → 文本；
- 事件键对齐引擎实际触发的 64 条 EVA 事件枚举，保证映射可校验。

### 4. ini → JSON 的迁移路径

规则从「手写 flat ini 段」迁移到「design JSON → 生成 ini」：

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

- 支持对象继承（abstract 基类 → 阵营实体 extends）；
- JSON Schema 锁死结构：字段必填、`additionalProperties:false`、事件名枚举；
- `build-json-rules.mjs` 解析继承、校验引用完整性、生成 flat INI 段；
- 引擎只读 rulesmd.ini，生成的段需要合入 `[BuildingTypes]` 注册表（当前由生成管线输出，合入为后续工作）。

### 5. 迁移的收益与遗留

**收益**：可复现（重跑生成脚本即可）、可校验（Schema + playwright）、Agent 友好（JSON 可枚举、可提示）。

**遗留**：生成的 flat INI 段与 rulesmd.ini 的 `[BuildingTypes]` 注册尚未自动化合入；语音 mapping 的引擎消费端（事件触发 → 播 wav）仍是待接线状态——原版 eva.ini 语音继续兜底。这两条作为后续迭代方向记录在 `docs/PORTING.md`。

### 6. 结论

格式现代化的本质是「三层管道的逐一适配」：数据加载（mix → OPFS）→ 资源包装（SHP → PngShpFile）→ 渲染材质（palette → RGBA）。每一层都有隐性假设，改一层崩一层；把假设写成踩坑记录（`docs/PORTING.md`）后，后续同类迁移可以直接复用排查路径。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-data-format-modernization.html
