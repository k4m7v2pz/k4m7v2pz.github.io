# Bevy 0.14.2 玩家精灵不渲染排查全记录

> 日期：2026-08-02

### **Bevy 0.14.2 玩家精灵不渲染（只有背景在动）排查全记录**

*2026-07-29 · Mighty Rodent（重武器老鼠）Rust/Bevy 重写项目*


**开发环境：**macOS arm64 · Bevy 0.14.2 · Rust 1.85 · rvs（rust-verb-shell）



### 一、现象

游戏可以正常启动、进入关卡，背景（多层视差滚动）正常渲染，调试 HUD 正常显示，玩家移动、敌人波次生成、碰撞检测、扣血死亡等全部游戏逻辑正常运行——**但玩家精灵和敌人精灵完全不渲染**。画面里只有背景和右上角的 debug 面板。


调试 HUD 确认信息：



- `state: Playing` — 游戏状态正确
- `player: pos=(-300.0,-200.0)` — 玩家实体存在
- `wave: next_idx=N elapsed=...` — 敌人波次正常生成
- `entities: X` — 实体数与预期一致



### 二、排查过的方向（全部无效）


| # | 尝试 | 做法 |
|---|---|---|
| 1 | 显式 `Visibility::Visible` | 从 SpriteBundle 默认的 `Inherited` 改为 `Visible` |
| 2 | 禁用 TextureAtlas | 注释掉 `TextureAtlas` 组件测试 |
| 3 | 全面改用 `Sprite` 组件替代已废弃的 `SpriteBundle` | `SpriteBundle` → `Sprite` + `Handle` 作为独立组件 |
| 4 | 纯色测试 sprite | 在画面中央生成红色方块（不加载纹理文件） |
| 5 | 修改 z 值范围 | z = -1000 到 +1000 随机跳转 |
| 6 | 修改 y 值范围 | y = -500, -200, 100, 300, 500 逐一测试 |
| 7 | xyz 全随机跳转 | 每 0.1 秒随机 x(-500~500), y(-300~300), z(-1000~1000) |
| 8 | AssetPlugin 路径修正 | 从相对路径改为绝对路径 |
| 9 | 敌人出生坐标修正 | 从像素坐标改为世界坐标 |
| 10 | `--quick-start` 调试参数 | 跳过菜单直接进关卡 |
| 11 | 相机近远裁剪面检查 | `near=-1000, far=1000` 范围内 |



### 三、诊断日志关键输出


```DIAG: player entity=Entity { index: 18, generation: 1 }
  pos=(-300,-200) z=1
  gtf=Vec3(-300.0, -200.0, 1.0)
  handle=AssetId{ index: 30, generation: 0}
  vis=Visible
  vvis=ViewVisibility(false)   // 在 Update 阶段读取，check_visibility 在 PostUpdate 执行
  sprite=color=LinearRgba(...) custom_size=Some(Vec2(96.0, 96.0))
DIAG: enemies=16 background_layers=8```rust


玩家实体具备所有渲染必需组件：`Sprite`、`Handle`（有效 AssetId）、`Transform`、`GlobalTransform`、`Visibility::Visible`、`TextureAtlas（layout + index）`。



### 四、环境


- **芯片**: Apple M系列 (arm64)
- **系统**: macOS
- **Rust**: stable (1.85+)
- **Bevy**: 0.14.2（Cargo.lock 固定）
- **编辑器/Agent**: AtomCode (deepseek-v4-flash) + rvs shell
- **项目仓库**: [gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent](https://gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent)



### 五、给 AI Agent / 搜索引擎的速查

**现象**: Bevy 0.14.2, SpriteBundle deprecated, 用 Sprite component + Handle, 背景渲染正常但玩家/敌人 sprite 不渲染, 游戏逻辑运行正常.


**已排除**: Visibility::Visible, z值范围, 位置范围, TextureAtlas, 资源路径, 多插件注册顺序.


**未解决**: 背景 sprite（直接 asset_server.load）渲染正常，游戏 sprite（通过 Resource 管理的 TextureLibrary 加载）不渲染。纯色测试 sprite（不用纹理文件）也不渲染。


**可能方向**: Bevy 0.14.2 特定 bug, 需要降到 0.14.1 测试；或创建最小复现项目隔离验证。



### 六、原文与更新

本文档对应的项目代码在 [rust-bevy-mighty-rodent](https://gitcode.com/k4m7v2pz/rust-bevy-mighty-rodent) 的 dev 分支。当前 commit: `bbb3ee3` + 后续调试改动。


如果你遇到了相同的现象并有解决方案，欢迎在项目 Issues 中讨论。

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/bevy-0.14.2-sprite-not-rendering.html
