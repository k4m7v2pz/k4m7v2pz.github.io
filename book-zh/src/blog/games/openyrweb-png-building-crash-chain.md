<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 为什么报错不崩的问题最难修：PNG 建筑渲染崩溃链复盘

> 日期：2026-08-07

### 1. 问题背景

在给 OpenYRWeb（红警2 / 尤里的复仇浏览器移植引擎）接入原创 PNG 建筑素材时，遇到了一个长达六层的崩溃链。表面症状是「基地车展开后显示绿白/蓝白棋盘格」，背后却是一个环环相扣的隐性问题。本文完整复盘这条链路——它比「报错并崩溃」的问题难修得多，因为每一层都安静地失败。

### 2. 崩溃链全貌

目标是：让基地车（MCV）展开后的建造厂显示我们自制的 `construction_yard.png`，而不是原版 SHP。为此需要引擎支持「PNG 直色建筑渲染」——原版引擎建筑只吃 SHP（8-bit 调色板索引），而 PNG 是 32-bit RGBA 直色。

#### 2.1 第一层：SystemJS 404

新增了 `data/PngShpFile.ts.js`（把解码后的 RGBA 包装成 ShpFile 兼容对象）后，游戏加载时报：

```
XHR error (404 Not Found) loading http://127.0.0.1:8080/data/PngShpFile
```

根因：`repack.mjs` 按 `src/_module-map.json` 的模块清单打包。新增文件没有注册进清单，导致 bundle 里只有 Engine 对它的 deps 引用字符串，却没有模块本体——SystemJS 运行时按路径 fetch 不到。手动往 `_module-map.json` 插入条目后解决。**教训：这个引擎的打包清单是手工维护的，新增文件必须先注册。**

#### 2.2 第二层：images 集合一个都没注入

棋盘格出现，说明 ImageFinder 回退 `.png` 永远 miss。反复排查 OPFS 数据、浏览器缓存后，最后读引擎源码才发现：

```js
// RealFileSystemDir.getEntries()
async *getEntries() {
  for (const name of this.handle.keys()) yield name; // ← 产出纯字符串！
}
```

而我的扫描代码写的是 `fe?.name`——对字符串取 `.name` 恒为 undefined，`fname = ""`，所有 PNG 被 `endsWith(".png")` 过滤掉。**这是最贵的错误：它不报错、不崩溃，只是「什么都不做」**，纯靠读引擎源码才定位。

#### 2.3 第三层：空帧聚合 agg SHP

`Building.ts.js` 会把 mainShpFile + bib + 动画帧聚合为 `agg_<name>.shp`。当 PNG 回退未命中时 `mainShpFile` 为 undefined，聚合输入全空 → `agg_GACNST.shp` images.length=0 → `getImage(0)` 越界 RangeError → 渲染队列崩 → 点选/框选全失效。

修复：`Building` 主 art 获取失败时回退原版 art（`objectRules.name`）。

#### 2.4 第四层：RGBA 帧数被砍半

`ShpAggregator.getShpFrameInfo` 里：

```js
frameCount: Math.floor(e.numImages * (t ? 0.5 : 1)) // SHP 主帧+阴影半帧布局
```

PNG 只有 1 帧 RGBA（自带 alpha），`hasShadow=true` 时被算成 0 帧 → 聚合结果为空。修复：检测 imageData 长度是否为 `w*h*4`，RGBA 直色帧不砍半、无阴影。

#### 2.5 第五层：材质格式断言

```
Texture must have format THREE.AlphaFormat
```

批量渲染路径 `useMaterial` 强制 AlphaFormat（调色板材质），PNG 直色纹理是 RGBAFormat。修复：RGBAFormat 纹理跳过批处理，走 `MeshBasicMaterial` 直色路径。

#### 2.6 第六层：BatchedMesh 专属方法缺失

```
this.mesh.setPaletteIndex / setOpacity / setExtraLight is not a function
```

直色材质（MeshBasicMaterial）没有这三个 BatchedMesh 专属方法，逐个加 `typeof === "function"` 防护。

### 3. 为什么「不崩的问题」更难修

| 特征 | 报错并崩溃 | 安静失败 |
|---|---|---|
| 定位 | 堆栈直接指到代码行 | 需要通读源码找「什么都没做」的原因 |
| 排查方向 | 单点 | 可能是数据、缓存、渲染管线任意一层 |
| 直觉 | 顺着栈追 | 每层看起来都「正常」 |

本次第二层（getEntries 返回字符串）就是典型：三个中间步骤全绿（OPFS 有文件、bundle 有代码、加载无报错），唯独注入结果为空。

### 4. 可复用的排查方法

1. **先怀疑「静默丢弃」**：批量循环里 `filter/continue` 条件最容易吞掉数据，先打印循环里实际看到了什么；
2. **读工具的实现，不猜 API**：`getEntries()` 到底返回对象还是字符串，读 `RealFileSystemDir.ts.js` 一眼可知；
3. **每层修复后立刻验证**：playwright 进遭遇战实测（`verify-iow.mjs`），不要攒多个改动一起测；
4. **把「能玩」当作回归基准**：渲染链改动后，进游戏确认交互（点选、框选）仍正常——崩溃链的终点往往是交互失效，而不是红屏。

### 5. 结论

报错并崩溃的问题像路障，一眼看到；安静失败的问题像漏气，需要逐层排查。给旧引擎接新格式（PNG 直色）时，真正的成本不在「加一个 Image 键」，而在理解渲染管线的每一层假设（打包清单、注入循环、聚合帧数、材质格式、材质方法）。这些假设写成了 `docs/PORTING.md` 的踩坑记录，后续接入其他 PNG 素材时可以直接照抄排查路径。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-png-building-crash-chain.html
