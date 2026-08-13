<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Install Google Pinyin on Ubuntu Derivatives

## Tested Distributions

- Lubuntu 24.04
- Ubuntu Studio 24.04

**Note**: Fcitx 4.x was officially archived in May 2024 and upstream maintenance has stopped. Due to design limitations, fcitx4 cannot run under Wayland. Migration to fcitx5 is recommended, using `fcitx5-chinese-addons` instead of `fcitx-googlepinyin`.

**Explanation**: Although fcitx5 is the recommended next-generation input method framework, there are still many tutorials based on fcitx 4.x on the internet. This tutorial has been manually verified and tested on the Ubuntu derivatives listed above and works normally. It still has reference value for users who need to refer to fcitx 4.x configuration.

## Installation Steps

1. **Install Fcitx and Google Pinyin**
   ```bash
   sudo apt install fcitx fcitx-googlepinyin
   ```

2. **Logout**

3. **Login**

4. **Open Fcitx Configuration**
   - Click `+`
   - Uncheck `Only Show Current Language`
   - Search for `Google Pinyin` (case-insensitive)
   - Select it and click `OK`

5. **Use `Ctrl` + `Space` to toggle between English and Chinese input**

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/operating-system/gnulinux/google-pinyin-installation-ubuntu-derivatives.html
