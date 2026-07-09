# 在 Ubuntu 衍生版上安装 Google 拼音

## 测试成功的发行版

- Lubuntu 24.04
- Ubuntu Studio 24.04

**注意**：fcitx 4.x 已于 2024 年 5 月正式归档，停止上游维护。由于设计原因，fcitx4 无法在 Wayland 环境下运行。推荐迁移到 fcitx5，使用 `fcitx5-chinese-addons` 替代 `fcitx-googlepinyin`。

**说明**：虽然 fcitx5 是推荐的下一代输入法框架，但网络上仍存在大量基于 fcitx 4.x 的教程。本教程经过人工验证测试，在上述 Ubuntu 衍生版上可正常使用，对于需要参考 fcitx 4.x 配置的用户仍然有参考价值。

## 安装步骤

1. **安装 Fcitx 和 Google 拼音**
   ```bash
   sudo apt install fcitx fcitx-googlepinyin
   ```

2. **Logout（登出）**

3. **Login（登录）**

4. **Open Fcitx Configuration（进入 Fcitx 配置）**
   - Click `+`（点击 `+`）
   - Uncheck `Only Show Current Language`（取消勾选 `Only Show Current Language`）
   - Search for `Google Pinyin` (case-insensitive)（搜索 Google Pinyin，不区分大小写）
   - Select it and click `OK`（选中，点击 OK）

5. **Use `Ctrl` + `Space` to toggle between English and Chinese input（在任意输入框使用 `Ctrl` + `Space` 与英文输入法切换）**

