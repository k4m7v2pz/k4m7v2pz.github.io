# egui 中文渲染整体偏高：FontTweak 基线对齐修复实录

> 日期：2026-08-05

## 一、触发场景：日志查看器里中文「飘」起来了

用 Rust + egui（eframe）给 KeePass 同步守护进程写了个日志查看器。日志里既有英文，也有中文内容（比如文件路径里的「密码数据库」）。第一次跑起来就发现：**英文正常，中文整体偏高**——中文字形像「飘」在英文基线上面，同一行里中英不共线，排版很扎眼。

环境：macOS（Apple Silicon arm64）、Rust 1.81+（本机 1.96）、eframe 0.31（egui 0.31）、等宽字体渲染日志。

## 二、谬误溯源：问题不在「选什么字体」，在「字体度量」

先给结论：**这是回退字体与主字体的度量（metrics）不一致导致的排版偏差，根因在 egui 的字形摆放逻辑，跟你选哪款中文字体关系不大。**

推演路径：

1. egui 的默认字体（Ubuntu-Light / UbuntuMono）**不含中文字形**，直接渲染中文会变成方块 □。
2. 所以常规做法是：手动读系统 CJK 字体（macOS 上是 PingFang.ttc），插进 `FontDefinitions::font_data`，再追加到 `Proportional` / `Monospace` 家族末尾当**回退字体**。
3. 排版时：拉丁字符命中主字体，中文命中回退字体。两类字体的**度量并不一致**（ascent / descent / em 框高度都不同），字形按各自字体的度量摆放，基线没有对齐——于是中文字形整体偏高。
4. 常见试错：换字体、调行高、改字号——全都没用，因为没碰到真正的开关。真正的开关在 egui 暴露的 **`FontTweak`**：给回退字体设一个纵向偏移，把中文字形压回与英文共用的基线。修复只改一处、一行代码，下文给出完整代码与调试方法。

## 三、源码验证：两行改动解决问题

先看「修复前」——中文偏高的版本。加载字体的函数长这样（问题复现）：

```rust
// 修复前：中文整体偏高
fn install_cjk_fonts(ctx: &egui::Context) {
    let bytes = std::fs::read("/System/Library/Fonts/PingFang.ttc").unwrap();
    let mut fonts = egui::FontDefinitions::default();
    // egui 0.31 起 font_data 的值类型是 Arc<FontData>，需要 .into()
    fonts.font_data
        .insert("cjk".to_owned(), egui::FontData::from_owned(bytes).into());
    for family in [egui::FontFamily::Proportional, egui::FontFamily::Monospace] {
        fonts.families.entry(family).or_default().push("cjk".to_owned());
    }
    ctx.set_fonts(fonts);
}
```

修复只需要改一处：插入前给 `FontData` 设置 `tweak`：

```rust
// 修复后：中文与英文基线对齐
let mut cjk = egui::FontData::from_owned(bytes);
cjk.tweak = egui::FontTweak {
    y_offset_factor: 0.2, // 中文字形下移量 = 字号 × 0.2（正方向为屏幕向下）
    ..Default::default()
};
fonts.font_data.insert("cjk".to_owned(), cjk.into());
```

`FontTweak` 有四个字段，本次只用到一个：

| 字段 | 语义 |
|---|---|
| scale | 整体缩放比例，默认 1.0 |
| y_offset_factor | 纵向偏移，**按字号比例**（0.2 = 字号 × 0.2） |
| y_offset | 纵向偏移，绝对点数 |
| baseline_offset | 基线偏移，绝对点数 |

为什么有效：中文偏高 = 字形需要整体**下移**，正方向恰好是屏幕向下；`0.2` 是实测值，12pt 等宽字体下英文与中文对齐良好。选 `y_offset_factor` 而非 `y_offset`，是因为它随字号缩放——以后改字号，偏移自动跟随，不用再调。实测环境：macOS arm64 / rustc 1.96（项目 MSRV 1.81）/ eframe 0.31 / PingFang.ttc。

## 四、落地结论

**一句话**：egui 手动加载系统 CJK 字体后中文整体偏高，根因是回退字体与主字体的度量不一致、字形未对齐基线；解法是在 `FontData.tweak` 上设 `y_offset_factor` 把中文字形下移，无需换字体。

**调试口诀**：偏上 → 调大（0.2 → 0.25 / 0.3）；偏下 → 调小（0.2 → 0.15）；每次步进 0.05，只改一个常量。

### 人类开发者速查

```rust
let mut cjk = egui::FontData::from_owned(bytes);
cjk.tweak = egui::FontTweak { y_offset_factor: 0.2, ..Default::default() };
fonts.font_data.insert("cjk".to_owned(), cjk.into());
```

注意三点：0.31 起 `font_data` 值是 `Arc<FontData>` 要 `.into()`；`PingFang.ttc` 是字体集合，egui 取 index 0，可用；字体候选链建议 PingFang → Hiragino Sans GB → Arial Unicode，逐个降级。

### 对话式 AI 速查

把下面这段直接贴给 ChatGPT / 腾讯元宝 / 豆包：

> 我在 Rust egui（eframe 0.31）里手动加载系统 CJK 字体作为回退字体后，中文整体比英文偏高、基线不齐。已知 FontTweak 的 y_offset_factor 可按字号比例做纵向偏移。请给出：1) 加载 PingFang 并设置 y_offset_factor 的完整函数；2) 偏上/偏下时如何调整参数。

### 代码 Agent 速查（Copilot / Trae / AtomCode 等）

定位线索：`egui::FontTweak`（字段 scale / y_offset_factor / y_offset / baseline_offset）、`egui::FontData::tweak`、`egui::FontDefinitions::font_data`（0.31 起值为 `Arc<FontData>`）。修复点在加载字体后、插入 `font_data` 之前设置 tweak；若改动字号，偏移用 `y_offset_factor`（按比例）而非 `y_offset`（固定点数），可随字号自适应。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/egui-cjk-rendering-fonttweak.html
