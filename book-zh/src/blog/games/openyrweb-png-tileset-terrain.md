# PNG tileset 替换地形图块：从 mix 里挖 meta.json 的真相

> 日期：2026-08-07

### 1. 目标与背景

OpenYRWeb 的地形图块原本在 mix 包的 .tem 文件里，靠 `temperatmd.ini` 的 `[TileSetXXXX]` 段描述（tileSetIndex → SetName/FileName/TilesInSet）。自制图块集 `yuanbao` 想用 PNG 替换：256×128 图块 + @2x 高清版，语义上对应「兵营/轻工厂/油井/建造厂」等建筑图块。

### 2. 从 mix 里挖出真相

第一步是搞清楚引擎怎么索引图块。写脚本解开 `ra2md.mix > localmd.mix` 里的 `temperatmd.ini`，逐段打印：

```
TileSet0010: SetName=Cliff Set FileName=Cliff TilesInSet=40
```

**关键发现：`yuanbao` 的 `tileSetIndex=10` 对应的是原版「Cliff Set（山崖集）」**。这意味着：

- 把自制建筑图块放在 yuanbao 的 tile 编号上，会**覆盖地图上所有引用该编号的山崖图块**；
- 如果不想让山崖地形被覆盖，PNG tileset 只应替换它拥有的图块，缺失的 tile 要回退原版 .tem。

### 3. meta.json 的结构

PNG tileset 目录结构：

```
tilesets/yuanbao/
├── meta.json            # tile 语义 + subTile 布局
├── tile_16.png / @2x    # 兵营（石头房子）
├── tile_17.png / @2x    # 兵营（砖房子）
├── tile_20.png / @2x    # 轻工厂
└── oil_well.png / @2x   # 油井
```

`meta.json` 每个 tile 条目：

```json
{
  "tile": 16,
  "description": "兵营（石头房子）",
  "variants": [{
    "file": "tile_16.png",
    "subTiles": [{
      "x": 0, "y": 0, "w": 256, "h": 128,
      "terrainType": 0, "rampType": 0
    }]
  }]
}
```

### 4. 两个大坑

#### 4.1 tileSetIndex 覆盖山崖集

把建造厂图块放进 yuanbao 后，游戏里「山崖图片变成建造厂的图」——因为 yuanbao 的 tileSetIndex=10 正是 Cliff Set，tile 1 覆盖了山崖 1 号图块。**修复：从 meta.json 移除 tile 1 条目，山崖集恢复原版。**

#### 4.2 删 tile 后 SubTile 崩溃

移除 tile 1 后进游戏报：

```
SubTile 0 not found
```

根因：地图数据仍引用山崖集 1 号图块，但 PNG tileset 里没有 tile 1；`TileSets.initTileSets` 的 TMP 回退误用 `png.meta.fileName`（"yuanbao"）拼文件名，去找 `yuanbao01.tem`（不存在），而原版山崖图块是 `cliff01.tem`——entry.files 全空 → getTileImage 抛错。**修复：TMP 回退前缀始终用原版 FileName（"Cliff"），缺失 tile 回退原版山崖图块。**

### 5. 注入与验证

- `scripts/gen-inject-page.mjs` 递归收集 tilesets 目录（含子目录），生成注入清单；
- 新增 PNG 后重新生成 inject.html + Cmd+Shift+R 硬刷新注入；
- playwright 验证：进遭遇战无 SubTile 崩溃、canvas 正常渲染。

### 6. 结论

PNG tileset 替换的真相是：**tileSetIndex 决定你替换的是哪一套原版图块**。选错索引 = 悄悄覆盖别人的地形；删图块 = 触发回退链崩溃。先把 `temperatmd.ini` 的索引映射挖出来，再决定 PNG 放哪些编号、缺失 tile 回退到哪，是这套方案不踩雷的前提。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-png-tileset-terrain.html
