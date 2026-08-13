# 中英双语 EVA 副官：让原版语音让位给自定义播报

> 日期：2026-08-07

### 1. 背景

红警引擎的副官（EVA）语音是游戏体验的一部分。原版引擎播放 mix 里的 ceva/csof wav（`eva.ini` 的 `[DialogList]` 查表）。想让副官说中文/说自定义英文，需要两条路：一是摸清引擎到底会触发哪些 EVA 事件，二是设计一套自定义语音的映射结构。

### 2. 摸清引擎的 64 条 EVA 事件

第一步不是猜，而是从源码和原版数据里挖：

- 引擎源码 `eva.play("EVA_xxx")` 调用点：grep 全部字面量，去重得到引擎实际触发的 EVA 事件名；
- 从 `ra2.mix > local.mix` 提取 `eva.ini`，解析 `[DialogList]`（356 条有效条目），逐条取 `Text`（原版英文句）和 `Allied/Russian`（音色文件）；
- 交集确认：引擎引用的 64 条事件全部在 eva.ini 有对应 Text + 音色。

**关键洞察：引擎只触发 64 条，eva.ini 全集 356 条里的任务目标类（EVA_MissionAccomplished 等）用不上**。所以自定义语音只做引擎实际会触发的子集即可。

### 3. 事件语义标注

把 64 条按用途分类，决定做不做：

| 分组 | 数量 | 说明 |
|---|---|---|
| 经济/建造/单位（核心） | 30 | 建造完成、资金不足、电力不足、单位就绪等 |
| 占领/驻军 | 4 | 建筑被占领、驻军、弃守 |
| 间谍/渗透/升级 | 12 | 资金被窃、雷达被破、单位晋升等 |
| 联盟 | 5 | 结盟、断盟、请求结盟 |
| 超武 | 13 | 核弹、铁幕、超时空、闪电风暴（MOD 无超武可不做） |

每条有原版英文句 + 中文翻译，形成中英双语对照表。

### 4. 语音映射结构（JSON + Schema）

`design/voice/{en,zh-CN}/event_voice_mapping.json`：

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

`schema/voice.schema.json` 锁死：

- 事件键必须属于 64 条 EVA 枚举（`propertyNames.enum`）；
- 每条必填 `filename` + `text`，`additionalProperties:false`；
- `filename` 必须等于事件键 + `.wav`。

这样拼写错误在写 JSON 时就报错，而不是运行时才炸。

### 5. 引擎消费端（待接线）

当前状态：语音文件已生成注入 OPFS，mapping 已就位并通过 Schema 校验；但引擎的 `eva.play()` 仍走 eva.ini → 原版 mix 语音。让自定义语音真正发声需要引擎接线：事件触发 → 读 `design/voice/{lang}/mapping` → 播自定义 wav（找不到回退 eva.ini 原版）。这是下一步的候选工作，已记录在 `docs/PORTING.md`。

### 6. 结论

中英双语副官的骨架是「事件枚举（64 条）+ 双语文本 + JSON Schema 映射 + TTS 生成」。先摸清引擎触发面再做语音，避免为 356 条全集白做 300 条用不上的音频；Schema 锁枚举保证映射与引擎事实同步，是「让原版语音让位」的第一步。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-bilingual-eva-voice.html
